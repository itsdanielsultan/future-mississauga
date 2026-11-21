import {readBeforePlanningReview} from './planning-review-guard.mjs';
import * as treeRuntime from './tree-runtime-fixture.mjs';
import {restoreRegistryReconciliationData} from './registry-reconciliation-scope.mjs';
import {applyHarbornTreeContacts} from '../public/harborn-tree-contacts.js';
import {restoreMcityV6Catalogue,restoreMcityV6Revisions} from './mcity-v6-scope.mjs';
import {beforeNamedProjectReview} from './named-project-review-scope.mjs';
import {restorePreOHNVersions} from './offshore-context-scope.mjs';
import {restoreHarbornVersions} from './harborn-v4-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
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
const read=p=>readBeforePlanningReview(new URL('../public/'+p,import.meta.url)),json=p=>JSON.parse(read('data/'+p+'.json')),sha=b=>createHash('sha256').update(b).digest('hex');
const data=json('refinement-models'),projects=json('projects'),asset=data.assets.find(a=>a.id===scope.asset.id),project=projects.find(p=>p.id===scope.project.id);
const meshes=root=>{const list=[];root.traverse(m=>{if(m.isMesh)list.push(m)});return list;};
const load=async url=>{const bytes=read(url),raw=url.endsWith('.gz')?gunzipSync(bytes):bytes;return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});

test('26 Park changes only accepted model fields while planning facts and source history stay exact',()=>{
 assert.equal(park26Fingerprint(restore26Refinements(structuredClone(data))),scope.priorRefinementsFingerprint);assert.equal(park26Fingerprint(restore26Projects(structuredClone(projects))),scope.priorProjectsFingerprint);
 const versions=restoreHarbornVersions(restorePreOHNVersions(json('model-asset-versions')));assert.equal(versions.sha256[scope.version.url],scope.version.sha256);delete versions.sha256[scope.version.url];assert.equal(park26Fingerprint(versions),scope.priorVersionsFingerprint);
 for(const [file,pin]of Object.entries(scope.facts)){const restore={'model-previews.json':restoreMcityV6Catalogue,'model-revisions.json':restoreMcityV6Revisions}[file];if(restore){const prior=beforeNamedProjectReview('public/data/'+file);assert.equal(sha(prior),pin,file+' protected baseline');assert.deepEqual(restore(json(file.replace('.json',''))),JSON.parse(prior),file);}else assert.equal(sha(restoreRegistryReconciliationData(file,read('data/'+file))),pin,file);}
 assert.equal(project.status,'Application received');assert.equal(project.statusDate,'2026-08-20');assert.equal(asset.sourceDate,'2026-07-30');assert.equal(asset.lifecycle,'proposed');assert.deepEqual(asset.modes,['future']);assert.deepEqual(asset.replacesSourceIds,[]);assert.deepEqual(asset.sourceMeshIdsToDisable,[]);assert.deepEqual(asset.replacementModes,['future']);assert(asset.preserveMaterials&&asset.preserveSourceNormals);assert.match(asset.credit,/Kohn Partnership Architects/);assert.match(project.modelCaveat,/Other elevations remain schematic/);assert.match(project.modelCaveat,/height datum is unverified/);restore26Accuracy(read('accuracy-review.html').toString());
});

test('26 Park exact accepted exterior preserves all four core boxes and its original grade and maximum',async()=>{
 const transfer=read(asset.url),raw=gunzipSync(transfer);assert.equal(transfer.length,673678);assert.equal(sha(transfer),asset.downloadSHA256);assert.equal(sha(raw),'4d791535afe0744de87dc150e31bd24d86e65be6176be3f79a2aba28bc7fc620');assert.equal(raw.length,5065652);assert.deepEqual(read(asset.url.replace(/\.gz$/,'')),raw);
 const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
 assert.equal(sha(read(scope.asset.oldValues.url)),'c245fa1beebfe015b7058a7514672d4f438071bfea3d7fdeb9f1ad2d98b6f535');const old=(await load(scope.asset.oldValues.url)).scene,scene=(await load(asset.url)).scene,before=meshes(old),list=meshes(scene);assert.equal(before.length,4);assert.equal(list.length,112);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),58968);
 for(const original of before){const current=list.find(m=>m.name===original.name);assert(current);for(const key of Object.keys(original.geometry.attributes))assert.deepEqual(current.geometry.attributes[key].array,original.geometry.attributes[key].array,original.name+' '+key);assert.deepEqual(current.geometry.index.array,original.geometry.index.array);assert.equal(original.geometry.index.count/3,12);assert.deepEqual(current.matrix.toArray(),original.matrix.toArray());}
 const box=new THREE.Box3().setFromObject(scene,true),originalBox=new THREE.Box3().setFromObject(old,true);assert.deepEqual([box.min.toArray(),box.max.toArray()],asset.bounds);assert.equal(box.min.y,originalBox.min.y);assert.equal(box.max.y,98.75);assert.equal(box.max.y,originalBox.max.y);
 const appearance=createModelAppearance(THREE),materials=list.map(m=>m.material);for(const m of list){Object.assign(m.userData,{assetId:asset.id,projectId:asset.projectId,sourceAssetSHA256:asset.downloadSHA256,lifecycle:'proposed'});appearance.register(m,{authored:true});}list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.setMode('status');appearance.setMode('natural');list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.dispose();dispose(old);dispose(scene);
});

test('actual Port Credit adapter shows the 112 accepted components in Future without masking any City source',async()=>{
 const app=read('app.js').toString(),model=(await load('models/port-credit.glb')).scene,original=meshes(model),appearance=createModelAppearance(THREE),district=json('districts').find(d=>d.id==='port-credit');
 const state={...treeRuntime,THREE,applyHarbornTreeContacts,district,id:'port-credit',nextModel:model,refinementData:{...data,assets:[asset]},refinementInDistrict,overrides:json('overrides'),projectById:new Map(projects.map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle,token:1,loadToken:1,window:{},splitSourceOverlaps,loadAsset:load,model,modelMeshes:[],draftToggle:{checked:false},selectedStudyProjectId:null,treeMeshes:[],markers:[],detailMeshes:[],transitGroup:{},markerGroup:{},syncStatusLegend(){},applyModelVisibility,$:id=>({checked:id==='#unknownStatusToggle'})};
 vm.runInNewContext(app.split('\n').filter(s=>s.startsWith('function classify(')||s.startsWith('function lifecycleFor(')).join('\n'),state);
 const start=app.indexOf('const additionAssets='),end=app.indexOf(' const nextDetailMeshes=[];',start);assert(start>0&&end>start);await vm.runInNewContext('(async()=>{'+app.slice(start,end)+'})()',state);
 const pass=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),passEnd=app.indexOf(';nextContext.traverse',pass);assert(pass>0&&passEnd>pass);vm.runInNewContext(app.slice(pass,passEnd+1)+'modelMeshes=nextModelMeshes;',state);
 vm.runInNewContext(app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature=')),state);const detail=state.modelMeshes.filter(m=>m.userData.assetId===asset.id);assert.equal(detail.length,112);assert(original.every(m=>!m.userData.sourceReplacements?.some(r=>r.assetId===asset.id)));
 for(const selected of [null,project.id]){state.selectedStudyProjectId=selected;for(const mode of ['future','existing','construction','future']){vm.runInNewContext('applyVisibility('+JSON.stringify(mode)+')',state);assert.equal(detail.filter(m=>m.visible).length,mode==='future'?112:0);}}
 appearance.dispose();dispose(model);
});
