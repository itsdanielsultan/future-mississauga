import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pictureProvenance} from '../public/image-provenance.js';

const read=path=>JSON.parse(fs.readFileSync(new URL('../public/'+path,import.meta.url)));
const historical=read('data/labelled-image-assets.json'),pictures=read('data/picture-assets.json'),actual=read('data/citywide-media-20261028.json');
const base='https://futuremississauga.com/';
const requests=[],previousFetch=globalThis.fetch;
globalThis.fetch=async url=>{requests.push(url);return new Response(JSON.stringify(historical));};
globalThis.location={href:base};
const {integrateCurrentCitywide,indexMedia,refreshCatalogPictures,mediaCatalog,loadMediaCatalog}=await import('../public/media-catalog.js?test=current-citywide');
await mediaCatalog;globalThis.fetch=previousFetch;

// Synthetic pixels are deliberately different in dimensions and hashes. No fixture
// identity is used in a public catalogue or claimed as an approved render.
function fixture(){
 const masterSHA='a'.repeat(64);
 const asset=(name,width,height,sha,format='image/png')=>({url:'gallery/citywide-test/'+name,width,height,sha256:sha,bytes:123,format});
 return {kind:'wide',file:'citywide-future.png',title:'Citywide',area:'Citywide',aliases:[],
  renderInfo:{state:'new-render',renderDate:'2026-10-28',sourceDatesMixed:true,sourceModelDate:null,sourceEdition:'Mixed-date test assembly',renderKey:'wide/citywide/future/aerial'},
  sourceAttribution:{openStreetMap:true,creditLines:['Synthetic test attribution']},
  displayMaster:asset('display-new.png',4800,3000,masterSHA),download:asset('new.png',4800,3000,'b'.repeat(64)),
  preview:{...asset('new-1200.avif',1200,750,'c'.repeat(64),'image/avif'),sourceSHA256:masterSHA},
  responsive:{...asset('new-3200.avif',3200,2000,'d'.repeat(64),'image/avif'),sourceSHA256:masterSHA},
  presentationInfo:{type:'new-still-assembly',newGeometryOrMaterials:true}};
}

test('catalogue requests the exact new version beside the unchanged historical catalogue',()=>{
 assert.deepEqual(requests,['data/labelled-image-assets.json','data/citywide-media-20261028.json']);assert.equal(mediaCatalog instanceof Promise,true);
});

test('current Citywide uses new pixel URLs while every historical alias retains its exact edition',()=>{
 const snapshot=structuredClone(historical),row=fixture();
 const integrated=integrateCurrentCitywide(historical,row,base),before=indexMedia(historical,base),after=indexMedia(integrated,base);
 assert.deepEqual(historical,snapshot);assert.equal(integrated.images,historical.images);
 for(const [url,record]of before)assert.equal(after.get(url),record,url);
 for(const key of ['preview','responsive','displayMaster','download'])assert.equal(after.get(new URL(row[key].url,base).href).renderInfo.renderDate,'2026-10-28');
 row.renderInfo.renderDate='2099-01-01';assert.equal(integrated.currentCitywide.renderInfo.renderDate,'2026-10-28','integration takes its own current record');
 const old=historical.images.find(item=>item.file==='citywide-future.png');
 assert.equal(after.get(new URL(old.download.url,base).href).renderInfo.renderDate,'2026-10-04');
});

test('gallery selection merges new dimensions and provenance without stale camera metadata or a history rewrite',()=>{
 const integrated=integrateCurrentCitywide(historical,fixture(),base),input=structuredClone(pictures);
 const ordinary=refreshCatalogPictures(structuredClone(pictures),historical),current=refreshCatalogPictures(input,integrated);
 const row=current.images['citywide-future.png'];
 assert.equal(current,input);assert.equal(row.width,4800);assert.equal(row.height,3000);
 assert.equal(row.url,integrated.currentCitywide.download.url);assert.equal(row.sha256,'b'.repeat(64));
 assert.equal(row.display.url,integrated.currentCitywide.preview.url);assert.equal(row.displayMaster.width,4800);
 assert.deepEqual(row.renderInfo,integrated.currentCitywide.renderInfo);assert.deepEqual(row.sourceAttribution,integrated.currentCitywide.sourceAttribution);
 assert.equal(row.nativeOriginal,undefined,'an absent raw master cannot inherit the historical geometry');
 assert.equal(row.presentationInfo.type,'new-still-assembly');assert.equal(row.presentationInfo.cameraChanged,undefined);
 for(const [name,record]of Object.entries(ordinary.images))if(name!=='citywide-future.png')assert.deepEqual(current.images[name],record,name);
 const shown=pictureProvenance(row.renderInfo,row.width);
 assert.equal(shown.meta,'Rendered 28 Oct 2026 · 5K PNG');assert.equal(shown.sourceEdition,'Model sources vary by date');assert.equal(shown.notice,'');
 assert.deepEqual(refreshCatalogPictures(structuredClone(current),integrated),current,'reapplying current selection is idempotent');
 const withoutPresentation=fixture();delete withoutPresentation.presentationInfo;
 const selected=refreshCatalogPictures(structuredClone(pictures),integrateCurrentCitywide(historical,withoutPresentation,base));
 assert.equal(selected.images['citywide-future.png'].presentationInfo,undefined,'an old camera/footer record cannot describe the new source assembly');
});

test('a supplied current raw master keeps its own identity while historical native provenance stays unchanged',()=>{
 const row=fixture();row.nativeOriginal={url:'gallery/citywide-test/raw-new.png',sha256:'e'.repeat(64),bytes:456,width:4800,height:3000,format:'image/png'};
 const oldNative=structuredClone(pictures.images['citywide-future.png'].nativeOriginal);
 const integrated=integrateCurrentCitywide(historical,row,base);
 const selected=refreshCatalogPictures(structuredClone(pictures),integrated).images['citywide-future.png'];
 assert.deepEqual(selected.nativeOriginal,row.nativeOriginal);
 assert.notEqual(selected.nativeOriginal.sha256,oldNative.sha256);
 assert.deepEqual(pictures.images['citywide-future.png'].nativeOriginal,oldNative);
 assert.equal(indexMedia(integrated,base).get(new URL(historical.images.find(item=>item.file==='citywide-future.png').download.url,base).href).renderInfo.renderDate,'2026-10-04');
});

test('a current overlay cannot repurpose a historical pixel URL through query strings or aliases',()=>{
 const old=historical.images.find(item=>item.file==='citywide-future.png');
 for(const url of [...old.aliases,old.preview.url,old.responsive.url,old.displayMaster.url,old.download.url]){
  const row=fixture();row.download.url=url+'?edition=new#new';
  assert.throws(()=>integrateCurrentCitywide(historical,row,base),/new URLs/);
 }
 const alias=fixture();alias.aliases=[old.download.url];assert.throws(()=>integrateCurrentCitywide(historical,alias,base),/without historical aliases/);
});

test('wrong view, missing mixed-source evidence and mismatched preview bytes fail before selection',()=>{
 for(const mutate of [
  row=>{row.file='downtown-future.png';},row=>{row.renderInfo.sourceDatesMixed=false;},
  row=>{row.renderInfo.sourceModelDate='2026-10-28';},row=>{row.renderInfo.state='retained-earlier';},
  row=>{delete row.sourceAttribution;},row=>{row.responsive.sourceSHA256='e'.repeat(64);},
  row=>{row.preview.height=751;},row=>{row.download.width=6144;},row=>{row.download.sha256='unknown';},
  row=>{row.download.url='javascript:alert(1)';}
 ]){const row=fixture();mutate(row);assert.throws(()=>integrateCurrentCitywide(historical,row,base));}
 assert.equal(historical.currentCitywide,undefined);
});

test('mixed-source presentation cannot accidentally show a single as-built date',()=>{
 assert.equal(pictureProvenance({sourceDatesMixed:true,sourceModelDate:'2026-10-28'},3840).sourceEdition,'Model sources vary by date');
 assert.equal(pictureProvenance({sourceModelDate:'2026-10-21'},6144).sourceEdition,'Model version: 21 Oct 2026');
 assert.match(pictureProvenance(pictures.images['citywide-future.png'].renderInfo,3840).notice,/earlier view/);
});


test('the actual approved Citywide package selects current pixels and dates while old URLs retain October 4',async()=>{
 const snapshot=structuredClone(historical);
 const loaded=await loadMediaCatalog(async url=>new Response(JSON.stringify(url==='data/labelled-image-assets.json'?historical:actual)),{baseURL:base});
 assert.equal(loaded.currentCitywide.download.sha256,actual.image.download.sha256);
 for(const key of ['preview','responsive','displayMaster','download']){
  const asset=actual.image[key],bytes=fs.readFileSync(new URL('../public/'+asset.url,import.meta.url));
  assert.equal(bytes.length,asset.bytes,key);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,key);
  if(asset.format==='image/png'){assert.equal(bytes.readUInt32BE(16),asset.width);assert.equal(bytes.readUInt32BE(20),asset.height);}
 }
 const current=refreshCatalogPictures(structuredClone(pictures),loaded).images['citywide-future.png'];
 assert.equal(current.width,3840);assert.equal(current.height,2400);assert.equal(current.renderInfo.renderDate,'2026-10-28');
 assert.equal(current.nativeSource.sha256,actual.nativeRenderSHA256);assert.equal(current.nativeOriginal,undefined);
 assert.equal(current.sourceAttribution.photoReference.name,'David Lasker/Cityscape Photography');
 const shown=pictureProvenance(current.renderInfo,current.width);
 assert.equal(shown.meta,'Rendered 28 Oct 2026 · 4K PNG');assert.equal(shown.sourceEdition,'Model sources vary by date');assert.equal(shown.notice,'');
 const index=indexMedia(loaded,base),old=historical.images.find(row=>row.file==='citywide-future.png');
 for(const url of [...old.aliases,old.download.url,old.displayMaster.url]){
  const record=index.get(new URL(url,base).href);assert.equal(record.renderInfo.renderDate,'2026-10-04');assert.match(pictureProvenance(record.renderInfo,record.download.width).notice,/earlier view/);
 }
 assert.deepEqual(historical,snapshot);
});

test('new-edition HTTP, decoding, schema or identity failure falls back to the complete historical catalogue',async()=>{
 const invalid=structuredClone(actual);invalid.image.download.url=historical.images[0].download.url;
 for(const currentResponse of [
  async()=>new Response('',{status:503}),async()=>{throw new Error('Offline');},async()=>new Response('{broken'),
  async()=>new Response(JSON.stringify({...actual,schema:'wrong-schema'})),async()=>new Response(JSON.stringify(invalid))
 ]){
  const loaded=await loadMediaCatalog(async url=>url==='data/labelled-image-assets.json'?new Response(JSON.stringify(historical)):currentResponse(),{baseURL:base});
  assert.deepEqual(loaded,historical);assert.equal(loaded.currentCitywide,undefined);
 }
});

test('optional current-edition fetch and JSON body reading are bounded without losing the old gallery',async()=>{
 for(const stalledBody of [false,true]){
  let signal;
  const loaded=await loadMediaCatalog(async(url,options)=>{
   if(url==='data/labelled-image-assets.json')return new Response(JSON.stringify(historical));
   signal=options.signal;
   return stalledBody?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{});
  },{baseURL:base,currentTimeoutMs:15});
  assert.deepEqual(loaded,historical);assert.equal(signal.aborted,true);
 }
});
