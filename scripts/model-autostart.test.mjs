import {configureStudyCredits} from '../public/model-study-presentation.js';
import {prepareAppearancePreference} from '../public/appearance-preference.js';
import {buildingFeedbackHTML,bindBuildingFeedback} from '../public/building-feedback.js';
import {modelRevisionForProject} from '../public/model-revisions.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {selectPreview} from '../public/model-preview-loading.js';
import {assetURL} from '../public/asset-delivery.js';
import {drawingPolicy} from '../public/viewer-runtime.js';
import {fitPerspectiveBox} from '../public/model-preview-framing.js';
import {applyPreviewAppearance,previewClipping} from '../public/model-preview-presentation.js';

const source = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
const manifest = JSON.parse(source('data/model-previews.json'));
const withoutImports = text => text.replace(/^import .*;\n/gm, '');
const notice = source('city-data-terms.js').replace(/^export /gm, '');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return {promise, resolve, reject};
};

function dom() {
  const elements = new Map(), created = [];
  function element(tag = 'div') {
    const listeners = new Map();
    const node = {tag, children: [], preceding: [], style: {}, dataset: {}, attributes: {}, hidden: false,
      disabled: false, textContent: '', clientWidth: 800, clientHeight: 600,
      classList: {add() {},toggle() {}},
      append(...nodes) { this.children.push(...nodes); },
      insertAdjacentHTML(position,html) { (this.insertedHTML??=[]).push({position,html}); },
      prepend(...nodes) { this.children.unshift(...nodes); },
      before(...nodes) { this.preceding.push(...nodes); },
      after(...nodes) { (this.following??=[]).push(...nodes); },
      add(node) { this.children.push(node); },
      replaceChildren(...nodes) { this.children = nodes; },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
      dispatch(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
      focus() {}, remove() {}, click() { this.onclick?.(); this.dispatch('click'); }};
    created.push(node); return node;
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const document = {hidden: false, title: '', getElementById: get, querySelector: selector => selector.startsWith('#')?get(selector.slice(1)):null,
    querySelectorAll: selector => selector.startsWith('#')?[get(selector.slice(1))]:[],
    createElement: element, createTextNode: text => text, addEventListener() {}, body: element('body')};
  return {get, created, document, element, has:id=>elements.has(id)};
}

function modelHarness({id = 'mcity-m1', graphics = true} = {}) {
  const ui = dom(), requests = [], events = [], window = ui.element('window');
  class Renderer {
    constructor() { if (!graphics) throw new Error('No WebGL'); }
    getContext() { return {getExtension: () => ({restoreContext() { events.push('restore-request'); }})}; }
    setPixelRatio() {} setSize() {} render() {} dispose() {}
  }
  class Controls {
    constructor() { this.target = new THREE.Vector3(); }
    addEventListener() {} update() { return false; } dispose() {}
  }
  class Loader {
    async parseAsync() {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(20, 100, 20), new THREE.MeshBasicMaterial()));
      return {scene};
    }
  }
  const context = {THREE: {...THREE, WebGLRenderer: Renderer}, OrbitControls: Controls, GLTFLoader: Loader,
    selectPreview, assetURL, drawingPolicy, fitPerspectiveBox, applyPreviewAppearance, previewClipping, configureStudyCredits:view=>configureStudyCredits(view,ui.document),buildingFeedbackHTML,bindBuildingFeedback,modelRevisionForProject,loadModelRevisions:async()=>null,batchOpaqueStudy() {},
    createFrameScheduler: () => ({invalidate() { events.push('draw-request'); }, pause() {}, frames: 0}),
    verifiedModelBytes: asset => { const request = deferred(); requests.push({...request, id: asset.id}); return request.promise; },
    document: ui.document, window, location: {href:'https://futuremississauga.com/model.html?model='+id, search: '?model=' + id, assign() {}, reload() { events.push('reload'); }},
    URLSearchParams, URL, Blob, Option: function(text, value) { return {text, value}; },
    fetch: async () => ({ok: true, json: async () => manifest}),
    navigator: {}, devicePixelRatio: 1, matchMedia: () => ({matches: false}),
    ResizeObserver: class {observe() {} disconnect() {}}, IntersectionObserver: class {observe() {} disconnect() {}},
    setTimeout: () => 1, clearTimeout() {}, console};
  // Execute the actual module body and notice implementation. Only rendering
  // and network dependencies are substituted, so a waiting consent gate fails.
  const done = runInNewContext('(async () => {' + notice + '\n' + withoutImports(source('model-preview.js')) + '\n})()', context);
  return {...ui, requests, events, window, done};
}

test('City-derived model starts directly with visible credit and a terms link beside it', async () => {
  const run = modelHarness(); await settle();
  assert.equal(run.requests.length, 1, 'initial asset request must start without user action');
  const notices = run.created.filter(node => node.className === 'city-data-terms');
  assert.equal(notices.length, 1); assert.equal(notices[0].tag, 'p');
  assert.deepEqual(run.get('studyCredit').following, notices);
  assert.equal(notices[0].children.length, 1, 'source link must not reintroduce assent prose');
  assert.equal(run.get('previewContent').preceding.length, 0);
  assert.equal(run.created.some(node => node.className === 'city-data-load'), false);
  assert.match(notices[0].children[0].href, /961c790805c14d8da258ec91bf4117e3\/data$/);
  run.requests[0].resolve(new Uint8Array(8)); await run.done;
  assert.equal(run.window.modelPreview.ready, true);
  assert.match(run.get('previewStatus').textContent, /Model ready/);
});

test('failed automatic model request can retry without any terms interaction', async () => {
  const run = modelHarness(); await settle();
  run.requests[0].reject(new Error('Connection interrupted')); await run.done;
  assert.equal(run.window.modelPreview.ready, false);
  assert.equal(run.get('retryModel').hidden, false);
  assert.match(run.get('previewStatus').textContent, /Connection interrupted/);
  run.get('retryModel').onclick(); await settle();
  assert.equal(run.requests.length, 2);
  run.requests[1].resolve(new Uint8Array(8)); await settle();
  assert.equal(run.window.modelPreview.ready, true);
  assert.equal(run.created.filter(node => node.className === 'city-data-terms').length, 1);
});

test('context recovery during automatic loading commits only the current request', async () => {
  const run = modelHarness(); await settle();
  let prevented = false;
  run.get('previewCanvas').dispatch('webglcontextlost', {preventDefault() { prevented = true; }});
  assert.equal(prevented, true); assert.equal(run.window.modelPreview.ready, false);
  run.get('retryModel').onclick(); assert.ok(run.events.includes('restore-request'));
  run.get('previewCanvas').dispatch('webglcontextrestored'); await settle();
  assert.equal(run.requests.length, 1, 'recovery must reuse the in-flight verified bytes');
  run.requests[0].resolve(new Uint8Array(8)); await run.done; await settle();
  assert.equal(run.window.modelPreview.ready, true);
  assert.equal(run.window.modelPreview.model.children.length, 1, 'stale request must not duplicate geometry');
});

test('unavailable graphics keeps an actionable retry without advertising model downloads', async () => {
  const run = modelHarness({graphics: false}); await run.done;
  assert.equal(run.requests.length, 0);
  assert.equal(run.window.modelPreview.ready, false);
  assert.equal(run.has('modelDownloads'), false);
  assert.doesNotMatch(run.get('previewStatus').textContent, /download/i);
  assert.equal(run.get('retryModel').hidden, false);
  assert.match(run.get('previewStatus').textContent, /3D graphics are unavailable/);
  run.get('retryModel').onclick(); assert.deepEqual(run.events, ['reload']);
});

function mapHarness(fail = false) {
  const ui = dom(), requests = [], events = [];
  // Substitute only the import transport; execute the actual bootstrap and its
  // failure handler so immediate startup and recovery are both observable.
  const code = withoutImports(source('viewer-bootstrap.js')).replace(/import\(/g, 'loadApp(');
  const option={value:'port-credit',textContent:'Port Credit'};
  ui.get('districtSelect').querySelector=()=>option;
  const label=ui.get('mapGalleryLink');label.firstChild={textContent:''};
  ui.get('sceneWrap').style.setProperty=(name,value)=>{ui.get('sceneWrap').style[name]=value;};
  const done = runInNewContext('(async () => {' + notice + '\n' + code + '\n})()', {
    document: ui.document, prepareAppearancePreference, loadApp: async url => { requests.push(url); if (fail) throw new Error('Offline'); },
    window:ui.element('window'), URL,CSS:{escape:value=>value},
    location: {href:'https://futuremississauga.com/explore.html?district=port-credit',reload() { events.push('reload'); }}, console: {error() {}}});
  return {...ui, requests, events, done};
}

test('city map imports immediately without a terms button', async () => {
  const run = mapHarness(); await run.done;
  assert.equal(run.requests.length, 1); assert.match(run.requests[0], /^\.\/app\.js\?v=/);
  assert.match(run.get('sceneWrap').style['--loading-image'],/wide-port-credit-future/);
  assert.equal(run.get('districtTitle').textContent,'Port Credit');
  assert.equal(run.created.some(node => node.className === 'city-data-load' || node.className === 'city-data-terms'), false);
});

test('failed city map import keeps retry and gallery recovery available', async () => {
  const run = mapHarness(true); await run.done;
  assert.equal(run.requests.length, 1);
  assert.equal(run.get('loading').hidden, false); assert.equal(run.get('loading').style.display, 'grid');
  assert.equal(run.get('sceneWrap').attributes['aria-busy'], 'false');
  const retry = run.get('loading').children.find(node => node?.textContent === 'Retry map');
  assert.ok(retry); retry.click(); assert.deepEqual(run.events, ['reload']);
  assert.ok(run.get('loading').children.some(node => node?.href === 'place-port-credit.html'));
});


test('Maritz starts directly, links to Heartland and retains the design credit and City terms',async()=>{
 const run=modelHarness({id:'sgm-maritz-6710'});await settle();
 assert.deepEqual(run.requests.map(request=>request.id),['sgm-maritz-6710']);
 assert.equal(run.created.filter(node=>node.href==='explore.html?district=heartland&project=sgm-maritz-6710').length,1);
 assert.equal(run.created.filter(node=>node.href==='reference-updates.html#sgm-maritz-6710').length,1);
 assert.match(run.get('studyCredit').textContent,/Design: SG&M Architects Inc\. \(formerly Sirlin Giller & Malek Architects\)\./);
 assert.match(run.get('studyCredit').textContent,/Model creation: Daniel Sultan/);
 assert.equal(run.get('studyNotesLink').href, 'study-notes.html#model-sgm-maritz-6710');
 const note = source('study-notes.html').match(/<article id="model-sgm-maritz-6710">([\s\S]*?)<\/article>/)[1];
 assert.match(note, /photograph date is unknown/);
 assert.equal(run.created.filter(node=>node.className==='city-data-terms').length,1);
 run.requests[0].resolve(new Uint8Array(8));await run.done;assert.equal(run.window.modelPreview.ready,true);
});


test('275 Superior starts directly with visible photo and City credits, without model download controls',async()=>{
 const run=modelHarness({id:'ergocentric-275-superior'});await settle();
 assert.deepEqual(run.requests.map(request=>request.id),['ergocentric-275-superior']);
 assert.equal(run.created.filter(node=>node.href==='explore.html?district=citywide&project=ergocentric-275-superior').length,1);
 for(const id of ['modelDownloads','compressedDownloads','downloadNote']) assert.equal(run.has(id),false);
 assert.match(run.get('studyCredit').insertedHTML[0].html,/>David Lasker\/Cityscape Photography<\/a>/);
 assert.equal(run.created.filter(node=>node.className==='city-data-terms').length,1);
 run.requests[0].resolve(new Uint8Array(8));await run.done;assert.equal(run.window.modelPreview.ready,true);
});


test('every public study loads all its registered geometry without creating a 3D file action',async()=>{
 for(const view of manifest.views){
  const run=modelHarness({id:view.id});await settle();
  for(let i=0;i<view.assets.length;i++){
   assert.equal(run.requests[i]?.id,view.assets[i],view.id);
   run.requests[i].resolve(new Uint8Array(8));await settle();
  }
  await run.done;
  assert.equal(run.window.modelPreview.ready,true,view.id);
  assert.equal(run.window.modelPreview.model.children.length,view.assets.length,view.id);
  for(const id of ['modelDownloads','compressedDownloads','downloadNote']) assert.equal(run.has(id),false,view.id);
  assert.equal(run.created.some(node=>node.download||node.dataset.download),false,view.id);
 }
});
