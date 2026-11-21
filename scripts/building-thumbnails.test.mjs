import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {activeArtworkEdition} from './active-artwork-edition.mjs';
import {buildingThumbnail} from '../public/building-thumbnail-binding.js';
const read=file=>JSON.parse(readFileSync(new URL('../public/data/'+file+'.json',import.meta.url)));
const registry=read('building-thumbnails'),manifest=read('model-previews'),catalogue=read('building-catalogue');
const currentProfiles=activeArtworkEdition()==='20261121'?read('building-features'):{};
test('each current model thumbnail resolves its exact assembly, file hash and native dimensions',()=>{
 assert.equal(new Set(registry.current.map(row=>row.id)).size,registry.current.length);
 for(const id of ['mcity-m1','mcity-pair','mcity-m5','edge-2','harborn-50-60','port-credit-26-park','voya']){
  const row=registry.current.find(row=>row.id===id);assert(row,id+' current native capture');
  assert.equal(row.provenance.kind,'native-public-viewer-capture');assert.equal(row.provenance.fullModelVisible,true);assert.equal(row.provenance.geometryEdited,false);
  assert(row.image.width>=1600&&row.image.height>=1200);
 }
 for(const binding of registry.current){
  const view=manifest.views.find(row=>row.id===binding.id);assert(view);
  const image=buildingThumbnail(view,manifest,registry);assert.deepEqual(image,binding.image);
  const directoryImage=currentProfiles[view.id]?.cardImage??image;
  assert.deepEqual(catalogue.entries.find(row=>row.id===view.id).image,directoryImage);
  const bytes=readFileSync(new URL('../public/'+image.url,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[image.width,image.height]);
 }
});
test('changed or mixed model revisions cannot silently reuse a thumbnail',()=>{
 const view=manifest.views.find(row=>row.id==='mcity-pair');
 const changed=structuredClone(manifest);changed.assets.find(row=>row.id==='mcity-m1').sha256='0'.repeat(64);
 assert.equal(buildingThumbnail(view,changed,registry),null);
 assert.equal(buildingThumbnail({...view,assets:[...view.assets].reverse()},manifest,registry),null);
 assert.equal(buildingThumbnail({...view,assets:view.assets.slice(0,1)},manifest,registry),null);
 assert.equal(buildingThumbnail({...view,id:'panoramic'},manifest,registry),null);
});
test('historical November thumbnails retain their original files and model revision associations',()=>{
 assert.equal(registry.historical.length,12);
 for(const row of registry.historical){const bytes=readFileSync(new URL('../public/'+row.image.url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.image.sha256);assert.equal(row.provenance.captureDate,null);}
 for(const id of ['mcity-m1','mcity-pair','mcity-m5']){
  const old=registry.historical.find(row=>row.id===id),current=registry.current.find(row=>row.id===id);
  assert.notEqual(current.image.url,old.image.url);assert.notDeepEqual(current.assets,old.assets);
 }
 assert.equal(registry.current.find(row=>row.id==='mcity-pair').assets[1].sha256,registry.historical.find(row=>row.id==='mcity-pair').assets[1].sha256,'M2 is unchanged within the new paired image');
});
