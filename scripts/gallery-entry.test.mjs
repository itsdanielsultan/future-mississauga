import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {downtownAerial} from '../public/downtown-aerial.js';
import {assetURL} from '../public/asset-delivery.js';
import {mediaPreviewInfo,comparisonPair} from '../public/clean-media.js';
import {buildGalleryCatalogue,filterGallery,galleryViews} from '../public/gallery-catalogue.js';

const pub = new URL('../public/', import.meta.url);
const source = fs.readFileSync(new URL('gallery.js', pub), 'utf8').replace(/^import .*;\n/gm, '');
const entry = fs.readFileSync(new URL('gallery-entry.js', pub), 'utf8');
const galleryImports = [...entry.matchAll(/import\(\s*(['"])\.\/gallery\.js(?:\?[^'"]*)?\1\s*\)/g)];
assert.equal(galleryImports.length, 1, 'the entry must import the gallery exactly once');
const districtData = JSON.parse(fs.readFileSync(new URL('data/districts.json', pub)));
const pictureData = JSON.parse(fs.readFileSync(new URL('data/picture-assets.json', pub)));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function harness({bootstrap = true, failedImport = false} = {}) {
  const listeners = new Map(), data = deferred(), metadata = deferred();
  const windowListeners=new Map(),windowState={addEventListener(type,callback){windowListeners.set(type,[...windowListeners.get(type)||[],callback]);}};
  const shows = [], notices = [], buttons = [];
  let reloads = 0, loads = 0, initialization;
  function node(tag = 'div') {
    return {
      tag, dataset: {}, attributes: {}, style: {}, isConnected: true, disabled: false, children: [], value:'',
      setAttribute(name, value) { this.attributes[name] = value; },
      hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
      replaceChildren(...children) { this.children = children; },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(type, callback) { this['on' + type] = callback; },
      insertAdjacentHTML() {},
      querySelector() { return node(); },
      querySelectorAll() { return []; },
      append(...children) { this.children.push(...children); },
      before(message) { notices.push(message); },
      closest(selector) { return selector === '[data-open]' && this.dataset.open ? this : null; },
      click() { if (!this.disabled) click(this); },
    };
  }
  const hero = node('button'); hero.dataset.open = 'downtown'; hero.dataset.view='skyline'; hero.setAttribute('data-aerial-feature', ''); buttons.push(hero);
  const elements = new Map(['.hero', '#galleryGrid', '#perspectiveGrid', '#pictureCompare', '#compareDivider', '#pictureSlider', '#beforePicture', '#comparisonDistrict'].map(id => [id, node()]));
  elements.get('.hero').querySelector=selector=>selector==='button'?hero:node();
  for(const id of ['#galleryArea','#galleryView']){elements.set(id,node());elements.get(id).value='all';}
  elements.set('#skylineScenario',node());elements.get('#skylineScenario').value='skyline';
  const document = {
    readyState: 'loading',
    querySelector: selector => {if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);},
    querySelectorAll: selector => selector === '[data-open]' ? buttons : [],
    createElement: tag => node(tag),
    addEventListener(type, callback, options) {
      listeners.set(type, [...listeners.get(type) || [], {callback, capture: options === true, once: options?.once}]);
    },
    removeEventListener(type, callback, options) {
      listeners.set(type, (listeners.get(type) || []).filter(row => row.callback !== callback || row.capture !== (options === true)));
    },
  };
  function click(target) {
    const event = {target, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }};
    for (const row of listeners.get('click') || []) { row.callback(event); if (event.stopped) return; }
    target.onclick?.(event);
  }
  const context = vm.createContext({document, URL, location: {href:'https://futuremississauga.com/gallery.html',hash:'',reload() { reloads++; }},window:windowState,
    fetch: path => data.promise.then(() => ({ok:true,json: async () => structuredClone(path.includes('districts') ? districtData : pictureData)})),
    loadEditionPlates: async () => new Map(), editionPreview: info => info,
    refreshPictureAssets: async () => { await metadata.promise; },
    createImagePreview: () => ({show: info => shows.push(info), setViews() {},setSequence() {}}),
    installSkylineScenarios(select, mapLink, render) { select.addEventListener("change", render); render(); },
    downtownAerial, presentationCaption: () => [node(),node()], renderImageAttribution() {},
    mediaPreviewInfo, comparisonPair, assetURL, buildGalleryCatalogue,filterGallery,galleryViews,updateCleanImageCaption(){},bindComparison() {},
    loadGallery: () => {
      loads++;
      initialization = failedImport ? Promise.reject(new Error('Module unavailable')) : vm.runInContext('(async () => {' + source + '\n})()', context);
      return initialization;
    },
  });
  if (bootstrap) {
    vm.runInContext(entry.replace(galleryImports[0][0], 'loadGallery()'), context);
  } else context.loadGallery();
  return {hero, buttons, shows, notices, data, metadata, click,
    interaction(type){for(const callback of windowListeners.get(type)||[])callback();},
    get manuallyMoved(){return windowState.fmGalleryNavigation?.manual;},
    get loads() { return loads; }, get reloads() { return reloads; },
    get captureListeners() { return (listeners.get('click') || []).filter(row => row.capture).length; },
    ready() {
      document.readyState = 'interactive';
      for (const row of [...listeners.get('DOMContentLoaded') || []]) {
        if (row.once) document.removeEventListener('DOMContentLoaded', row.callback);
        row.callback();
      }
    },
    async complete() { data.resolve(); await tick(); metadata.resolve(); await initialization; await tick(); },
  };
}

test('manual movement is remembered before gallery data loads and a new hash starts a new navigation',()=>{
 const h=harness();
 assert.equal(h.manuallyMoved,false);
 for(const event of ['wheel','touchstart','pointerdown','keydown']){
  h.interaction(event);assert.equal(h.manuallyMoved,true,event);
  h.interaction('hashchange');assert.equal(h.manuallyMoved,false,'new navigation');
 }
});

test('the original initialization loses a hero click while its data is pending', async () => {
  const h = harness({bootstrap: false});
  h.click(h.hero); await h.complete();
  assert.equal(h.shows.length, 0);
  h.click(h.hero); assert.equal(h.shows.length, 1);
});

test('an early click is kept through data and media metadata waits and opens exactly once', async () => {
  const h = harness();
  h.click(h.hero); assert.equal(h.hero.attributes['aria-busy'], 'true');
  assert.equal(h.loads, 0); h.ready();
  h.data.resolve(); await tick(); assert.equal(h.shows.length, 0);
  h.metadata.resolve(); await tick();
  assert.equal(h.shows.length, 1); assert.equal(h.shows[0].area, 'Downtown');
  assert.equal(h.shows[0].src, mediaPreviewInfo(pictureData.images['downtown-skyline-future.png']).src);
  assert.equal(h.hero.attributes['aria-busy'], undefined);
  assert.equal(h.captureListeners, 0);
  h.click(h.hero); assert.equal(h.shows.length, 2);
  h.ready(); assert.equal(h.loads, 1);
});

test('multiple loading clicks yield one pending open and do not reopen after ordinary clicks', async () => {
  const h = harness(); h.ready();
  h.click(h.hero); h.click(h.hero); h.click(h.hero);
  await h.complete(); assert.equal(h.shows.length, 1);
  h.click(h.hero); assert.equal(h.shows.length, 2);
  await tick(); assert.equal(h.shows.length, 2);
});

test('no pending interaction opens a modal on its own', async () => {
  const h = harness(); h.ready(); await h.complete();
  assert.equal(h.shows.length, 0); assert.equal(h.captureListeners, 0);
  h.click(h.hero); assert.equal(h.shows.length, 1);
});

for (const failedImport of [false, true]) test((failedImport ? 'module' : 'metadata') + ' failure gives explicit reload recovery and removes capture', async () => {
  const h = harness({failedImport}); h.click(h.hero); h.ready();
  if (!failedImport) { h.data.resolve(); await tick(); h.metadata.reject(new Error('Metadata unavailable')); }
  await tick();
  assert.equal(h.captureListeners, 0); assert.equal(h.hero.disabled, true);
  assert.equal(h.hero.attributes['aria-busy'], undefined); assert.equal(h.shows.length, 0);
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].attributes.role, 'alert');
  assert.match(h.notices[0].children[0], /Pictures could not load/);
  h.notices[0].children[1].click(); assert.equal(h.reloads, 1);
});

test('capture loads before any visible picture and gallery initialization has only one owner', () => {
  const html = fs.readFileSync(new URL('gallery.html', pub), 'utf8');
  const tags = [...html.matchAll(/<script\s+src=(['"])gallery-entry\.js(?:\?[^'"]*)?\1><\/script>/g)];
  assert.equal(tags.length, 1);
  const tag = tags[0][0];
  assert(html.indexOf(tag) < html.indexOf('id="galleryGrid"'));
  assert(!html.includes('src="gallery.js?'));
});
