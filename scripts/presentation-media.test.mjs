import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCleanMedia} from '../public/clean-media.js';

const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,pub)));
const manifest=read('data/presentation-media-20261109.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=path=>fs.readFileSync(new URL(path,pub));

test('revised downtown images retain native resolution, clean pixels and precise lifecycle metadata',()=>{
 assert.equal(manifest.images.length,5);
 assert.equal(manifest.publication,false);
 const allowed=new Set(['Existing','Under construction','Approved planning','Proposed','Status unverified']);
 for(const entry of manifest.images){
  const row=normalizeCleanMedia(entry,base);
  assert.match(row.caption.creator,/^Daniel Sultan(?: \/ Future Mississauga)?$/);
  assert.equal(entry.displayMaster.dimensions[0],6144);
  assert.equal(entry.displayMaster.dimensions[1],entry.identity.includes('skyline')?2240:3840);
  assert.equal(entry.presentation.sourceGeometryUnchanged,true);
  assert.equal(entry.presentation.authoredFacadesPreserved,true);
  assert(entry.presentation.legend.every(item=>allowed.has(item.label)));
  assert.match(entry.presentation.qualification,/Detailed architectural finishes retain their materials/);
  for(const asset of [entry.displayMaster,entry.download,...entry.responsivePreviews]){
   const bytes=file(asset.url);assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);
   if(asset.mimeType==='image/png')assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],asset.dimensions);
  }
  assert.deepEqual(entry.download.sceneDimensions,entry.displayMaster.dimensions);
  assert.equal(entry.download.allScenePixelsExact,true);
  assert.equal(entry.download.sceneSourceSHA256,entry.displayMaster.sha256);
 }
});

test('presentation metadata cannot silently lose its preservation evidence or inject caption markup',()=>{
 for(const change of [row=>row.presentation.sourceGeometryUnchanged=false,row=>row.presentation.geometrySHA256='bad',row=>row.presentation.legend[0].label='<img>',row=>row.presentation.extra='unvalidated']){
  const row=structuredClone(manifest.images[0]);change(row);assert.throws(()=>normalizeCleanMedia(row,base));
 }
});

test('current catalogue selects the revision, binds its comparison and keeps older pixels independently addressable',async()=>{
 const savedFetch=globalThis.fetch,savedLocation=globalThis.location;
 const fetcher=async url=>{try{return new Response(file(url));}catch{return new Response('',{status:404});}};
 globalThis.fetch=fetcher;globalThis.location={href:base};
 try{
  const {mediaCatalog,indexMedia}=await import('../public/media-catalog.js?test=presentation-revision');
  const catalog=await mediaCatalog,index=indexMedia(catalog,base),original=read('data/native-media-20261102.json');
  for(const entry of manifest.images){
   const active=catalog.currentPictures.find(row=>row.identity===entry.identity);assert(active,entry.identity);
   assert.equal(active.displayMaster.sha256,entry.displayMaster.sha256);
   if(!entry.identity.includes('skyline'))assert.equal(active.comparisonProof.proofID,manifest.comparisonProofs[0].proofID);
   const prior=original.images.find(row=>row.identity===entry.identity);
   assert.equal(index.get(new URL(prior.displayMaster.url,base).href).displayMaster.sha256,prior.displayMaster.sha256);
  }
 }finally{globalThis.fetch=savedFetch;globalThis.location=savedLocation;}
});

test('skyline film and poster share the revised image edition and equal scenario timing',()=>{
 const root='gallery/revision-20261109/',film=read(root+'Film-build-manifest.json');
 assert.equal(film.durationSeconds,12);
 assert.equal(film.validation.posterMatchesDecodedFirstFrameExactly,true);
 for(const key of ['film','poster','credits']){const asset=film[key],bytes=file(root+asset.file);assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);}
 const home=file('index.html').toString();assert(home.includes(root+film.film.file));assert(home.includes(root+film.poster.file));
 assert(!home.includes('gallery/Downtown-transformation.mp4'));
 assert(!home.includes('Route details &amp; model limits'));
});
