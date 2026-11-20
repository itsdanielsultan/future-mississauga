import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import * as runtime from './tree-runtime-fixture.mjs';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const scope=JSON.parse(readFileSync(new URL('./tree-transplant-scope.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('./bounded-crown-native-fixtures.json',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const landscape=JSON.parse(read('data/landscape-layer-manifest.json'));
const originalIds=new Set(scope.southCommonIDs);
const dispose=mesh=>{mesh.geometry.dispose();mesh.material.dispose();};

test('the selected whole-symbol and bounded-contact policies retain exact accepted modules and municipal inputs',()=>{
 for(const [path,sha] of Object.entries({...scope.modules,...scope.sourceTreeFiles}))assert.equal(hash(read(path)),sha,path);
 assert.equal(hash(readFileSync(new URL('./bounded-crown-native-fixtures.json',import.meta.url))),scope.nativeFixtureSHA256);
 const source=runtime.refinementData.assets.find(asset=>asset.id==='south-common-source-derived-preview');
 assert.equal(source.downloadSHA256,scope.southCommonModelSHA256);
 assert.equal(hash(read(source.url)),scope.southCommonModelSHA256);
 assert.equal(fixtures.length,12);assert.equal(new Set(fixtures.map(row=>row.id)).size,12);
});

test('all twelve bounded contacts preserve mapped XYZ and height, ignore unrelated trees and restore exact matrices',()=>{
 const allAssets=new Set(fixtures.map(row=>row.assetId)),rows=fixtures.map(row=>[row.id]);rows.push([999999]);
 for(const mode of ['baseline','future',null]){
  const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial(),rows.length);
  fixtures.forEach((row,index)=>mesh.setMatrixAt(index,new THREE.Matrix4().fromArray(row.matrix)));
  mesh.setMatrixAt(fixtures.length,new THREE.Matrix4().makeTranslation(123,456,789));
  const original=mesh.instanceMatrix.array.slice(),input=JSON.stringify(rows);
  runtime.registerBoundedCrownContacts(THREE,mesh,rows,mode);
  const rules=new Map(mesh.userData.boundedCrownContacts.rules.map(rule=>[rule.id,rule]));
  assert.equal(rules.size,mode==='baseline'?1:12);
  for(const scenario of ['existing','construction','future','future','existing','future','construction']){
   runtime.applyBoundedCrownContacts([mesh],scenario,allAssets);
   for(let index=0;index<rows.length;index++){
    const id=rows[index][0],rule=rules.get(id),before=original.slice(index*16,index*16+16),after=mesh.instanceMatrix.array.slice(index*16,index*16+16);
    const active=rule?.modes.includes(scenario);
    assert.deepEqual(after.slice(12),before.slice(12),'source translation remains exact');
    if(!active)assert.deepEqual(after,before,'unaffected matrix remains exact');
    else if(rule.kind==='mapped-crown-radius-only'){
     assert(id<2_000_000_000);assert.deepEqual(after.slice(4,8),before.slice(4,8),'mapped crown height remains exact');
     assert.deepEqual(after,new Float32Array(new THREE.Matrix4().fromArray(before).scale(new THREE.Vector3(rule.horizontalScale,1,rule.horizontalScale)).elements));
    }else{assert(id>=2_000_000_000);assert(after.slice(0,12).every(value=>value===0));}
   }
   const version=mesh.instanceMatrix.version;runtime.applyBoundedCrownContacts([mesh],scenario,allAssets);assert.equal(mesh.instanceMatrix.version,version);
  }
  runtime.applyBoundedCrownContacts([mesh],'future',new Set());assert.deepEqual(mesh.instanceMatrix.array,original);
  assert.equal(JSON.stringify(rows),input);assert.equal(mesh.children.length,0);dispose(mesh);
 }
});

test('production loader applies the eleven South Common symbols only in visible Future study and restores every source matrix',async()=>{
 const app=read('app.js').toString(),build=app.slice(app.indexOf('async function addTrees('),app.indexOf('async function loadDistrict('));
 const scenario=app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature='));
 assert(scenario.indexOf('applyHarbornTreeContacts(')<scenario.indexOf('applyBoundedCrownContacts('));
 assert(scenario.indexOf('applyBoundedCrownContacts(')<scenario.indexOf('applySouthCommonStudyOcclusion('));
 for(const district of ['erin-mills','erindale']){
  const raw=JSON.parse(gunzipSync(read('data/'+district+'-trees.json.gz'))),sourceBefore=JSON.stringify(raw);
  const state={...runtime,THREE,treeDataCache:{[district]:Promise.resolve(raw)},loadToken:5,landscapeLayers:landscape,visibleAttribution:{registerAsset(){}},compressedJSON:async url=>JSON.parse(gunzipSync(read(url)))};
  runInNewContext(build,state);const root=new THREE.Group();
  for(const mode of ['baseline','future']){
   await state.addTrees(district,root,5,mode);const mesh=root.children.at(-1),original=mesh.instanceMatrix.array.slice();
   assert.deepEqual(mesh.userData.southCommonStudyOcclusion?.sourceTreeIds?.slice().sort((a,b)=>a-b)||[],mode==='baseline'?[]:[...originalIds].sort((a,b)=>a-b));
   for(const [which,visible] of [['existing',true],['construction',true],['future',false],['future',true],['future',true],['existing',true],['future',true],['construction',true],['future',false]]){
    runtime.applySouthCommonStudyOcclusion([mesh],which,new Set(visible?['south-common-source-derived-preview']:[]));
    const active=mode==='future'&&which==='future'&&visible;let changed=0;
    for(let i=0;i<raw.trees.length;i++){
     const before=original.subarray(i*16,i*16+16),after=mesh.instanceMatrix.array.subarray(i*16,i*16+16);
     if(active&&originalIds.has(raw.trees[i][0])){assert(after.subarray(0,12).every(value=>value===0));assert.deepEqual(after.subarray(12),before.subarray(12));changed++;}
     else assert.deepEqual(after,before);
    }
    assert.equal(changed,active?11:0);assert.equal(mesh.children.length,0);
   }
   assert.deepEqual(mesh.instanceMatrix.array,original);dispose(mesh);
  }
  assert.equal(JSON.stringify(raw),sourceBefore);
 }
});

test('matching South Common symbols reject an unqualified model hash',()=>{
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1),rows=[[scope.southCommonIDs[0],1,2,3]];
 assert.throws(()=>runtime.registerSouthCommonStudyOcclusion(THREE,mesh,rows,'future','0'.repeat(64)),/source changed/);
 assert.doesNotThrow(()=>runtime.registerSouthCommonStudyOcclusion(THREE,mesh,rows,'baseline','0'.repeat(64)));
 dispose(mesh);
});
