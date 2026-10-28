import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {applyExistingStyle} from '../public/existing-materials.js';
import {createNeighbourhoodContext, fetchNeighbourhoodModel} from '../public/neighbourhood-context.js';

const asset = {url: 'models/local-context.glb.gz'};
const bounds = [-4800, 0, -4300, 500];
const near = {district: 'citywide', target: {x: -4550, z: 250}, distance: 1500};
const far = {...near, distance: 10000};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
  const pending = [], attached = [], removed = [], disposed = [];
  const manager = createNeighbourhoodContext({
    asset, bounds,
    load(item, signal) { const task = deferred(); pending.push({item, signal, ...task}); return task.promise; },
    attach: model => attached.push(model), remove: model => removed.push(model),
    dispose: model => disposed.push(model), ...options,
  });
  return {manager, pending, attached, removed, disposed};
}

test('only a close Citywide view near the patch is eligible', async () => {
  const h = harness();
  for (const view of [far, {...near, district: 'downtown'}, {...near, target: {x: 0, z: 0}},
    {...near, distance: NaN}, {...near, target: {x: NaN, z: 0}}, {}]) await h.manager.update(view);
  assert.equal(h.pending.length, 0);
  assert.equal(h.manager.state.status, 'idle');
  const task = h.manager.update({...near, district: {id: 'citywide'}});
  await tick();
  assert.equal(h.pending.length, 1);
  h.pending[0].resolve({name: 'patch'});
  assert.equal((await task).status, 'ready');
});

test('concurrent updates share one request and a ready patch is not loaded twice', async () => {
  const h = harness(), first = h.manager.update(near), second = h.manager.update(near);
  assert.equal(first, second);
  await tick();
  assert.equal(h.pending.length, 1);
  assert.equal(h.pending[0].item, asset);
  const model = {name: 'owned'};
  h.pending[0].resolve(model);
  await first;
  await h.manager.update(near);
  await h.manager.retry();
  assert.equal(h.pending.length, 1);
  assert.deepEqual(h.attached, [model]);
});

test('navigation before the load microtask avoids starting a fetch', async () => {
  const h = harness(), task = h.manager.update(near);
  await h.manager.update({...near, district: 'heartland'});
  await task;
  assert.equal(h.pending.length, 0);
  assert.equal(h.manager.state.status, 'idle');
});

test('leaving aborts an active fetch and late results are disposed without attachment', async () => {
  const h = harness(), task = h.manager.update(near);
  await tick();
  await h.manager.update(far);
  assert(h.pending[0].signal.aborted);
  const stale = {name: 'stale'};
  h.pending[0].resolve(stale);
  await task;
  assert.deepEqual(h.attached, []);
  assert.deepEqual(h.disposed, [stale]);
  assert.deepEqual(h.removed, []);
  assert.equal(h.manager.state.status, 'idle');
});

test('a late old request cannot remove or replace the new patch', async () => {
  const h = harness(), oldTask = h.manager.update(near);
  await tick();
  await h.manager.update(far);
  const newTask = h.manager.update(near);
  await tick();
  const fresh = {name: 'fresh'}, stale = {name: 'stale'};
  h.pending[1].resolve(fresh);
  await newTask;
  h.pending[0].resolve(stale);
  await oldTask;
  assert.deepEqual(h.attached, [fresh]);
  assert.deepEqual(h.disposed, [stale]);
  assert.deepEqual(h.removed, []);
  assert.equal(h.manager.state.status, 'ready');
  await h.manager.update({...near, district: 'downtown'});
  assert.deepEqual(h.removed, [fresh]);
  assert.deepEqual(h.disposed, [stale, fresh]);
});

test('network failures are contained, do not retry each frame, and can recover explicitly', async () => {
  const h = harness(), task = h.manager.update(near);
  await tick();
  h.pending[0].reject(new Error('private network detail'));
  assert.deepEqual(await task, {status: 'error', eligible: true, loaded: false});
  for (let i = 0; i < 10; i++) await h.manager.update(near);
  assert.equal(h.pending.length, 1);
  const retry = h.manager.retry();
  await tick();
  h.pending[1].resolve({name: 'recovered'});
  assert.equal((await retry).status, 'ready');
});

test('leaving and re-entering allows retry, while inactive retry never fetches', async () => {
  const h = harness();
  await h.manager.retry();
  const failed = h.manager.update(near);
  await tick();
  h.pending[0].reject(new Error('failed'));
  await failed;
  await h.manager.update(far);
  await h.manager.retry();
  assert.equal(h.pending.length, 1);
  const retry = h.manager.update(near);
  await tick();
  h.pending[1].resolve({});
  assert.equal((await retry).status, 'ready');
});

test('hysteresis avoids reloads near distance and target boundaries', async () => {
  const h = harness(), task = h.manager.update(near);
  await tick(); h.pending[0].resolve({}); await task;
  await h.manager.update({...near, distance: 2500, target: {x: -3800, z: 250}});
  assert.equal(h.manager.state.status, 'ready');
  await h.manager.update({...near, distance: 2801});
  assert.equal(h.disposed.length, 1);
  await h.manager.update({...near, distance: 2500});
  await h.manager.update({...near, target: {x: -3900, z: 250}});
  assert.equal(h.pending.length, 1);
});

test('dispose is permanent, aborts pending work and disposes late parsed geometry once', async () => {
  const h = harness(), task = h.manager.update(near);
  await tick(); h.manager.dispose(); h.manager.dispose();
  assert(h.pending[0].signal.aborted);
  h.pending[0].resolve({}); await task;
  await h.manager.update(near); await h.manager.retry(); h.manager.clear();
  assert.equal(h.pending.length, 1);
  assert.equal(h.disposed.length, 1);
  assert.equal(h.manager.state.status, 'disposed');
});

test('clearing a ready patch removes only its owned object, once', async () => {
  const base = {visible: true}, h = harness(), task = h.manager.update(near);
  await tick(); const patch = {}; h.pending[0].resolve(patch); await task;
  h.manager.clear(); h.manager.clear(); h.manager.dispose();
  assert.deepEqual(h.removed, [patch]);
  assert.deepEqual(h.disposed, [patch]);
  assert.deepEqual(base, {visible: true});
});

test('partial attachment failure rolls back the patch and stays retryable', async () => {
  const h = harness({attach() { throw new Error('attach failed'); }});
  const task = h.manager.update(near); await tick(); const patch = {};
  h.pending[0].resolve(patch);
  assert.equal((await task).status, 'error');
  assert.deepEqual(h.removed, [patch]); assert.deepEqual(h.disposed, [patch]);
  assert.equal(h.manager.state.loaded, false);
});

test('cancellation during asynchronous attachment cannot resurrect an owned patch', async () => {
  const attachTask = deferred(), h = harness({attach: () => attachTask.promise});
  const task = h.manager.update(near); await tick(); h.pending[0].resolve({}); await tick();
  h.manager.clear(); attachTask.resolve(); await task;
  assert.equal(h.manager.state.status, 'idle');
  assert.equal(h.removed.length, 1); assert.equal(h.disposed.length, 1);
});

test('cleanup still disposes owned geometry if a scene removal callback fails', async () => {
  const h = harness({remove() { throw new Error('remove failed'); }});
  const task = h.manager.update(near); await tick(); h.pending[0].resolve({}); await task;
  assert.doesNotThrow(() => h.manager.clear());
  assert.equal(h.disposed.length, 1);
  assert.equal(h.manager.state.status, 'idle');
});

const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);
test('fetch adapter forwards the abort signal and decodes gzip before parsing', async () => {
  const controller = new AbortController(); let fetched;
  const result = await fetchNeighbourhoodModel(asset, controller.signal, {
    resolveURL: url => url + '?edition=reviewed',
    fetcher: async (url, options) => { fetched = {url, options}; return new Response(gzipSync(glb)); },
    parse: bytes => [...new Uint8Array(bytes)],
  });
  assert.equal(fetched.url, asset.url + '?edition=reviewed');
  assert.equal(fetched.options.signal, controller.signal);
  assert.deepEqual(result, [...glb]);
});

test('already HTTP-decoded GLB is accepted without a second gzip decode', async () => {
  assert.deepEqual(await fetchNeighbourhoodModel(asset, new AbortController().signal, {
    fetcher: async () => new Response(glb), parse: bytes => [...new Uint8Array(bytes)],
  }), [...glb]);
});

test('an aborted request never starts fetching or parsing a response body', async () => {
  const before = new AbortController(); before.abort();
  await assert.rejects(fetchNeighbourhoodModel(asset, before.signal, {
    fetcher() { throw new Error('must not fetch'); }, parse() { throw new Error('must not parse'); },
  }), {name: 'AbortError'});
  const during = new AbortController(); let parsed = false;
  await assert.rejects(fetchNeighbourhoodModel(asset, during.signal, {
    fetcher: async () => ({ok: true, async arrayBuffer() { during.abort(); return glb.buffer; }}),
    parse() { parsed = true; },
  }), {name: 'AbortError'});
  assert.equal(parsed, false);
});

test('parser completion after cancellation returns geometry to the manager for disposal', async () => {
  const parseTask = deferred(), h = harness({load: (item, signal) => fetchNeighbourhoodModel(item, signal, {
    fetcher: async () => new Response(glb), parse: () => parseTask.promise,
  })});
  const task = h.manager.update(near); await tick();
  h.manager.clear(); const patch = {}; parseTask.resolve(patch); await task;
  assert.deepEqual(h.attached, []); assert.deepEqual(h.disposed, [patch]);
});

test('invalid HTTP and truncated GLB payloads never reach the parser', async () => {
  for (const response of [new Response('', {status: 404}), new Response('<html>'),
    new Response(glb.slice(0, 11)), new Response(new Uint8Array([...glb, 0]))]) {
    await assert.rejects(fetchNeighbourhoodModel(asset, undefined, {
      fetcher: async () => response, parse() { throw new Error('parser must not run'); },
    }), /Context request failed|complete GLB/);
  }
});

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const updateSource = app.split('\n').find(line => line.startsWith('function updateNeighbourhood()'));
test('app context readiness gate is safe before initialization and while a district loads', () => {
  const calls = [], context = {
    localNeighbourhood: {update: view => calls.push(view)}, current: undefined, window: {},
    controls: {target: {x: 0, z: 0}}, camera: {position: {distanceTo: () => 1500}},
  };
  const update = runInNewContext('(' + updateSource + ')', context);
  assert.doesNotThrow(update); assert.equal(calls.at(-1).district, null);
  context.current = {id: 'citywide'}; context.window.atlasReady = null;
  update(); assert.equal(calls.at(-1).district, null);
  context.window.atlasReady = 'citywide'; update(); assert.equal(calls.at(-1).district, 'citywide');
});

test('actual app adapters attach additive geometry, preserve base/material ownership, then release it', async () => {
  const scene = new THREE.Scene(), base = new THREE.Group(), patch = new THREE.Group();
  scene.add(base);
  const geometry = new THREE.BoxGeometry(5, 5, 5), originalPositions = [...geometry.attributes.position.array];
  const oldMaterial = new THREE.MeshStandardMaterial(), shared = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, oldMaterial); patch.add(mesh);
  let oldDisposals = 0, sharedDisposals = 0, geometryDisposals = 0, fetchSignal;
  oldMaterial.addEventListener('dispose', () => oldDisposals++);
  shared.addEventListener('dispose', () => sharedDisposals++);
  geometry.addEventListener('dispose', () => geometryDisposals++);
  const actualAsset = {district: 'citywide', url: asset.url, sha256: 'a'.repeat(64), boundsXZ: bounds};
  const context = {
    THREE, scene, materials: {Existing: shared}, markerMaterial: {}, assetVersions: new Map(),
    neighbourhoodData: {assets: [actualAsset]}, localNeighbourhood: null, URL,
    document: {baseURI: 'https://futuremississauga.com/explore.html'},
    existingStyleIndex: {ids: new Set(), contains: () => false}, applyExistingStyle,
    createNeighbourhoodContext, versionedTreeURL: url => url + '?edition=reviewed',
    loader: {parseAsync: async () => ({scene: patch})},
    fetchNeighbourhoodModel: async (item, signal, options) => {
      assert.equal(item, actualAsset); fetchSignal = signal;
      assert.equal(options.resolveURL(item.url), asset.url + '?edition=reviewed');
      return options.parse(new ArrayBuffer(0));
    },
    visibleAttribution: {registerAsset() {}, refresh() {}},
    syncNeighbourhoodStatus() {}, controls: {addEventListener() {}}, updateNeighbourhood() {},
  };
  const disposeSource = app.slice(app.indexOf('function dispose(g)'), app.indexOf('\nfunction settleControls'));
  context.dispose = runInNewContext('(' + disposeSource + ')', context);
  const integration = app.slice(app.indexOf('const neighbourhoodAsset='), app.indexOf('\nasync function focusNeighbourhood()'));
  runInNewContext(integration, context);
  await context.localNeighbourhood.update(near);
  assert(fetchSignal instanceof AbortSignal);
  assert.equal(patch.parent, scene); assert.equal(base.parent, scene); assert.equal(base.visible, true);
  assert.equal(mesh.material, shared); assert.equal(oldDisposals, 1);
  assert.deepEqual([...geometry.attributes.position.array], originalPositions);
  assert.equal(mesh.userData.Status, 'Existing'); assert.equal(mesh.userData.neighbourhoodContext, true);
  await context.localNeighbourhood.update({...near, district: 'downtown'});
  assert.equal(patch.parent, null); assert.equal(base.parent, scene); assert.equal(base.visible, true);
  assert.equal(geometryDisposals, 1); assert.equal(sharedDisposals, 0);
});

const routingSource = app.slice(app.indexOf('function districtForProject(p)'), app.indexOf('\nfunction ', app.indexOf('function districtForProject(p)') + 1));
test('represented projects stay in ready Citywide while missing models still route to their district', () => {
  const city = {id: 'citywide'}, downtown = {id: 'downtown'}, project = {viewerDistrict: 'downtown'};
  const context = {current: city, window: {atlasReady: 'citywide'}, districts: [city, downtown], projectMeshes: () => [{}]};
  const route = runInNewContext('(' + routingSource + ')', context);
  assert.equal(route(project), city);
  context.projectMeshes = () => []; assert.equal(route(project), downtown);
  context.projectMeshes = () => [{}]; context.window.atlasReady = null; assert.equal(route(project), downtown);
  context.current = downtown; context.window.atlasReady = 'downtown'; assert.equal(route(project), downtown);
});
