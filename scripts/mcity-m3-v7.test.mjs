import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import vm from 'node:vm';
import {M3_V7_SCOPE,restoreM3V7Asset,restoreM3V7Projects} from './mcity-m3-v7-scope.mjs';
import {createModelAppearance} from '../public/model-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle} from '../public/model-status-materials.js';
import {refinementInDistrict} from '../public/refinement-loading.js';
import {projectDetailsHTML} from '../public/project-cards.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url));
const json=p=>JSON.parse(read('data/'+p+'.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const fingerprint=v=>sha(JSON.stringify(stable(v)));
const refinements=json('refinement-models'),projects=json('projects'),versions=json('model-asset-versions');
const asset=refinements.assets.find(a=>a.id===M3_V7_SCOPE.newAssetId),project=projects.find(p=>p.id==='mcity-3');
const meshes=root=>{const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
const load=async url=>{const encoded=read(url),raw=url.endsWith('.gz')?gunzipSync(encoded):encoded;return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});

test('M3 V7 permits only the exact reviewed metadata and three model fields',()=>{
 restoreM3V7Asset(structuredClone(refinements));
 assert.equal(fingerprint(restoreM1M2Projects(restoreM3V7Projects(structuredClone(projects)))),M3_V7_SCOPE.priorProjectsFingerprint);
 assert.equal(sha(read(M3_V7_SCOPE.oldAsset.url)),M3_V7_SCOPE.oldAsset.sha256);
 assert.equal(asset.lifecycle,'under_construction');assert.deepEqual(asset.modes,['construction','future']);
 assert.deepEqual(asset.replacesSourceIds,['63-6249']);assert.deepEqual(asset.replacementModes,['construction','future']);
 assert.equal(asset.loadWithMunicipalMesh,null);assert.equal(asset.municipalMeshIncluded,false);assert.equal(asset.recordedProgress,true);
 assert.equal(asset.architecturalHeightM,260.29);assert(asset.uncertainGeometry&&asset.preserveMaterials&&asset.preserveSourceNormals);
 assert.match(project.modelCaveat,/illustrative 3\.05 m/);assert.match(project.modelCaveat,/not a surveyed or as-built model/);
 const html=projectDetailsHTML(project,{asset});
 assert.match(html,/changing tower outline, stepped crown and raised glass pavilion/);
 assert.match(html,/Floor spacing, facade patterns, crown details, podium and placement are approximate/);
 assert.doesNotMatch(html,/City lower capture retained|closed six-strip crown|mechanical steel\/cavities are not reconstructed/);
});

test('M3 V7 preserves accepted bytes, exterior bounds and all authored material references',async()=>{
 for(const entry of M3_V7_SCOPE.versions){assert.equal(sha(read(entry.url)),entry.sha256);assert.equal(versions.sha256[entry.url],entry.sha256);}
 const encoded=read(asset.url),raw=gunzipSync(encoded);assert.equal(encoded.length,1129653);assert.equal(raw.length,3450676);
 const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
 assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));
 assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
 const {scene}=await load(asset.url),list=meshes(scene),box=new THREE.Box3().setFromObject(scene,true);
 assert.equal(list.length,39);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),177888);
 assert.deepEqual([box.min.toArray(),box.max.toArray()],asset.bounds);assert(Math.abs(box.max.y-box.min.y-260.29)<.001);
 const appearance=createModelAppearance(THREE),materials=list.map(m=>m.material);
 for(const m of list){Object.assign(m.userData,{assetId:asset.id,projectId:asset.projectId,sourceAssetSHA256:asset.downloadSHA256,lifecycle:asset.lifecycle});appearance.register(m,{authored:true});}
 appearance.setMode('status');appearance.setMode('natural');list.forEach((m,i)=>assert.equal(m.material,materials[i]));
 appearance.dispose();dispose(scene);
});

test('actual district adapter and cached scenario changes show M3 once without a study-page prerequisite',async()=>{
 const app=read('app.js').toString(),model=(await load('models/downtown.glb')).scene;
 const original=meshes(model).filter(m=>m.userData.id==='63-6249');assert.equal(original.length,1);assert.equal(original[0].geometry.index.count/3,32);
 const positions=original[0].geometry.attributes.position.array.slice();
 const appearance=createModelAppearance(THREE),district=json('districts').find(d=>d.id==='downtown');
 const state={THREE,district,id:'downtown',nextModel:model,refinementData:{...refinements,assets:[asset]},refinementInDistrict,overrides:json('overrides'),projectById:new Map(projects.map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle,token:1,loadToken:1,window:{},splitSourceOverlaps,loadAsset:load,model,modelMeshes:[],draftToggle:{checked:false},selectedStudyProjectId:null,treeMeshes:[],markers:[],detailMeshes:[],transitGroup:{},markerGroup:{},syncStatusLegend(){},applyModelVisibility,$:id=>({checked:id==='#unknownStatusToggle'})};
 vm.runInNewContext(app.split('\n').filter(s=>s.startsWith('function classify(')||s.startsWith('function lifecycleFor(')).join('\n'),state);
 const eagerStart=app.indexOf('const additionAssets='),eagerEnd=app.indexOf(' const detail=await loadAsset',eagerStart);assert(eagerStart>0&&eagerEnd>eagerStart);
 await vm.runInNewContext('(async()=>{'+app.slice(eagerStart,eagerEnd)+'})()',state);
 const passStart=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),passEnd=app.indexOf(';nextContext.traverse',passStart);assert(passStart>0&&passEnd>passStart);
 vm.runInNewContext(app.slice(passStart,passEnd+1)+'modelMeshes=nextModelMeshes;',state);
 const visibilityStart=app.indexOf('let visibilityCacheKey='),visibilityEnd=app.indexOf('let statusLegendSignature=');assert(visibilityStart>0&&visibilityEnd>visibilityStart);
 vm.runInNewContext(app.slice(visibilityStart,visibilityEnd),state);
 const native=state.modelMeshes.filter(m=>m.userData.assetId===asset.id);assert.equal(native.length,39);assert(native.every(m=>!m.userData.outsideDistrict));
 assert.equal(original[0].userData.sourceReplacements.length,1);assert.equal(original[0].userData.sourceReplacements[0].assetId,asset.id);
 // Direct entry, then the study deep link, use the same eligible meshes.
 for(const selected of [null,'mcity-3']){state.selectedStudyProjectId=selected;for(const mode of ['future','construction','existing','construction','future']){
  vm.runInNewContext('applyVisibility('+JSON.stringify(mode)+')',state);
  assert.equal(native.filter(m=>m.visible).length,mode==='existing'?0:39,`${selected}: ${mode}`);assert.equal(original[0].visible,false);
 }}
 // Unavailable detail restores the original source policy; Existing is unchanged.
 for(const mode of ['existing','construction','future']){applyModelVisibility(original,mode,{unknownStatuses:false});assert.equal(original[0].visible,mode!=='existing');}
 assert.deepEqual(original[0].geometry.attributes.position.array,positions);appearance.dispose();dispose(model);
});

function parseCSV(text){const rows=[];let row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c;}if(value||row.length){row.push(value);rows.push(row);}const [headers,...data]=rows;return {headers,rows:data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))};}
test('M3 CSV mirrors only the two current model notes and keeps every other exported fact',()=>{
 const expected=JSON.parse(readFileSync(new URL('./mcity-m3-v7-register-scope.json',import.meta.url))),csv=parseCSV(restoreM1M2Register(read('downloads/project-register.csv').toString()));
 const row=csv.rows.find(r=>r.id==='mcity-3');for(const field of Object.keys(expected.oldModelFields))assert.equal(row[field],project[field]);
 Object.assign(row,expected.oldModelFields);assert.equal(fingerprint({header:csv.headers,rows:csv.rows}),expected.priorFingerprint);
 const html=read('accuracy-review.html').toString(),cell=html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g).find(row=>row.includes('project=mcity-3"'));
 assert(cell);assert.match(cell,/changing tower outline, stepped crown and raised glass pavilion/);assert.match(cell,/approximate/);
});
import {restoreM1M2Projects,restoreM1M2Register} from './mcity-m1-m2-v5-scope.mjs';
