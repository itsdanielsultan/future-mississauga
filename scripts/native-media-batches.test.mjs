import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {assetURL} from '../public/asset-delivery.js';
import {assertNativeMediaTransport} from './native-media-transport.mjs';
import {normalizeCleanMedia,matchedComparisonBinding,mediaScenarioLabel} from '../public/clean-media.js';

const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/';
const text=path=>fs.readFileSync(new URL(path,pub),'utf8');
const native=JSON.parse(text('data/native-media-20261102.json'));
const normalized=native.images.map(row=>normalizeCleanMedia(row,base));
const revised=JSON.parse(text('data/presentation-media-20261109.json')).images.map(row=>normalizeCleanMedia(row,base));

test('every incrementally accepted native file retains its declared bytes and dimensions',()=>{
 assert.equal(new Set(native.images.map(row=>row.identity)).size,native.images.length);
 assertNativeMediaTransport(native,pub);
 const neighbourhood=JSON.parse(text('data/neighbourhood-media-20261102.json'));
 assert.equal(native.images.length,57);assert.equal(neighbourhood.images.length,2);
 assertNativeMediaTransport(neighbourhood,pub);
 assert.doesNotMatch(JSON.stringify(native),/\/Users\/|\/private\/|\/tmp\/|file:\/\/|"path"/);
});

test('four existing and ten future Downtown views enter the gallery without replacing dated construction',()=>{
 const downtown=native.images.filter(row=>row.identity.includes('/downtown-')&&row.scenario!=='construction');
 assert.equal(downtown.length,14);
 assert.equal(downtown.filter(row=>row.scenario==='existing').length,4);
 assert.equal(downtown.filter(row=>row.scenario==='future').length,10);
 const wide=downtown.find(row=>row.identity==='wide/downtown-future.png');
 assert.equal(wide.displayMaster.sha256,'352ff7f55ac6a1210275505fe3c3d0526825c6f2debb1708668dcd64ce8c8ef4');
 assert.equal(wide.download.sha256,'03b97aabde31dd3530decb0f4496536c47f4fb506b8c3ad87c79cd3cf4c0186e');
 assert.deepEqual(wide.displayMaster.dimensions,[6144,3840]);
 assert.deepEqual(wide.download.dimensions,[6144,4415]);
});

test('both refreshed construction skylines retain their dated construction scenario',()=>{
 const rows=normalized.filter(row=>row.kind==='wide'||row.kind==='portraits').filter(row=>row.file==='downtown-skyline-construction.png');
 assert.equal(rows.length,2);
 for(const row of rows){
  assert.equal(row.caption.scenario,'construction');assert.equal(mediaScenarioLabel(row),'Dated construction');
  assert.equal(row.renderInfo.sourceDatesMixed,true);assert.equal(row.renderInfo.sourceModelDate,null);
  assert.equal(row.renderInfo.renderDate,'2026-11-01');
 }
 assert(text('gallery.js').includes("constructionSkyline:'Dated construction skyline'"));
});

test('each current Social article points to the clean master and a separate footer download',()=>{
 const cards=[...text('social.html').matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match=>match[0]);
 assert.equal(cards.length,24);
 for(const row of native.images.filter(row=>row.identity.startsWith('portraits/'))){
  const card=cards.find(value=>value.includes('data-display-url="'+row.displayMaster.url+'"'));
  assert(card,row.identity);
  assert(card.includes('class="image-link" href="'+row.displayMaster.url+'"'));
  assert(card.includes('class="save" href="'+row.download.url+'" download'));
  const preview=row.responsivePreviews.find(a=>a.mimeType==='image/avif'&&a.dimensions[0]===1200);
  assert(card.includes('src="'+preview.url+'"'));
  assert(card.includes('City of Mississauga · Ontario data'));
  assert.doesNotMatch(card,/social-note|Rendered|Earlier render/);
  assert.equal(card.includes('© OpenStreetMap contributors'),row.caption.openStreetMap);
 }
});

test('every activated comparison has a byte-exact proof and equal resolution derivatives',()=>{
 assert(native.comparisonProofs.length>=2);
 for(const reference of native.comparisonProofs){
  const bytes=fs.readFileSync(new URL(reference.url,pub));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.sha256);
  const proof=JSON.parse(bytes),binding=matchedComparisonBinding(normalized,proof,reference.sha256);
  assert.equal(binding.proofID,reference.proofID);
  assert.deepEqual(binding.responsiveDimensions,[3200,2000]);
 }
});

function image(){return {dataset:{},src:'old.avif',srcset:'old.avif 3200w',sizes:'100vw',removeAttribute(name){delete this[name];},getAttribute(name){return this[name]??null;},closest(selector){return selector==='.picture-compare'?{}:null;}};}

test('gallery selection explicitly resets the density of a reused comparison image',()=>{
 const source=text('gallery.js').match(/function showComparison\(id\)[\s\S]*?(?=\n\$\('#comparisonDistrict'\))/)[0];
 const before=image(),after=image(),pair=normalized.filter(row=>['wide/clarkson-existing.png','wide/clarkson-future.png'].includes(row.identity)).sort((a,b)=>a.caption.scenario.localeCompare(b.caption.scenario));
 vm.runInNewContext(source+"\nshowComparison('clarkson');",{$:selector=>selector==='#beforePicture img'?before:after,districts:[{id:'clarkson',name:'Clarkson'}],pictures:{},comparisonPair:()=>pair});
 for(const [node,row]of [[before,pair[0]],[after,pair[1]]]){
  assert.equal(node.src,row.responsive.url);assert.equal(node.srcset,row.responsive.url+' 1x');assert.equal(node.sizes,undefined);
 }
});

test('the responsive enhancer preserves a fixed comparison candidate at one-times density',async()=>{
 const row=normalized.find(row=>row.identity==='wide/clarkson-future.png'),node=image();node.src=row.preview.url;
 const index=new Map([[node.src,row]]),document={querySelectorAll:s=>s==='img'?[node]:[],querySelector:()=>({}),body:{}};
 const source=text('media-catalog.js').slice(text('media-catalog.js').indexOf('export async function installResponsiveImages')).replace('export async','async');
 await vm.runInNewContext(source+'\ninstallResponsiveImages();',{catalogIndex:Promise.resolve(index),clean:value=>value,document,assetURL,HTMLImageElement:class{},MutationObserver:class{observe(){}}});
 assert.equal(node.src,row.responsive.url);assert.equal(node.srcset,row.responsive.url+' 1x');assert.equal(node.sizes,undefined);
});

test('ordinary inline images cap their source candidates at the largest AVIF; native PNG stays modal-only',async()=>{
 const row=normalized.find(row=>row.identity==='wide/downtown-future.png'),node=image();node.src=row.preview.url;node.closest=()=>null;
 const index=new Map([[node.src,row]]),document={querySelectorAll:s=>s==='img'?[node]:[],querySelector:()=>({}),body:{}};
 const source=text('media-catalog.js').slice(text('media-catalog.js').indexOf('export async function installResponsiveImages')).replace('export async','async');
 await vm.runInNewContext(source+'\ninstallResponsiveImages();',{catalogIndex:Promise.resolve(index),clean:value=>value,document,assetURL,HTMLImageElement:class{},MutationObserver:class{observe(){}}});
 assert.equal(node.srcset,`${row.preview.url} 1200w, ${row.responsive.url} 3200w`);
 assert(!node.srcset.includes(row.displayMaster.url));assert.equal(row.displayMaster.width,6144);
});

test('each homepage panorama pairs the current scene, clean preview and footer download by its logical key',()=>{
 const source=text('gallery.js').match(/function refreshPanorama\(figure,row\)\{[\s\S]*?\n\}/)[0];
 const html=text('index.html');
 for(const scenario of ['existing','construction','future']){
  const file='downtown-skyline-'+scenario+'.png',row=revised.find(row=>row.kind==='wide'&&row.file===file);
  const image={},preview={},download={},figure={querySelector:selector=>selector==='img'?image:selector==='a[download]'?download:preview};
  vm.runInNewContext(source+'\nrefreshPanorama(figure,row);',{figure,row:{...row,display:row.preview},assetURL});
  assert.equal(image.src,row.preview.url);assert.equal(preview.href,assetURL(row.displayMaster.url));assert.equal(download.href,assetURL(row.download.url));
  assert(html.includes('data-picture="'+file+'"'));
 }
});

test('responsive enhancement keeps clean image anchors separate from explicit downloads',async()=>{
 const row=revised.find(row=>row.identity==='wide/downtown-future.png');
 const anchor=download=>({href:row.displayMaster.url,hasAttribute:name=>name==='download'&&download,classList:{contains:()=>false},querySelector:()=>download?null:{}});
 const preview=anchor(false),download=anchor(true),index=new Map([[row.displayMaster.url,row]]);
 const document={querySelectorAll:s=>s==='a[href]'?[preview,download]:[],querySelector:()=>({}),body:{}};
 const source=text('media-catalog.js').slice(text('media-catalog.js').indexOf('export async function installResponsiveImages')).replace('export async','async');
 await vm.runInNewContext(source+'\ninstallResponsiveImages();',{catalogIndex:Promise.resolve(index),clean:value=>value,document,assetURL,HTMLImageElement:class{},MutationObserver:class{observe(){}}});
 assert.equal(preview.href,assetURL(row.displayMaster.url));assert.equal(download.href,assetURL(row.download.url));
});
