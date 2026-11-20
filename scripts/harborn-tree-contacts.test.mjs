import * as treeRuntime from './tree-runtime-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {registerHarbornTreeContacts,applyHarbornTreeContacts} from '../public/harborn-tree-contacts.js';
import {applyModelVisibility} from '../public/model-visibility.js';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const scope=JSON.parse(readFileSync(new URL('./harborn-tree-contacts-scope.json',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ids=new Set(scope.syntheticIds), visibleAssetIds=new Set([scope.assetId]);
const bytesOf=mesh=>Buffer.from(mesh.instanceMatrix.array.buffer).subarray(mesh.instanceMatrix.array.byteOffset,mesh.instanceMatrix.array.byteOffset+mesh.instanceMatrix.array.byteLength);

function fixture(treeMode='future'){
 const rows=[12368,2000121367,...scope.syntheticIds,2000121369].map((id,i)=>[id,10+i*.3,2+i*.1,30-i,'Tree']);
 const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial(),rows.length),dummy=new THREE.Object3D();
 rows.forEach((row,i)=>{dummy.position.set(...row.slice(1,4));dummy.rotation.y=i*.17;dummy.scale.set(3+i*.1,7+i*.2,4+i*.3);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.userData.treeMode=treeMode;
 const original=new Float32Array(mesh.instanceMatrix.array),rowBytes=JSON.stringify(rows);
 registerHarbornTreeContacts(THREE,mesh,rows,treeMode);
 return {mesh,rows,original,rowBytes};
}

function checkMatrices(mesh,rows,original,active){
 const changed=[];
 for(let i=0;i<rows.length;i++){
  const before=original.slice(i*16,i*16+16),after=mesh.instanceMatrix.array.slice(i*16,i*16+16);
  if(active&&ids.has(rows[i][0])){
   assert(after.slice(0,12).every(value=>value===0),'only crown scale is suppressed');
   assert.deepEqual(after.slice(12),before.slice(12),'translation and homogeneous coordinate stay exact');
   assert.notDeepEqual(after,before);changed.push(rows[i][0]);
  }else assert.deepEqual(after,before,'every unaffected instance matrix is exact');
 }
 assert.deepEqual(changed.sort((a,b)=>a-b),active?scope.syntheticIds:[]);
}

test('accepted module and source tree files retain their exact reviewed bytes',()=>{
 assert.equal(hash(read('harborn-tree-contacts.js')),scope.moduleSHA256);
 for(const [path,sha256] of Object.entries(scope.sourceTreeFiles))assert.equal(hash(read(path)),sha256,path);
 assert.equal(scope.nativeValidatedStates,16);
 assert.match(scope.qualifiedHandoffSHA256,/^[a-f0-9]{64}$/);
});

test('only four exact synthetic IDs are suppressed with Future and a visible Harborn replacement',()=>{
 const {mesh,rows,original,rowBytes}=fixture();
 assert.deepEqual(mesh.instanceMatrix.array,original,'registration does not modify matrices');
 assert.deepEqual(mesh.userData.harbornProvenTreeContacts.sourceTreeIds,scope.syntheticIds);
 for(const [which,assets,active] of [
  ['existing',visibleAssetIds,false],['construction',visibleAssetIds,false],
  ['future',new Set(['unrelated-model']),false],['future',undefined,false],
  ['future',visibleAssetIds,true],['future',visibleAssetIds,true],
  ['existing',visibleAssetIds,false],['future',visibleAssetIds,true],
  ['construction',visibleAssetIds,false],['future',visibleAssetIds,true],['future',new Set(),false]
 ]){
  applyHarbornTreeContacts([mesh],which,assets);checkMatrices(mesh,rows,original,active);
  assert.equal(mesh.userData.harbornProvenTreeContacts.active,active);
 }
 assert.equal(JSON.stringify(rows),rowBytes,'input tree positions and other fields remain unchanged');
});

test('baseline, unrelated meshes and repeated states preserve their matrix bytes',()=>{
 const baseline=fixture('baseline'),future=fixture(),unregistered=fixture();
 const stranger=unregistered.mesh.clone();stranger.userData={};
 const baselineBefore=Buffer.from(bytesOf(baseline.mesh)),strangerBefore=Buffer.from(bytesOf(stranger));
 assert.equal(baseline.mesh.userData.harbornProvenTreeContacts,undefined);
 applyHarbornTreeContacts([baseline.mesh,future.mesh,stranger],'future',visibleAssetIds);
 const version=future.mesh.instanceMatrix.version;
 applyHarbornTreeContacts([baseline.mesh,future.mesh,stranger],'future',visibleAssetIds);
 assert.equal(future.mesh.instanceMatrix.version,version,'same state does not rewrite or upload instances');
 assert.deepEqual(bytesOf(baseline.mesh),baselineBefore);assert.deepEqual(bytesOf(stranger),strangerBefore);
 applyHarbornTreeContacts([future.mesh],'existing',visibleAssetIds);
 assert.deepEqual(future.mesh.instanceMatrix.array,future.original);
});

test('unlayered matching source symbols restore exactly when replacement visibility changes',()=>{
 const {mesh,rows,original}=fixture(null);
 applyHarbornTreeContacts([mesh],'future',visibleAssetIds);checkMatrices(mesh,rows,original,true);
 applyHarbornTreeContacts([mesh],'future',new Set());checkMatrices(mesh,rows,original,false);
});

test('real addTrees and scenario hooks preserve all other Cooksville crowns for direct and Citywide detail routes',async()=>{
 const app=read('app.js').toString();
 assert.match(app,/import \{registerHarbornTreeContacts,applyHarbornTreeContacts\} from '\.\/harborn-tree-contacts\.js\?v=20261113-design2';/);
 const build=app.slice(app.indexOf('async function addTrees('),app.indexOf('async function loadDistrict('));
 const scenario=app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature='));
 const landscapeLayers=JSON.parse(read('data/landscape-layer-manifest.json'));
 const source=JSON.parse(gunzipSync(read('data/cooksville-trees.json.gz'))),sourceBefore=JSON.stringify(source);
 for(const district of ['cooksville','citywide']){
  const root=new THREE.Group(),replacement=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  replacement.userData={assetId:scope.assetId,lifecycle:'proposed',modes:['future'],projectId:'harborn'};
  const state={...treeRuntime,THREE,registerHarbornTreeContacts,applyHarbornTreeContacts,treeDataCache:{cooksville:Promise.resolve(source)},loadToken:7,
   compressedJSON:async url=>JSON.parse(gunzipSync(read(url))),landscapeLayers,visibleAttribution:{registerAsset(){}},
   model:new THREE.Group(),modelMeshes:[replacement],draftToggle:{checked:false},selectedStudyProjectId:null,
   treeMeshes:[],markers:[],detailMeshes:[],markerFocusVersion:0,projectById:new Map(),transitGroup:{},markerGroup:{},window:{},
   applyModelVisibility,syncStatusLegend(){},$:()=>({checked:true})};
  runInNewContext(build,state);
  // Both production paths use the district source ID, including Citywide detail.
  await state.addTrees('cooksville',root,7,'baseline');await state.addTrees('cooksville',root,7,'future');
  state.treeMeshes=root.children;const [baseline,future]=root.children;
  assert.equal(future.count,24462,district+' source count');
  const baselineBefore=Buffer.from(bytesOf(baseline)),futureBefore=new Float32Array(future.instanceMatrix.array);
  assert.deepEqual(Array.from(future.userData.harbornProvenTreeContacts.sourceTreeIds),scope.syntheticIds);
  runInNewContext(scenario,state);
  for(const which of ['future','construction','existing','future','existing','future']){
   state.applyVisibility(which);
   assert.equal(baseline.visible,which==='existing');assert.equal(future.visible,which!=='existing');
   assert.deepEqual(bytesOf(baseline),baselineBefore);checkMatrices(future,source.trees,futureBefore,which==='future');
  }
  state.model=new THREE.Group();state.modelMeshes=[];state.applyVisibility('future');
  checkMatrices(future,source.trees,futureBefore,false);
  assert.equal(future.userData.harbornProvenTreeContacts.active,false);
 }
 assert.equal(JSON.stringify(source),sourceBefore);
 const detail=app.slice(app.indexOf('citywideDetail=createCitywideDetail('),app.indexOf('async function focusNeighbourhood()'));
 assert.match(detail,/await addTrees\(district.id,root,token,'baseline'\);await addTrees\(district.id,root,token,'future'\)/);
});
