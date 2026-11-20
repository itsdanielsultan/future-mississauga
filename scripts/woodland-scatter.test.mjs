import * as treeRuntime from './tree-runtime-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {assetURL} from '../public/asset-delivery.js';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const scope=JSON.parse(readFileSync(new URL('./woodland-scatter-scope.json',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const decoded=url=>JSON.parse(gunzipSync(read(url)));
const manifest=JSON.parse(read('data/landscape-layer-manifest.json'));
const app=read('app.js').toString();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const synthetic=row=>row[0]>=2_000_000_000;

test('six accepted tree payloads retain exact compressed and decoded pins without replacing historical files or CDN routes',()=>{
 assert.equal(scope.assets.length,6);assert.equal(hash(read('asset-delivery-map.js')),scope.oldAssetDeliveryMapSHA256);
 for(const asset of scope.assets){
  const bytes=read(asset.url);assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);assert.equal(hash(gunzipSync(bytes)),asset.decodedPayloadSHA256);
  assert.equal(read(asset.historicalURL).length,asset.historicalBytes);assert.equal(hash(read(asset.historicalURL)),asset.historicalSHA256);
  assert(asset.url.includes(asset.sha256.slice(0,12)));assert.equal(assetURL(asset.url),asset.url);
  assert.notEqual(assetURL(asset.historicalURL),asset.historicalURL,'Old qualified CDN route remains active');
 }
});

test('only four tree variants and two base sources change; current counts and historical full-dataset records remain distinct',()=>{
 const unchanged=structuredClone(manifest);delete unchanged.treeSources;
 for(const district of ['lakeview','port-credit']){
  const source=manifest.treeSources[district],rows=decoded(source.url).trees;
  assert.equal(source.treeRecords,rows.length);assert.equal(source.inventoryTreeRecords,rows.filter(r=>!synthetic(r)).length);assert.equal(source.illustrativeWoodlandRecords,rows.filter(synthetic).length);
  const pin=scope.assets.find(r=>r.url===source.url);assert.equal(source.sha256,pin.decodedPayloadSHA256);assert.equal(source.downloadSHA256,pin.sha256);assert.equal(source.downloadBytes,pin.bytes);
  for(const mode of ['baseline','future']){
   const entry=manifest.trees[district][mode],old=scope.beforeTrees[district][mode],asset=scope.assets.find(r=>r.url===entry.url);
   assert.equal(entry.treeRecords,rows.length);assert.equal(entry.sha256,asset.decodedPayloadSHA256);assert.equal(entry.downloadSHA256,asset.sha256);assert.equal(entry.downloadBytes,asset.bytes);assert.equal(entry.file,entry.url);
   assert.deepEqual(entry.historicalFullDatasetRecord,Object.fromEntries(['file','sha256','treeRecords','counts'].map(k=>[k,old[k]])));
   assert.equal(entry.counts,undefined);for(const key of ['roadCrossingClearance','pierHouseClearance'])if(old[key])assert.deepEqual(entry.retainedPreviousRules[key],old[key]);
   assert.equal(entry.syntheticScatterRevision.noPhysicalTreeRemovalClaim,true);
  }
  delete unchanged.trees[district];
 }
 assert.equal(hash(JSON.stringify(stable(unchanged))),scope.unrelatedManifestCanonicalSHA256);
});

test('all mapped tree records, IDs, order, species and mapped crown adjustments remain exact; 950 shared synthetic rows agree',()=>{
 const newRows={};
 for(const district of ['lakeview','port-credit']){
  const old=decoded('data/'+district+'-trees.json.gz').trees,current=decoded(manifest.treeSources[district].url).trees;newRows[district]=current;
  assert.deepEqual(current.map(r=>r[0]),old.map(r=>r[0]));assert.deepEqual(current.filter(r=>!synthetic(r)),old.filter(r=>!synthetic(r)));
  const oldMap=new Map(old.map(r=>[r[0],r]));for(const row of current.filter(synthetic))assert.deepEqual(row.slice(4),oldMap.get(row[0]).slice(4));
  const changes=current.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(old[i]));assert.equal(changes.length,district==='lakeview'?8282:832);assert(changes.every(synthetic));
  for(const mode of ['baseline','future']){
   const previous=decoded('data/'+district+'-tree-adjustments-'+mode+'.json.gz').adjustments,next=decoded(manifest.trees[district][mode].url).adjustments;
   assert.deepEqual(next.filter(r=>!synthetic(r)),previous.filter(r=>!synthetic(r)));
   const nextMap=new Map(next);for(const [id,scale] of previous)assert(nextMap.get(id)<=scale,'Prior crown reductions preserved');
  }
 }
 const lake=new Map(newRows.lakeview.filter(synthetic).map(r=>[r[0],r])),shared=newRows['port-credit'].filter(r=>synthetic(r)&&lake.has(r[0]));
 assert.equal(shared.length,950);for(const row of shared)assert.deepEqual(row,lake.get(row[0]));
});

test('production loader consumes metadata routes in both variants and preserves every native canopy matrix recipe',async()=>{
 const build=app.slice(app.indexOf('async function addTrees('),app.indexOf('async function loadDistrict('));
 for(const district of ['lakeview','port-credit']){
  const calls=[],state={...treeRuntime,THREE,treeDataCache:{},loadToken:9,landscapeLayers:manifest,compressedJSON:async url=>{calls.push(url);return decoded(url);},visibleAttribution:{registerAsset(){}},registerHarbornTreeContacts(){}};
  runInNewContext(build,state);const root=new THREE.Group();await state.addTrees(district,root,9,'baseline');await state.addTrees(district,root,9,'future');
  assert.deepEqual(calls,[manifest.treeSources[district].url,manifest.trees[district].baseline.url,manifest.trees[district].future.url]);
  const rows=decoded(manifest.treeSources[district].url).trees;
  for(const [index,mode] of ['baseline','future'].entries()){
   const mesh=root.children[index],oldAdjustments=new Map(decoded('data/'+district+'-tree-adjustments-'+mode+'.json.gz').adjustments),currentAdjustments=new Map(decoded(manifest.trees[district][mode].url).adjustments),dummy=new THREE.Object3D();assert.equal(mesh.count,rows.length);
   assert.deepEqual(Array.from(mesh.userData.treeSources,x=>x.url),[manifest.treeSources[district].url,manifest.trees[district][mode].url]);
   rows.forEach((row,i)=>{const [id,x,y,z,species]=row,crownScale=(synthetic(row)?currentAdjustments:oldAdjustments).get(id)??row[7]??1,kind=String(species).toLowerCase(),conifer=/pine|spruce|fir|cedar/.test(kind),slender=/poplar|aspen|birch/.test(kind),r=(2.3+(id%13)*.21)*(conifer?.7:slender?.8:1)*crownScale,h=(5.8+(id%17)*.37)*(conifer?1.2:slender?1.15:1);dummy.position.set(x,y+h*.6,z);dummy.scale.set(r,crownScale>0?h*.5:0,r);dummy.rotation.y=(id%37)*.17;dummy.updateMatrix();assert.deepEqual(Array.from(mesh.instanceMatrix.array.subarray(i*16,(i+1)*16)),Array.from(new Float32Array(dummy.matrix.elements)));});
   mesh.geometry.dispose();mesh.material.dispose();
  }
 }
 assert(app.includes("sourceURLs:['models/'+district.id+'.glb',landscapeLayers.treeSources?.[district.id]?.url||'data/'+district.id+'-trees.json.gz'"));
});
