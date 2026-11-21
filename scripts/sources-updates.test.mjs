import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {revealUpdateHash} from '../public/updates.js';

const publicRoot = new URL('../public/', import.meta.url);
const read = path => fs.readFileSync(new URL(path, publicRoot), 'utf8');
const sources = read('sources.html');
const updates = read('updates.html');

test('Sources removes the false tab strip while preserving real download and source destinations', () => {
  assert.doesNotMatch(sources, /sources-jumps|sources\.js/);
  assert.equal(fs.existsSync(new URL('sources.js', publicRoot)), false);
  const catalogue = JSON.parse(read('data/document-previews-20261120.json'));
  const currentAtlas = catalogue.documents.at(-1);
  assert.equal(currentAtlas.pages, JSON.parse(read('data/city-plates-20261120.json')).atlasPages);
  assert(sources.includes(currentAtlas.pages + ' pages · PDF'));
  assert.equal(currentAtlas.zoomWidth, 2880);
  assert(currentAtlas.pageSections.some(section => section.label === 'How to read the city'));
  assert(currentAtlas.pageLinks[2].filter(link => link.page > 2).length >= 20);
  const currentPDF = fs.readFileSync(new URL(currentAtlas.url, publicRoot));
  assert.equal(createHash('sha256').update(currentPDF).digest('hex'), currentAtlas.sourceSHA256);
  assert(catalogue.documents.some(doc => doc.url === 'downloads/Future-Mississauga-Atlas-20261101-3ec6b565b82d.pdf'));
  assert(fs.existsSync(new URL('downloads/Future-Mississauga-Atlas-20261101-3ec6b565b82d.pdf', publicRoot)));
  for (const href of [
    currentAtlas.url,
    'social.html', 'explore.html#research', 'downloads/project-register.csv',
    'downloads/municipal-source-audit.csv', 'downloads/Refinement-notes.md',
    'downloads/Model-guide.md', 'downloads/Citywide-image-credits-20261101.txt',
    'downloads/Model-study-credits.txt', 'gallery/revision-20261109/Source-credits.txt', 'licenses/CREDITS.md',
    'downloads/City-of-Mississauga-Open-Data-Terms.pdf',
    'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data',
    'https://data.ontario.ca/en/dataset/ontario-digital-terrain-model-lidar-derived',
    'https://www.ontario.ca/page/open-government-licence-ontario',
    'https://www.openstreetmap.org/copyright', 'https://opendatacommons.org/licenses/odbl/1-0/'
  ]) assert(sources.includes('href="'+href+'"'), href);
  const atlas = [...sources.matchAll(/<a\b[^>]+href="downloads\/edition-20261120\/Mississauga-Atlas\.pdf[^>]*>/g)].map(m=>m[0]);
  assert(atlas.some(tag=>/data-document-preview/.test(tag) && !/\sdownload(?:\s|>)/.test(tag)));
  assert(atlas.some(tag=>/data-download/.test(tag) && /\sdownload(?:\s|>)/.test(tag)));
  assert.match(sources, /Contains information licensed under the Open Government Licence – Ontario\./);
  assert.match(sources, /© OpenStreetMap · ODbL 1\.0/);
  assert.match(sources, /Credits do not grant permission to reuse the original work/);
});

test('current source cards preview and download the matching city editions', () => {
  const current = JSON.parse(read('data/city-plates-20261120.json')).plates;
  const historical = JSON.parse(read('data/native-media-20261102.json')).images;
  for (const [id, identity] of [['citywide-image', 'wide/citywide-future.png'],
                                ['portrait-images', 'portraits/port-credit-portrait-future.png']]) {
    const card = sources.split('id="' + id + '"')[1].split('</article>')[0];
    const plate = current.find(item => item.id === identity);
    const old = historical.find(item => item.identity === identity);
    assert(card.includes('data-edition-plate="' + identity + '"'));
    assert(card.includes('src="' + plate.thumbnail + '"') && card.includes(plate.webImage + ' ' + plate.width + 'w'));
    assert(card.includes('href="' + plate.displayMaster.url + '"') && card.includes('aria-haspopup="dialog"'));
    assert(card.includes('data-preview-download="' + plate.download.url + '"'));
    assert(card.includes('href="' + plate.download.url + '" download data-download'));
    assert(!card.includes(old.displayMaster.url) && !card.includes(old.download.url));
    for (const asset of [plate.displayMaster, plate.download]) {
      const contents = fs.readFileSync(new URL(asset.url, publicRoot));
      assert.equal(contents.length, asset.bytes);
      assert.equal(createHash('sha256').update(contents).digest('hex'), asset.sha256);
    }
    for (const credit of plate.attribution.requiredModelCredits) assert(card.includes(credit));
  }
  const downtown = sources.split('id="downtown-print"')[1].split('</p>')[0];
  assert(downtown.includes('20 November 2026'));
  for (const url of ['gallery/edition-20261120/originals/home-downtown-future-print.png',
                     'downloads/edition-20261120/Downtown-future-print.pdf']) {
    assert(downtown.includes('href="' + url + '" download data-download'));
    assert(fs.existsSync(new URL(url, publicRoot)));
  }
});

test('all active building booklets have matching downloads, page previews, searchable text and credits', () => {
  const catalogue = JSON.parse(read('data/document-previews-20261120.json'));
  const texts = JSON.parse(gunzipSync(Buffer.from(read('document-page-text-20261120.txt'), 'base64')));
  const downloads = read('downloads.html');
  const booklets = catalogue.documents.filter(doc => doc.url.startsWith('downloads/edition-20261120/') && doc.url.endsWith('-review.pdf'));
  assert.equal(booklets.length, 11);
  for (const book of booklets) {
    const pdf = fs.readFileSync(new URL(book.url, publicRoot));
    assert.equal(createHash('sha256').update(pdf).digest('hex'), book.sourceSHA256, book.title);
    assert.equal(book.pages, 4);
    assert(downloads.includes(`href="${book.url}" data-document-preview`));
    assert(downloads.includes(`href="${book.url}" download data-download`));
    const text = texts[catalogue.documents.indexOf(book)];
    assert.equal(text.length, book.pages);
    for (let index = 0; index < book.pages; index++) {
      const image = `${book.base}${book.prefix}${String(index + 1).padStart(2, '0')}.avif`;
      assert(fs.statSync(new URL(image, publicRoot)).size > 0, image);
      assert(text[index].includes(book.title), book.title);
    }
    assert.match(text[3], /References and credits/);
    assert.match(text[3], /View in Google Maps/);
  }
});

test('the Sources atlas cover opens the same current document as its separate download', () => {
  const document = JSON.parse(read('data/document-previews-20261120.json')).documents.at(-1);
  const card = sources.match(/<article\b[^>]*id="picture-atlas"[\s\S]*?<\/article>/)?.[0];
  assert(card, 'the atlas is a visual resource');
  const preview = card.match(/<a\b[^>]*data-document-preview[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert(preview?.includes('href="' + document.url + '"'));
  assert(!/\sdownload(?:\s|>)/.test(preview), 'activating the cover previews the document');
  const cover = document.base + document.prefix + '01.avif';
  assert(preview.includes('src="' + cover + '"'));
  assert(fs.existsSync(new URL(cover, publicRoot)));
  assert(card.includes('href="' + document.url + '" download data-download'));
});

test('the November 9 update keeps its own dated skyline and atlas as the current release changes', () => {
  const row = JSON.parse(read('data/presentation-media-20261109.json')).images.find(row => row.identity === 'wide/downtown-skyline-future.png');
  const story = updates.match(/<article\b[^>]*id="november-9-downtown"[\s\S]*?<\/article>/)?.[0];
  assert(story?.includes('href="' + row.displayMaster.url + '"'));
  assert(story.includes('data-preview-download="' + row.download.url + '"'));
  assert(!/<a[^>]*\sdownload(?:\s|>)/.test(story), 'ordinary image activation remains a preview');
  for (const image of row.responsivePreviews.filter(image => image.mimeType === 'image/avif')) {
    assert(story.includes(image.url + ' ' + image.dimensions[0] + 'w'));
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(image.url, publicRoot))).digest('hex'), image.sha256);
  }
  const atlas = JSON.parse(read('data/document-previews-20261109.json')).documents.at(-1);
  assert(story.includes('href="' + atlas.url + '" data-document-preview'));
  assert(story.includes('datetime="2026-11-09"'));
  assert(updates.includes('Preview the 1 November atlas'));
  assert.doesNotMatch(updates, /appeal periods remain open through October 28/i);
  assert.match(updates, /The official-plan amendment took effect on 29 October 2026/);
  assert.match(updates, /10 November register lists the zoning amendment as in force/);
  assert.match(updates, /Construction permission and timing remain unverified/);
});

test('Updates binds its accepted native image and historical images to dates, credits, and shared previews', () => {
  const stories = updates.slice(updates.indexOf('<div class="update-stories"'), updates.indexOf('<div class="update-notices"'));
  const pins = new Map([
    ['assets/ergocentric-20261028/275-Superior-frontage-after.png','a8cf3366ea6dd27e8219c80f265fda1cc684396bfb48c424826fa2adf8abc5fd']
  ]);
  const downtown=JSON.parse(read('data/native-media-20261102.json')).images.find(row=>row.identity==='wide/downtown-future.png');
  assert(downtown,'the native story uses an accepted current identity');
  const preview=downtown.responsivePreviews.find(row=>row.mimeType==='image/avif'&&row.dimensions[0]===1200);
  assert.equal(preview.sourceSHA256,downtown.displayMaster.sha256);
  pins.set(preview.url,preview.sha256);
  const citywide=JSON.parse(read('data/native-media-20261102.json')).images.find(row=>row.identity==='wide/citywide-future.png');
  const fairview=JSON.parse(read('data/neighbourhood-media-20261102.json')).images.find(row=>row.identity==='neighbourhood/fairview/after');
  assert(citywide&&fairview,'both stories use exact current identities');
  assert.equal(fairview.scenario,'existing');assert.equal(fairview.caption.comparisonState,'after');
  for(const [id,row]of [['november-1-citywide',citywide],['october-28-fairview',fairview]]){
    const avif=row.responsivePreviews.find(asset=>asset.mimeType==='image/avif'&&asset.dimensions[0]===1200);
    assert.equal(avif.sourceSHA256,row.displayMaster.sha256);pins.set(avif.url,avif.sha256);
    const story=[...stories.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match=>match[0]).find(block=>block.includes('id="'+id+'"'));
    assert(story?.includes('src="'+avif.url+'"'));assert(story.includes('href="'+row.displayMaster.url+'"'));
    assert(!story.includes('href="'+row.download.url+'"'),'story image remains a clean preview');
    for(const asset of row.responsivePreviews.filter(asset=>asset.mimeType==='image/avif'))assert(story.includes(asset.url+' '+asset.dimensions[0]+'w'));
  }
  // Earlier URLs retain their exact historical edition even though these
  // story placements now use newly accepted native views.
  for(const [url,hash]of [
    ['gallery/citywide-20261101/wide-citywide-future-1200-53d496052b9c.avif','8d449988c0d56c5a97bc67385c3d3f84a92d22701bfc71b9f500bfc8741eb4a8'],
    ['assets/fairview-20261028/neighbourhood-after.png','47e4f43794d0ecd5c5611f01eb8fddd5a975a22aa972226d7f632c0361ceacd1']
  ])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(url,publicRoot))).digest('hex'),hash);

  const imgs = [...stories.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)];
  assert.equal(imgs.length, pins.size);
  assert.equal(new Set(imgs.map(match=>match[1])).size,pins.size,'every expected story has one image');
  for (const [,src] of imgs) {
    assert(pins.has(src), src);
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(src, publicRoot))).digest('hex'), pins.get(src));
  }
  const nativeStory=stories.match(/<article\b[^>]*id="november-1-model-detail"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert(nativeStory?.includes('src="'+preview.url+'"'));
  assert(nativeStory.includes('href="'+downtown.displayMaster.url+'"'),'native story opens the clean full-resolution image');
  assert(!nativeStory.includes('href="'+downtown.download.url+'"'),'image action does not download the footer version');
  assert.match(stories, /datetime="2026-11-01"/);
  assert.equal([...stories.matchAll(/datetime="2026-10-28"/g)].length, 2);
  assert.match(stories, /Existing homes around Fairview have been added/);
  assert.match(stories, /approximate facade study/);
  assert.match(stories, /David Lasker\/Cityscape Photography/);
  assert.doesNotMatch(stories, /<a[^>]*\sdownload(?:\s|>)/);
  assert.match(updates, /src="image-entry\.js\?v=[^"]+"/);
  assert.match(nativeStory, /M1–M5 have revised tower forms/);
  assert.match(nativeStory, /these approximate studies within the surrounding city/);
});

test('October archive keeps existing deep links and dated records accessible', () => {
  assert.match(updates, /<section class="update-archive" id="october-2026"[^>]*><h2 id="october-title">October 2026 archive<\/h2>/);
  for (const id of ['october-28-citywide','october-23-clearer-views','october-23-east-credit','october-22-meadowvale-village','october-22-exchange-base','october-22-source-repair','october-21-viewer','local-accuracy-review']) assert(updates.includes('id="'+id+'"'), id);
  assert.match(updates, /src="updates\.js\?v=20261102-coherent1"/);
  const ids = [...updates.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length, new Set(ids).size, 'Every hash has one target');
});

function fixture() {
  const order = [], attrs = new Map();
  const outer = {tagName:'DETAILS',parentElement:null,_open:false,set open(v){this._open=v;order.push('outer:'+v)},get open(){return this._open}};
  const inner = {tagName:'DETAILS',parentElement:outer,_open:false,set open(v){this._open=v;order.push('inner:'+v)},get open(){return this._open}};
  const target = {parentElement:inner,closest:s=>s==='.recent-updates'?{}:null,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),focus:options=>{assert(outer.open&&inner.open);assert.deepEqual(options,{preventScroll:true});order.push('focus')},scrollIntoView:options=>{assert(outer.open&&inner.open);order.push('scroll')}};
  const doc = {getElementById:id=>id==='old entry'?target:null};
  return {order,outer,inner,target,doc,attrs};
}

test('deep links open all containing disclosures before focus and scroll', () => {
  const f=fixture();
  assert.equal(revealUpdateHash('#old%20entry',f.doc),true);
  assert.deepEqual(f.order,['outer:true','inner:true','focus','scroll']);
  assert.equal(f.attrs.get('tabindex'),'-1');
  f.attrs.set('tabindex','0');
  revealUpdateHash('#old%20entry',f.doc);
  assert.equal(f.attrs.get('tabindex'),'0');
});

test('missing, malformed and unrelated hashes do not change document state', () => {
  const f=fixture();
  for(const hash of ['', '#', '#missing', '#%E0%A4%A']) assert.equal(revealUpdateHash(hash,f.doc),false);
  f.target.closest=()=>null;
  assert.equal(revealUpdateHash('#old%20entry',f.doc),false);
  assert.deepEqual(f.order,[]);
});

test('initial navigation and back/forward hashes reveal entries without rewriting browser history', () => {
  const code=read('updates.js').replace('export function','function');
  const f=fixture(), handlers={};
  const location={hash:'#old%20entry',origin:'https://futuremississauga.com',pathname:'/updates.html',search:'',href:'https://futuremississauga.com/updates.html#old%20entry'};
  const context={document:{...f.doc,addEventListener:(type,fn)=>handlers['document:'+type]=fn},window:{addEventListener:(type,fn)=>handlers[type]=fn},location,URL,requestAnimationFrame:fn=>fn()};
  // The runtime fixture records focus without comparing cross-realm option prototypes.
  f.target.focus=()=>{assert(f.outer.open&&f.inner.open);f.order.push('focus')};
  vm.runInNewContext(code,context);
  assert.deepEqual(f.order,['outer:true','inner:true','focus','scroll']);
  f.outer._open=f.inner._open=false;f.order.length=0;
  handlers.hashchange();
  assert.deepEqual(f.order,['outer:true','inner:true','focus','scroll']);
  location.hash='#missing';f.order.length=0;handlers.hashchange();
  assert.deepEqual(f.order,[]);
  assert.doesNotMatch(code, /pushState|replaceState|location\.(?:hash|href)\s*=/);
});

test('a second click on the current hash reopens a manually collapsed archive once', () => {
  const code=read('updates.js').replace('export function','function');
  const f=fixture(),handlers={};
  f.target.focus=()=>f.order.push('focus');
  const location={hash:'#old%20entry',origin:'https://futuremississauga.com',pathname:'/updates.html',search:'',href:'https://futuremississauga.com/updates.html#old%20entry'};
  vm.runInNewContext(code,{document:{...f.doc,addEventListener:(type,fn)=>handlers[type]=fn},window:{addEventListener:()=>{}},location,URL,requestAnimationFrame:fn=>fn()});
  f.outer._open=f.inner._open=false;f.order.length=0;
  let prevented=0;
  const event={button:0,target:{closest:()=>({href:location.href})},preventDefault:()=>prevented++};
  handlers.click(event);
  assert.equal(prevented,1);assert.deepEqual(f.order,['outer:true','inner:true','focus','scroll']);
  f.order.length=0;handlers.click({...event,metaKey:true});assert.deepEqual(f.order,[]);
});

test('pageshow restores the fragment after the browser has applied reload scroll position',()=>{
 const code=read('updates.js').replace('export function','function');
 const f=fixture(),handlers={},frames=[];
 f.target.focus=()=>f.order.push('focus');
 const location={hash:'#old%20entry',href:'https://futuremississauga.com/updates.html#old%20entry'};
 vm.runInNewContext(code,{document:{...f.doc,addEventListener(){}},window:{addEventListener:(type,fn)=>handlers[type]=fn},location,URL,requestAnimationFrame:fn=>frames.push(fn)});
 f.order.length=0;
 handlers.pageshow();
 assert.deepEqual(f.order,[], 'wait until native scroll restoration finishes');
 assert.equal(frames.length,1);frames.shift()();
 assert.deepEqual(f.order,['outer:true','inner:true','focus','scroll']);
 location.hash='';f.order.length=0;handlers.pageshow();frames.shift()();
 assert.deepEqual(f.order,[], 'unfragmented pages retain browser restoration');
});
