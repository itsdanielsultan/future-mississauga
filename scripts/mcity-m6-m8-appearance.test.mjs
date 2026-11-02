import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import vm from 'node:vm';
import {M6_M8_APPEARANCE,restoreM6M8Appearance} from './mcity-m6-m8-appearance-scope.mjs';
import {createModelAppearance} from '../public/model-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle} from '../public/model-status-materials.js';
import {refinementInDistrict} from '../public/refinement-loading.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url)),json=p=>JSON.parse(read('data/'+p+'.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const refinements=json('refinement-models'),projects=json('projects'),versions=json('model-asset-versions');
const protectedScope=JSON.parse(readFileSync(new URL('./mcity-m6-m8-appearance-protected.json',import.meta.url)));
const assets=M6_M8_APPEARANCE.map(s=>refinements.assets.find(a=>a.id===s.id));
const meshes=root=>{const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
const load=async url=>{const encoded=read(url),raw=url.endsWith('.gz')?gunzipSync(encoded):encoded;return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});

test('M6/M7-M8 appearance revisions preserve all planning facts and exact replacement policy',()=>{
 restoreM6M8Appearance(structuredClone(refinements));
 for(const [path,pin]of Object.entries(protectedScope.facts)){if(path==='data/projects.json')assert.equal(modelScopeFingerprint(restoreM1M2Projects(structuredClone(projects))),M1_M2_V5_SCOPE.priorProjectsFingerprint);else assert.equal(sha(path==='downloads/project-register.csv'?restoreM1M2Register(read(path).toString()):read(path)),pin,path);}
 for(const spec of M6_M8_APPEARANCE){const row=refinements.assets.find(a=>a.id===spec.id),p=projects.find(p=>p.id===row.projectId);
  assert.equal(row.lifecycle,'proposed');assert.deepEqual(row.modes,['future']);assert.deepEqual(row.replacementModes,['future']);assert.deepEqual(row.replacesSourceIds,spec.oldRecord.replacesSourceIds);
  assert.equal(row.sourceDate,spec.oldRecord.sourceDate);assert.equal(row.statusEvidenceDate,'2026-10-29');assert.equal(row.sourceOriginalsIncluded,false);assert(row.preserveMaterials&&row.preserveSourceNormals&&row.uncertainGeometry);assert.match(row.credit,/Hariri Pontarini Architects/);
  assert.equal(p.status,'plans-under-review');assert.equal(p.lifecycle,'proposed');assert.equal(p.planningSnapshot.asOf,'2026-10-29');assert.match(row.modelFidelity,/Post-sale plans remain under review/);assert.match(row.geometryConfidence,/remain approximate/);
  assert.equal(sha(read(spec.oldRecord.url)),spec.oldRecord.downloadSHA256);assert.equal(versions.sha256[spec.oldRecord.url],spec.oldRecord.downloadSHA256);
 }
});

for(const spec of M6_M8_APPEARANCE)test(spec.id+' preserves exact accepted materials and contains no source images',async()=>{
 const asset=assets.find(a=>a.id===spec.id),encoded=read(asset.url),raw=gunzipSync(encoded);assert.equal(sha(encoded),spec.downloadSHA256);assert.equal(sha(raw),spec.rawSHA256);assert.equal(encoded.length,spec.bytes);assert.equal(raw.length,spec.decodedBytes);assert.equal(versions.sha256[asset.url],spec.downloadSHA256);
 const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
 const {scene}=await load(asset.url),list=meshes(scene),box=new THREE.Box3().setFromObject(scene,true);assert.equal(list.length,spec.meshes);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),spec.triangles);assert.deepEqual([box.min.toArray(),box.max.toArray()],asset.bounds);
 assert.equal(box.min.y,spec.oldRecord.bounds[0][1]);assert.equal(box.max.y,spec.oldRecord.bounds[1][1]);assert.equal(new Set(list.map(m=>m.material)).size,spec.materialCount);
 const clear=list.filter(m=>m.material.name.includes('clear guard glass')),striped=list.filter(m=>m.material.name.includes('striped guard glass'));assert(clear.length&&striped.length);
 for(const m of clear){assert(m.material.transparent);assert(Math.abs(m.material.opacity-.18)<1e-6);}for(const m of striped){assert(m.material.transparent);assert(Math.abs(m.material.opacity-.68)<1e-6);}
 const appearance=createModelAppearance(THREE),materials=list.map(m=>m.material);for(const m of list){Object.assign(m.userData,{assetId:asset.id,projectId:asset.projectId,sourceAssetSHA256:asset.downloadSHA256,lifecycle:asset.lifecycle});appearance.register(m,{authored:true});assert.equal(m.material,materials[list.indexOf(m)]);}
 appearance.setMode('status');appearance.setMode('natural');list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.dispose();dispose(scene);
});

function triangleKeys(mesh){mesh.updateWorldMatrix(true,false);const {position}=mesh.geometry.attributes,index=mesh.geometry.index,count=index?.count??position.count,result=new Set(),vertex=new THREE.Vector3();for(let i=0;i<count;i+=3){const points=[];for(let c=0;c<3;c++){vertex.fromBufferAttribute(position,index?index.getX(i+c):i+c).applyMatrix4(mesh.matrixWorld);points.push([vertex.x,vertex.y,vertex.z].map(Math.fround).join(','));}result.add(points.sort().join('|'));}return result;}
for(const spec of M6_M8_APPEARANCE)test(spec.id+' keeps every protected original core, slab and roof triangle',async()=>{
 const before=(await load(spec.oldRecord.url)).scene,after=(await load(spec.url)).scene,oldMeshes=meshes(before),newMeshes=meshes(after);
 for(const group of protectedScope.protectedGroups[spec.id]){const old=oldMeshes.find(m=>m.name===group.name),current=newMeshes.find(m=>m.name===group.name);assert(old&&current,group.name);assert.equal((old.geometry.index?.count??old.geometry.attributes.position.count)/3,group.triangles);const original=triangleKeys(old),updated=triangleKeys(current);for(const key of original)assert(updated.has(key),group.name+' protected triangle moved or removed');}
 dispose(before);dispose(after);
});

test('actual map adapter shows dated M6/M7-M8 only in Future and masks the five City envelopes once',async()=>{
 const app=read('app.js').toString(),model=(await load('models/downtown.glb')).scene,sourceIds=assets.flatMap(a=>a.replacesSourceIds),original=meshes(model).filter(m=>sourceIds.includes(m.userData.id));assert.equal(original.length,5);
 const sourcePositions=original.map(m=>m.geometry.attributes.position.array.slice()),appearance=createModelAppearance(THREE),district=json('districts').find(d=>d.id==='downtown');
 const state={THREE,district,id:'downtown',nextModel:model,refinementData:{...refinements,assets},refinementInDistrict,overrides:json('overrides'),projectById:new Map(projects.map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle,token:1,loadToken:1,window:{},splitSourceOverlaps,loadAsset:load,model,modelMeshes:[],draftToggle:{checked:false},selectedStudyProjectId:null,treeMeshes:[],markers:[],detailMeshes:[],transitGroup:{},markerGroup:{},syncStatusLegend(){},applyModelVisibility,$:id=>({checked:id==='#unknownStatusToggle'})};
 vm.runInNewContext(app.split('\n').filter(s=>s.startsWith('function classify(')||s.startsWith('function lifecycleFor(')).join('\n'),state);
 const eagerStart=app.indexOf('const additionAssets='),eagerEnd=app.indexOf(' const detail=await loadAsset',eagerStart);assert(eagerStart>0&&eagerEnd>eagerStart);await vm.runInNewContext('(async()=>{'+app.slice(eagerStart,eagerEnd)+'})()',state);
 const passStart=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),passEnd=app.indexOf(';nextContext.traverse',passStart);assert(passStart>0&&passEnd>passStart);vm.runInNewContext(app.slice(passStart,passEnd+1)+'modelMeshes=nextModelMeshes;',state);
 const visibilityStart=app.indexOf('let visibilityCacheKey='),visibilityEnd=app.indexOf('let statusLegendSignature=');assert(visibilityStart>0&&visibilityEnd>visibilityStart);vm.runInNewContext(app.slice(visibilityStart,visibilityEnd),state);
 for(const m of original){assert.equal(m.userData.sourceReplacements.length,1);assert.equal(m.userData.sourceReplacements[0].assetId,assets.find(a=>a.replacesSourceIds.includes(m.userData.id)).id);}
 for(const selected of [null,'mcity-6','mcity-7-8']){state.selectedStudyProjectId=selected;for(const mode of ['future','construction','existing','future']){vm.runInNewContext('applyVisibility('+JSON.stringify(mode)+')',state);for(const spec of M6_M8_APPEARANCE){const list=state.modelMeshes.filter(m=>m.userData.assetId===spec.id);assert.equal(list.length,spec.meshes);assert.equal(list.filter(m=>m.visible).length,mode==='future'?spec.meshes:0);}assert(original.every(m=>!m.visible));}}
 for(const mode of ['existing','construction','future']){applyModelVisibility(original,mode,{unknownStatuses:false});assert(original.every(m=>m.visible===(mode==='future')));}
 original.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.position.array,sourcePositions[i]));appearance.dispose();dispose(model);
});
import {restoreM1M2Projects,restoreM1M2Register,M1_M2_V5_SCOPE,modelScopeFingerprint} from './mcity-m1-m2-v5-scope.mjs';
