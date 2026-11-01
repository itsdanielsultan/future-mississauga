import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,pub)));
const historical=read('data/labelled-image-assets.json'),downtown=read('data/downtown-media-20261101.json'),citywide=read('data/citywide-media-20261101.json');
const savedFetch=globalThis.fetch;globalThis.location={href:base};
const fetcher=async url=>new Response(JSON.stringify(url.includes('labelled-image')?historical:url.includes('downtown-media')?downtown:citywide));
globalThis.fetch=fetcher;
const {mediaCatalog,indexMedia,refreshCatalogPictures,integrateCurrentPictures,loadMediaCatalog}=await import('../public/media-catalog.js?test=november-downtown');
const loaded=await mediaCatalog;globalThis.fetch=savedFetch;
const key=row=>row.kind+'/'+row.file;

test('twelve new Downtown views preserve every historical pixel identity and all four retained views',()=>{
 assert.equal(downtown.images.length,12);assert.equal(new Set(downtown.images.map(key)).size,12);
 assert.equal(downtown.retainedDowntownIdentities.length,4);
 assert.equal(loaded.currentPictures.length,12);assert.equal(loaded.currentCitywide.renderInfo.renderDate,'2026-11-01');
 const before=indexMedia(historical,base),after=indexMedia(loaded,base);
 for(const [url,row] of before)assert.deepEqual(after.get(url),row,url);
 for(const row of downtown.images){assert.deepEqual(row.aliases,[]);assert.equal(row.renderInfo.renderDate,'2026-11-01');assert.equal(row.renderInfo.sourceModelDate,null);assert.equal(row.renderInfo.sourceDatesMixed,true);
  for(const field of ['preview','responsive','displayMaster','download'])assert.deepEqual(after.get(new URL(row[field].url,base).href),row);
 }
 for(const id of downtown.retainedDowntownIdentities){assert(!downtown.images.some(row=>key(row)===key(id)));const row=historical.images.find(row=>key(row)===key(id));assert(row);assert.notEqual(row.renderInfo.renderDate,'2026-11-01');assert.deepEqual(after.get(new URL(row.download.url,base).href),row);}
});

test('gallery views and comparisons use fresh metadata while historical-only selections stay unchanged',()=>{
 const pictures=read('data/picture-assets.json');const old=refreshCatalogPictures(structuredClone(pictures),historical),current=refreshCatalogPictures(structuredClone(pictures),loaded);
 const selected=new Map(downtown.images.filter(row=>row.kind==='wide').map(row=>[row.file,row]));
 for(const [file,row] of Object.entries(current.images)){
  if(file==='citywide-future.png')continue;
  const expected=selected.get(file);
  if(expected){assert.equal(row.url,expected.download.url);assert.equal(row.displayMaster.url,expected.displayMaster.url);assert.deepEqual(row.renderInfo,expected.renderInfo);assert.equal(row.width,6144);assert.equal(row.presentationInfo,undefined);}
  else assert.deepEqual(row,old.images[file],file);
 }
 assert.equal(current.images['downtown-existing.png'].height,3840);assert.equal(current.images['downtown-future.png'].height,3840);
 assert.deepEqual(refreshCatalogPictures(structuredClone(current),loaded),current);
});

test('known current image URLs are never allowed to rebind old pixels or duplicate a view',()=>{
 const row=structuredClone(downtown.images[0]);row.download.url=historical.images[0].download.url+'?edition=new';
 assert.throws(()=>integrateCurrentPictures(historical,[row],base),/new URLs/);
 assert.throws(()=>integrateCurrentPictures(historical,[downtown.images[0],downtown.images[0]],base),/Duplicate/);
 const broken=structuredClone(downtown.images[0]);broken.responsive.sourceSHA256='0'.repeat(64);
 assert.throws(()=>integrateCurrentPictures(historical,[broken],base),/display master/);
});

test('one unavailable current family leaves the other family and all historical images usable',async()=>{
 const onlyCitywide=await loadMediaCatalog(url=>url.includes('downtown-media')?Promise.resolve(new Response('',{status:404})):fetcher(url),{baseURL:base});
 assert(onlyCitywide.currentCitywide);assert.equal(onlyCitywide.currentPictures,undefined);
 const onlyDowntown=await loadMediaCatalog(url=>url.includes('citywide-media')?Promise.resolve(new Response('',{status:404})):fetcher(url),{baseURL:base});
 assert.equal(onlyDowntown.currentPictures.length,12);assert.equal(onlyDowntown.currentCitywide,undefined);
});

test('local previews and reserved original URLs retain exact accepted dimensions and bytes',()=>{
 const proof=read('data/downtown-media-20261101-integrity.json');assert.equal(proof.assets.length,48);
 const expected=downtown.images.flatMap(row=>['preview','responsive','displayMaster','download'].map(field=>({...row[field],kind:row.kind,file:row.file,purpose:field})));
 assert.deepEqual(proof.assets,expected);
 const local=proof.assets.filter(a=>a.format==='image/avif'),remote=proof.assets.filter(a=>a.format==='image/png');assert.equal(local.length,24);assert.equal(remote.length,24);
 for(const a of local){const bytes=fs.readFileSync(new URL(a.url,pub));assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);}
 for(const a of remote){assert.match(a.url,/^https:\/\/github\.com\/itsdanielsultan\/future-mississauga\/releases\/download\/pictures-downtown-2026-11-01\/(wide|portraits)-[^/]+\.png$/);assert.equal(a.width,a.kind==='wide'?6144:3240);}
 assert.equal(local.reduce((n,a)=>n+a.bytes,0),6199452);assert.equal(remote.reduce((n,a)=>n+a.bytes,0),305391894);
});

test('current markup, social dates, share image, and module versions all select the new edition',()=>{
 const home=fs.readFileSync(new URL('index.html',pub),'utf8'),social=fs.readFileSync(new URL('social.html',pub),'utf8');
 for(const file of ['downtown-existing.png','downtown-future.png']){const row=downtown.images.find(r=>r.kind==='wide'&&r.file===file);assert(home.includes(row.preview.url));}
 const cards=[...social.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);
 assert.equal(cards.filter(c=>c.includes('gallery/downtown-20261101/')).length,5);
 for(const c of cards.filter(c=>c.includes('gallery/downtown-20261101/'))){assert.match(c,/Rendered 1 November 2026/);const row=downtown.images.find(r=>c.includes(r.preview.url));assert(c.includes('data-osm="'+row.sourceAttribution.openStreetMap+'"'));}
 const share=read('data/share-preview-20261101.json');assert.equal(share.sourceSHA256,downtown.images.find(r=>r.kind==='wide'&&r.file==='downtown-future.png').download.sha256);
 const bytes=fs.readFileSync(new URL(share.url,pub));assert.equal(createHash('sha256').update(bytes).digest('hex'),share.sha256);
 for(const name of ['index.html','explore.html','social.html']){const html=fs.readFileSync(new URL(name,pub),'utf8');assert(html.includes('https://futuremississauga.com/'+share.url));assert(!html.includes('share-preview-compact'));}
 for(const name of fs.readdirSync(pub).filter(n=>n.endsWith('.html'))){const html=fs.readFileSync(new URL(name,pub),'utf8');for(const match of html.matchAll(/(?:gallery|social-preview|image-experience)\.js\?v=([^"']+)/g))assert.equal(match[1],'20261101-media2',name);}
 for(const name of ['gallery.js','social-preview.js','image-experience.js']){const js=fs.readFileSync(new URL(name,pub),'utf8');for(const match of js.matchAll(/(?:media-catalog|document-preview)\.js\?v=([^"']+)/g))assert.equal(match[1],'20261101-media2',name);}
});

test('new atlas appends sharp previews and accessible text without changing either earlier edition',()=>{
 const old=read('data/document-previews-20261028.json'),current=read('data/document-previews-20261101.json');
 const text=name=>JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(new URL(name,pub),'utf8'),'base64')));
 assert.deepEqual(current.documents.slice(0,14),old.documents);assert.deepEqual(text('document-page-text-20261101.txt').slice(0,14),text('document-page-text-20261028.txt'));
 const atlas=current.documents.at(-1);assert.equal(atlas.title,'Picture atlas');assert.equal(atlas.pages,35);assert.equal(atlas.sourceSHA256,'3ec6b565b82d8fb1e83b06a5856d6b7bb3f051c257f7dd0ed43725cbba86adec');assert(atlas.sizes.every(([w])=>w===2400));
 assert.equal(text('document-page-text-20261101.txt').at(-1).length,35);
 const sources=fs.readFileSync(new URL('sources.html',pub),'utf8');assert(sources.includes(atlas.url));assert(sources.includes(citywide.image.sourceAttribution.credits));assert(sources.includes('sources.js?v=20261101-library1'));
});
