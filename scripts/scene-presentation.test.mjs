import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {northBearingFromNDC, projectNorth} from '../public/scene-presentation.js';
import {createModelAppearance} from '../public/model-appearance.js';
import {batchOpaqueStudy} from '../public/model-preview-batching.js';

test('north bearing uses screen pixels on wide and portrait images', () => {
  const anchor = {x: 0, y: 0}, north = {x: .5, y: .5};
  assert.ok(Math.abs(northBearingFromNDC(anchor, north, 2000, 1000).degrees - 63.4349488229) < 1e-8);
  assert.ok(Math.abs(northBearingFromNDC(anchor, north, 500, 1000).degrees - 26.5650511771) < 1e-8);
  assert.equal(northBearingFromNDC(anchor, anchor, 2000, 1000), null);
  assert.equal(northBearingFromNDC(anchor, north, 0, 1000), null);
});

test('projected north agrees with the actual camera basis, including roll', () => {
  for (const aspect of [.5, 1, 2.4]) for (const roll of [0, .35]) {
    const camera = new THREE.PerspectiveCamera(35, aspect, 1, 10000);
    camera.position.set(700, 900, 800); camera.lookAt(0, 0, 0); camera.rotateZ(roll); camera.updateMatrixWorld();
    const actual = projectNorth(THREE, camera, new THREE.Vector3(), aspect * 1000, 1000);
    const n = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorldInverse);
    const expected = Math.atan2(n.x, n.y) * 180 / Math.PI;
    assert.ok(Math.abs(actual.degrees - expected) < 1e-8);
  }
});

test('the retired architectural outline generator is not shipped', () => {
  assert.equal(existsSync(new URL('../public/building-presentation.js', import.meta.url)), false);
});

// Check dependency graphs, not just the entry files, so moving a generator into
// another imported helper cannot silently restore display-only outlines.
function assertNoGeneratedOutlines(entry) {
  const seen = new Set();
  function visit(url) {
    url = new URL(url); url.search = ''; url.hash = '';
    if (seen.has(url.href) || url.pathname.includes('/vendor/')) return;
    seen.add(url.href);
    const source = readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /addArchitecturalEdges|architecturalEdges|building-presentation\.js/, url.pathname);
    assert.doesNotMatch(source, /\bnew\s+(?:\w+\.)?(?:EdgesGeometry|WireframeGeometry|LineSegments)\s*\(/, url.pathname);
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+\.js(?:\?[^'"]*)?)['"]/g)) visit(new URL(match[1], url));
  }
  visit(entry);
  assert.ok(seen.size > 1, 'the entry must exercise its imported implementation');
}
for (const entry of ['app.js', 'model-preview.js']) {
  test(`${entry} and its first-party dependencies never generate architectural LineSegments`, () => {
    assertNoGeneratedOutlines(new URL('../public/' + entry, import.meta.url));
  });
}

test('Save Image copies the rendered scene once and draws its presentation below the model', async () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf("$('#exportBtn').onclick=async()=>{");
  const end = app.indexOf('\nfunction drawFrame()', start);
  assert.ok(start > 0 && end > start);
  const canvas = {width: 1600, height: 900}, events = [], copied = [];
  const button = {setAttribute(){}, removeAttribute(){}}, status = {replaceChildren(...children){this.children=children;}};
  // The scene area accepts one canvas copy. This mock deliberately has no
  // path/stroke methods with which to redraw an architectural outline layer.
  const ctx = {fillRect(){}, drawImage(...args){copied.push(args);events.push('copy');}, fillText(){}};
  const output = {getContext(){return ctx;},toBlob(callback,type){assert.equal(type,'image/png');callback(new Blob(['test']));}};
  const document = {fonts:{load:async()=>{}},createTextNode:text=>text,createElement:tag=>tag==='canvas'?output:{click(){events.push('download');}}};
  const run = {Blob,document,canvas,exporting:false,contextLost:false,current:{id:'downtown',name:'Downtown'},window:{atlasReady:'downtown'},selectedStudyProjectId:null,compare:false,mode:'future',appearance:{mode:'natural'},displayedSources:{designCredits:[]},THREE,camera:{},controls:{target:{}},STATUS_CLASSIFICATION_EDITION:'test',exportImageURL:null,
    $:selector=>selector==='#exportBtn'?button:status,clearExportImage(){},render(){events.push('render');},
    currentStatusLegend:()=>[],presentationLayout:()=>({height:104,scale:1}),exportCreditLines:()=>[],projectNorth:()=>null,
    drawPresentationFooter(context,options){assert.equal(context,ctx);assert.equal(options.top,canvas.height);events.push('footer');},
    withPNGMetadata:async blob=>blob,URL:{createObjectURL:()=> 'blob:test'}};
  runInNewContext(app.slice(start,end),run);
  await button.onclick();
  assert.deepEqual(events,['render','copy','footer','download']);
  assert.equal(copied.length,1);assert.equal(copied[0][0],canvas);assert.deepEqual(copied[0].slice(1),[0,0]);
  assert.equal(output.width,canvas.width);assert.ok(output.height>canvas.height);
  assert.equal(status.hidden,false);assert.equal(status.children[0],'Image ready.');
});

test('physical mullions, rails and slabs survive appearance changes and standalone batching', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({color: '#668899'});
  const appearance = createModelAppearance(THREE);
  const meshes = ['Architectural mullion', 'Balcony rail', 'Terrace slab'].map((name, i) => {
    const geometry = new THREE.BoxGeometry(1 + i, 8 - i, 2); geometry.clearGroups();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.x = i * 5;
    mesh.userData = {assetId: 'authored-building', lifecycle: 'under_construction', nativeTexture: true};
    root.add(mesh); appearance.register(mesh, {authored: true}); return mesh;
  });
  const buffers = meshes.map(mesh => ({indices: Array.from(mesh.geometry.index.array), attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)]))}));
  for (const mode of ['status', 'natural']) appearance.setMode(mode);
  for (const [i, mesh] of meshes.entries()) {
    assert.equal(mesh.material, material); assert.equal(mesh.visible, true); assert.equal(mesh.children.length, 0);
    assert.deepEqual(Array.from(mesh.geometry.index.array), buffers[i].indices);
    for (const [name, values] of Object.entries(buffers[i].attributes)) assert.deepEqual(Array.from(mesh.geometry.attributes[name].array), values);
  }
  const originalIndices = meshes.reduce((n, mesh) => n + mesh.geometry.index.count, 0);
  const result = batchOpaqueStudy(root, THREE);
  assert.equal(result.batchedMeshes, 3); assert.equal(root.children.length, 1);
  const merged = root.children[0];
  assert.equal(merged.isMesh, true); assert.equal(merged.isLineSegments, undefined);
  assert.deepEqual(merged.userData.sourceMeshNames, meshes.map(mesh => mesh.name));
  assert.equal(merged.geometry.index.count, originalIndices); assert.equal(merged.material, material);
  appearance.dispose(); merged.geometry.dispose(); material.dispose();
});
