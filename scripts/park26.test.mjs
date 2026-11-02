import {restorePreOHNVersions} from './offshore-context-scope.mjs';
import {restoreHarbornVersions} from './harborn-v4-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import vm from 'node:vm';
import {PARK26_SCOPE as scope,restore26Refinements,restore26Projects,park26Fingerprint,restore26Accuracy} from './park26-scope.mjs';
import {createModelAppearance} from '../public/model-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle} from '../public/model-status-materials.js';
import {refinementInDistrict} from '../public/refinement-loading.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url)),json=p=>JSON.parse(read('data/'+p+'.json')),sha=b=>createHash('sha256').update(b).digest('hex');
const data=json('refinement-models'),projects=json('projects'),asset=data.assets.find(a=>a.id===scope.asset.id),project=projects.find(p=>p.id===scope.project.id);
const meshes=root=>{const list=[];root.traverse(m=>{if(m.isMesh)list.push(m)});return list;};
const load=async url=>{const bytes=read(url),raw=url.endsWith('.gz')?gunzipSync(bytes):bytes;return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});

test('26 Park changes only accepted model fields while planning facts and source history stay exact',()=>{
 assert.equal(park26Fingerprint(restore26Refinements(structuredClone(data))),scope.priorRefinementsFingerprint);assert.equal(park26Fingerprint(restore26Projects(structuredClone(projects))),scope.priorProjectsFingerprint);
 const versions=restoreHarbornVersions(restorePreOHNVersions(json('model-asset-versions')));assert.equal(versions.sha256[asset.url],scope.version.sha256);delete versions.sha256[asset.url];assert.equal(park26Fingerprint(versions),scope.priorVersionsFingerprint);
 for(const [file,pin]of Object.entries(scope.facts))assert.equal(sha(read('data/'+file)),pin,file);
 assert.equal(project.status,'Application received');assert.equal(project.statusDate,'2026-08-20');assert.equal(asset.sourceDate,'2026-07-30');assert.equal(asset.lifecycle,'proposed');assert.deepEqual(asset.modes,['future']);assert.deepEqual(asset.replacesSourceIds,[]);assert.deepEqual(asset.sourceMeshIdsToDisable,[]);assert.deepEqual(asset.replacementModes,['future']);assert(asset.preserveMaterials&&asset.preserveSourceNormals);assert.match(asset.credit,/Kohn Partnership Architects/);assert.match(project.modelCaveat,/Other elevations remain schematic/);assert.match(project.modelCaveat,/height datum is unverified/);restore26Accuracy(read('accuracy-review.html').toString());
});

test('26 Park exact accepted exterior preserves all four core boxes and its original grade and maximum',async()=>{
 const encoded=read(asset.url),raw=gunzipSync(encoded);assert.equal(sha(encoded),'8eb2cd0baf4f4fe0166566ca00f1f20e2d8fdde5e80ebc010cb7062d48c9dccd');assert.equal(sha(raw),'c9769467d130d1ddbf4e6b6a35c06b7e58abbf54c180c10bd3b4d6f0acf03a30');assert.equal(raw.length,1970412);assert.equal(encoded.length,271188);
 const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
 assert.equal(sha(read(scope.asset.oldValues.url)),'c245fa1beebfe015b7058a7514672d4f438071bfea3d7fdeb9f1ad2d98b6f535');const old=(await load(scope.asset.oldValues.url)).scene,scene=(await load(asset.url)).scene,before=meshes(old),list=meshes(scene);assert.equal(before.length,4);assert.equal(list.length,35);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),23028);
 for(const original of before){const current=list.find(m=>m.name===original.name);assert(current);for(const key of Object.keys(original.geometry.attributes))assert.deepEqual(current.geometry.attributes[key].array,original.geometry.attributes[key].array,original.name+' '+key);assert.deepEqual(current.geometry.index.array,original.geometry.index.array);assert.equal(original.geometry.index.count/3,12);assert.deepEqual(current.matrix.toArray(),original.matrix.toArray());}
 const box=new THREE.Box3().setFromObject(scene,true),originalBox=new THREE.Box3().setFromObject(old,true);assert.deepEqual([box.min.toArray(),box.max.toArray()],asset.bounds);assert.equal(box.min.y,originalBox.min.y);assert.equal(box.max.y,98.75);assert.equal(box.max.y,originalBox.max.y);
 const appearance=createModelAppearance(THREE),materials=list.map(m=>m.material);for(const m of list){Object.assign(m.userData,{assetId:asset.id,projectId:asset.projectId,sourceAssetSHA256:asset.downloadSHA256,lifecycle:'proposed'});appearance.register(m,{authored:true});}list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.setMode('status');appearance.setMode('natural');list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.dispose();dispose(old);dispose(scene);
});

test('actual Port Credit adapter shows the 35 new components in Future without masking any City source',async()=>{
 const app=read('app.js').toString(),model=(await load('models/port-credit.glb')).scene,original=meshes(model),appearance=createModelAppearance(THREE),district=json('districts').find(d=>d.id==='port-credit');
 const state={THREE,district,id:'port-credit',nextModel:model,refinementData:{...data,assets:[asset]},refinementInDistrict,overrides:json('overrides'),projectById:new Map(projects.map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle,token:1,loadToken:1,window:{},splitSourceOverlaps,loadAsset:load,model,modelMeshes:[],draftToggle:{checked:false},selectedStudyProjectId:null,treeMeshes:[],markers:[],detailMeshes:[],transitGroup:{},markerGroup:{},syncStatusLegend(){},applyModelVisibility,$:id=>({checked:id==='#unknownStatusToggle'})};
 vm.runInNewContext(app.split('\n').filter(s=>s.startsWith('function classify(')||s.startsWith('function lifecycleFor(')).join('\n'),state);
 const start=app.indexOf('const additionAssets='),end=app.indexOf(' const detail=await loadAsset',start);assert(start>0&&end>start);await vm.runInNewContext('(async()=>{'+app.slice(start,end)+'})()',state);
 const pass=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),passEnd=app.indexOf(';nextContext.traverse',pass);assert(pass>0&&passEnd>pass);vm.runInNewContext(app.slice(pass,passEnd+1)+'modelMeshes=nextModelMeshes;',state);
 vm.runInNewContext(app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature=')),state);const detail=state.modelMeshes.filter(m=>m.userData.assetId===asset.id);assert.equal(detail.length,35);assert(original.every(m=>!m.userData.sourceReplacements?.some(r=>r.assetId===asset.id)));
 for(const selected of [null,project.id]){state.selectedStudyProjectId=selected;for(const mode of ['future','existing','construction','future']){vm.runInNewContext('applyVisibility('+JSON.stringify(mode)+')',state);assert.equal(detail.filter(m=>m.visible).length,mode==='future'?35:0);}}
 appearance.dispose();dispose(model);
});
