import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {normalizeCleanMedia,comparisonPair} from '../public/clean-media.js';
import {DOWNTOWN_CURRENT_MANIFEST_SHA256,DOWNTOWN_CURRENT_IDENTITIES,DOWNTOWN_CURRENT_COMPARISON} from '../public/downtown-current-media-policy.js';
import {loadLocalAssetMap} from './local-asset-map.mjs';

const pub=new URL('../public/',import.meta.url),base='http://127.0.0.1:4194/';
const raw=await readFile(new URL('data/downtown-current-media-20261113.json',pub),'utf8'),manifest=JSON.parse(raw);
const proofRaw=await readFile(new URL(DOWNTOWN_CURRENT_COMPARISON.url,pub),'utf8'),proof=JSON.parse(proofRaw);
const sha=value=>createHash('sha256').update(value).digest('hex');
const fetcher=async path=>{try{return new Response(await readFile(new URL(path,pub)));}catch{return new Response('',{status:404});}};
const saved={fetch:globalThis.fetch,location:globalThis.location};globalThis.location={href:base};globalThis.fetch=fetcher;
const {mediaCatalog,loadMediaCatalog,indexMedia,refreshCatalogPictures,integrateDowntownCurrentPictures,hasPublishedImageDelivery}=await import('../public/media-catalog.js?downtown-current-test');
const loaded=await mediaCatalog;globalThis.fetch=saved.fetch;
const oldFetcher=path=>path==='data/downtown-current-media-20261113.json'?Promise.resolve(new Response('',{status:404})):fetcher(path);
const previous=await loadMediaCatalog(oldFetcher,{baseURL:base});

test('the exact final fourteen-view package preserves native pixels, dates, qualifications and credits',()=>{
 assert.equal(sha(raw),DOWNTOWN_CURRENT_MANIFEST_SHA256);assert.equal(sha(proofRaw),DOWNTOWN_CURRENT_COMPARISON.sha256);
 assert.deepEqual(manifest.images.map(row=>row.identity),DOWNTOWN_CURRENT_IDENTITIES);
 assert.equal(manifest.images.length,14);assert.equal(manifest.images.flatMap(row=>[row.displayMaster,row.download,...row.responsivePreviews]).length,84);
 assert.doesNotMatch(raw,/\/Users\/|\/private\/|file:\/\/|"path"/);
 for(const entry of manifest.images){
  const row=normalizeCleanMedia(entry,base);assert.equal(entry.sourceFreezeState,'FINAL_FROZEN');assert.equal(entry.historicalURLsRebound,false);
  assert.equal(row.caption.sourceDates,entry.caption.sourceDates);assert.deepEqual(row.caption.fullCredits,entry.caption.fullCredits);
  assert.equal(row.displayMaster.sha256,entry.download.sceneSourceSHA256);assert.equal(entry.download.allScenePixelsExact,true);
  assert.equal(entry.download.sceneCrop,false);assert.equal(entry.download.sceneResize,false);assert.equal(entry.download.sceneOverlay,false);
  if(entry.identity.startsWith('portraits/')){assert.deepEqual(entry.download.dimensions,[3600,4500]);assert.deepEqual(entry.download.sceneBounds,[180,0,3420,4050]);}
  else assert.match(entry.download.url,/^gallery\/refreshed-20261113-v2\//);
 }
});

test('the new edition replaces all fourteen selections together and retains every earlier pixel identity',async()=>{
 const old=indexMedia(previous,base),current=indexMedia(loaded,base);
 for(const [url,row]of old)assert.deepEqual(current.get(url),row,url);
 for(const entry of manifest.images){const row=loaded.currentPictures.find(row=>row.identity===entry.identity);assert.equal(row.displayMaster.sha256,entry.displayMaster.sha256);assert.equal(row.download.sha256,entry.download.sha256);}
 const pictures=JSON.parse(await readFile(new URL('data/picture-assets.json',pub),'utf8'));
 const refreshed=refreshCatalogPictures(pictures,loaded),pair=comparisonPair(refreshed,'downtown');
 assert(pair.every(row=>row.comparisonProof.sha256===DOWNTOWN_CURRENT_COMPARISON.sha256));
 assert.deepEqual(pair.map(row=>row.displayMaster.sha256),proof.members.map(row=>row.cleanPNG.sha256));
 assert.deepEqual(refreshCatalogPictures(structuredClone(refreshed),loaded),refreshed);
});

test('missing, changed or slow matched proof preserves the entire earlier edition',async()=>{
 for(const response of [()=>new Response('',{status:404}),()=>new Response(proofRaw+' '),()=>new Promise(()=>{})]){
  const result=await loadMediaCatalog(path=>path===DOWNTOWN_CURRENT_COMPARISON.url?response():fetcher(path),{baseURL:base,currentTimeoutMs:50});
  for(const id of DOWNTOWN_CURRENT_IDENTITIES)assert.deepEqual(result.currentPictures.find(row=>row.identity===id),previous.currentPictures.find(row=>row.identity===id),id);
 }
 for(const mutate of [m=>m.images.pop(),m=>m.images[0].caption.fullCredits=[],m=>m.images[0].displayMaster.sha256='0'.repeat(64),m=>m.images[0].download.sceneBounds[0]=1]){
  const changed=structuredClone(manifest);mutate(changed);await assert.rejects(integrateDowntownCurrentPictures(previous,changed,base,{proof,proofSHA256:DOWNTOWN_CURRENT_COMPARISON.sha256}));
 }
 const altered=await loadMediaCatalog(path=>path==='data/downtown-current-media-20261113.json'?Promise.resolve(new Response(raw+' ')):fetcher(path),{baseURL:base});
 for(const id of DOWNTOWN_CURRENT_IDENTITIES)assert.deepEqual(altered.currentPictures.find(row=>row.identity===id),previous.currentPictures.find(row=>row.identity===id));
});

test('public activation requires all eighty-four release destinations while local staging is separate',async()=>{
 const live=await loadMediaCatalog(fetcher,{baseURL:'https://futuremississauga.com/'});
 const first=manifest.images[0],selected=live.currentPictures.find(row=>row.identity===first.identity);
 assert.equal(selected.displayMaster.sha256===first.displayMaster.sha256,hasPublishedImageDelivery(manifest));
 const complete=new Map(manifest.images.flatMap(row=>[row.displayMaster,row.download,...row.responsivePreviews]).map(asset=>[asset.url,'https://github.com/itsdanielsultan/future-mississauga/releases/download/neighbourhood-images-2026-11-13-downtown-v1/'+asset.url.split('/').at(-1)]));
 assert(hasPublishedImageDelivery(manifest,url=>complete.get(url)||url));complete.delete(first.download.url);assert.equal(hasPublishedImageDelivery(manifest,url=>complete.get(url)||url),false);
});

test('the eighty-four-file staging map accepts only the two reviewed Downtown namespaces',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fm-downtown-map-'));
 try{
  const file=join(dir,'proof.png');await writeFile(file,'test');const assets=Array.from({length:84},(_,i)=>({url:`gallery/refreshed-20261113${i<7?'-v2':''}/image-${i}.png`,path:file,bytes:4,sha256:sha('test')}));
  const map=join(dir,'map.json'),save=rows=>writeFile(map,JSON.stringify({schema:'future-mississauga-local-asset-map/v1',assets:rows}));
  await save(assets);assert.equal((await loadLocalAssetMap(map)).size,84);
  for(const change of [rows=>rows[0].url='gallery/missing-areas-20261113/image.png',rows=>rows[0].url='gallery/refreshed-20261113/../private.png',rows=>rows[0].sha256='0'.repeat(64)]){const changed=structuredClone(assets);change(changed);await save(changed);await assert.rejects(loadLocalAssetMap(map));}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('current film uses the exact accepted public trio and leaves old film assets intact',async()=>{
 const archive=JSON.parse(await readFile(new URL('data/downtown-film-20261113.json',pub),'utf8'));
 const current=JSON.parse(await readFile(new URL('data/downtown-film-20261120.json',pub),'utf8')),home=await readFile(new URL('film.html',pub),'utf8')+await readFile(new URL('sources.html',pub),'utf8');
 assert.equal(sha(await readFile(new URL(archive.film.url,pub))),'65bf8bd0aff3d0bb3e8481fc23e829ff44a84df248b04ae2d4166a40b1b08bae');
 assert.deepEqual(current.frames.map(r=>r.startSeconds),[0,4,8]);
 assert.equal(new Set(current.frames.map(r=>r.sourceImageSHA256)).size,3);
 assert.deepEqual(current.dimensions,[1920,1080]);assert.equal(current.durationSeconds,12);assert.equal(current.historicalFilmPreserved,true);
 for(const key of ['film','poster','credits']){const asset=current[key],bytes=await readFile(new URL(asset.url,pub));assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);assert(home.includes(asset.url));}
 assert((await readFile(new URL('gallery/revision-20261109/Downtown-skyline-2026-11-09.mp4',pub))).length>0);
});
