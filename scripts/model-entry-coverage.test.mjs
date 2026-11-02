import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {cityModelStudies,bindStudyReplacement} from '../public/city-model-studies.js';
import {createOptionalRefinementLoader,shouldLoadRefinement,refinementInDistrict} from '../public/refinement-loading.js';
import {createModelAppearance} from '../public/model-appearance.js';
import {resolveModelLifecycle,displayStatusForLifecycle} from '../public/model-status-materials.js';
import {applyModelVisibility} from '../public/model-visibility.js';
const read=name=>JSON.parse(readFileSync(new URL('../public/data/'+name,import.meta.url)));
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const assets=cityModelStudies(read('refinement-models.json').assets,read('model-previews.json'));
const districts=read('districts.json');
const classify=app.split('\n').filter(line=>line.startsWith('function classify(')||line.startsWith('function lifecycleFor(')).join('\n');
const eagerStart=app.indexOf('const additionAssets='),eager=app.slice(eagerStart,app.indexOf(" const detail=await loadAsset",eagerStart));
const passStart=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),pass=app.slice(passStart,app.indexOf(';nextContext.traverse',passStart)+1);
const lazy=app.slice(app.indexOf('async function ensureOptionalRefinements(){'),app.indexOf('function modelDownloads(p)'));

// Exercise the actual eager and lazy attachment paths without a preceding
// model-page visit. Network/GLB decoding and terrain preparation use bounded
// fixtures; harborn-terrain.test.mjs independently checks the actual ground mesh.
async function enter(district,selectedStudyProjectId,appearanceMode,{terrain='ready'}={}){
 const target=new THREE.Group(),nextContext=new THREE.Group(),appearance=createModelAppearance(THREE,{initial:appearanceMode}),requests=[],prepared=[],disposed=[];
 const terrainSpec=terrain==='missing'?null:{contract:{district:district.id},weights:new Uint8Array([1])};
 const make=asset=>{
  requests.push(asset.id);const scene=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial({color:0x506070}));
  const b=asset.bounds||[[district.bounds[0],0,district.bounds[1]],[district.bounds[2],1,district.bounds[3]]];
  const x=(Math.max(b[0][0],district.bounds[0])+Math.min(b[1][0],district.bounds[2]))/2,z=(Math.max(b[0][2],district.bounds[1])+Math.min(b[1][2],district.bounds[3]))/2;
  mesh.position.set(x,b[0][1],z);scene.add(mesh);return {scene};
 };
 const state={THREE,district,id:district.id,current:district,model:target,nextModel:target,token:1,loadToken:1,window:{atlasReady:district.id},refinementData:{assets,constructionEvidence:[]},overrides:read('overrides.json'),projectById:new Map(read('projects.json').map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,refinementInDistrict,shouldLoadRefinement,selectedStudyProjectId,draftToggle:{checked:false},studyStatusRequest:0,optionalRefinementLoaders:new WeakMap(),createOptionalRefinementLoader,bindStudyReplacement,splitSourceOverlaps:()=>[],loadAsset:async url=>make(assets.find(a=>a.url===url)),loadCityStudy:async(_three,_loader,asset)=>make(asset),loadModelAsset:async(_loader,url)=>make(assets.find(a=>a.url===url)),loader:{},versionedTreeURL:x=>x,dispose:()=>{},visibleAttribution:{registerAsset(){},refresh(){}},invalidate(){},showStudyLoadStatus(){},mode:'future',visibilityCacheKey:'',lastLayerVisibilityKey:'',console};
 Object.assign(state,{nextContext,terrainSpec,nextTerrainController:null,pending:new Set(),
  prepareHarbornTerrain:async(_three,options)=>{
   assert.equal(options.context,nextContext);assert.equal(options.contract,terrainSpec.contract);
   assert.equal(options.weights,terrainSpec.weights);assert.equal(options.district,district.id);
   prepared.push(options.candidate);
   if(terrain==='rejected')throw new Error('Terrain binding rejected');
   return {dispose(){}};
  },dispose:object=>disposed.push(object),console:{...console,warn(){}}});
 state.applyVisibility=which=>applyModelVisibility(state.modelMeshes,which,{referenceStudies:false,selectedStudyProjectId,unknownStatuses:true});
 runInNewContext(classify,state);
 await runInNewContext('(async()=>{'+eager+'})()',state);
 runInNewContext(pass+';modelMeshes=nextModelMeshes;futureMeshes=nextFutureMeshes;',state);
 state.applyVisibility('future');
 await runInNewContext(lazy+';ensureOptionalRefinements()',state);
 const visible=()=>[...new Set(state.modelMeshes.filter(m=>m.visible).map(m=>m.userData.assetId))].sort();
 const before=visible();appearance.setMode(appearanceMode==='natural'?'status':'natural');state.applyVisibility('future');assert.deepEqual(visible(),before,'appearance toggle preserves eligible visible detail');
 const attached=state.modelMeshes.map(m=>m.userData.assetId);
 for(const candidate of prepared)assert.equal(candidate.parent===target,terrain!=='rejected','only prepared terrain joins the model');
 for(const candidate of disposed)assert(!target.children.includes(candidate),'rejected terrain remains detached');
 appearance.dispose();return {loaded:requests.sort(),visible:before,attached:[...new Set(attached)].sort(),prepared:prepared.length,disposed:disposed.length};
}

test('direct map entry, area selection and study deep links expose the same eligible default detail',async()=>{
 for(const id of ['downtown','citywide','cooksville','heartland']){
  const district=districts.find(d=>d.id===id),expected=assets.filter(a=>refinementInDistrict(a,district)&&shouldLoadRefinement(a)).map(a=>a.id).sort();
  const direct=await enter(district,null,'natural');assert.deepEqual(direct.loaded,expected,id+' loads every eligible default asset');
  for(const [route,selected,mode]of[['district selection',null,'status'],['M City study link','mcity-1-2','natural'],['Avia study link','avia','status']]){
   const result=await enter(district,selected,mode);assert.deepEqual(result,direct,id+' '+route+' preserves default coverage');
  }
 }
});

test('missing or rejected terrain withholds only its replacement and keeps other default detail',async()=>{
 const district=districts.find(d=>d.id==='cooksville');
 const eligible=assets.filter(a=>refinementInDistrict(a,district)&&shouldLoadRefinement(a));
 const terrainAssets=eligible.filter(a=>a.terrainAdapter).map(a=>a.id);
 assert(terrainAssets.length>0,'the real catalogue exercises a terrain-bound replacement');
 const ready=await enter(district,null,'natural');
 assert.equal(ready.prepared,terrainAssets.length);
 const unaffected=ready.attached.filter(id=>!terrainAssets.includes(id));
 for(const terrain of ['missing','rejected']){
  const result=await enter(district,null,'natural',{terrain});
  assert.deepEqual(result.attached,unaffected,'unrelated detail survives '+terrain+' terrain');
  assert.deepEqual(result.visible,ready.visible.filter(id=>!terrainAssets.includes(id)));
  assert.equal(result.prepared,terrain==='rejected'?terrainAssets.length:0);
  assert.equal(result.disposed,terrain==='rejected'?terrainAssets.length:0);
  assert.deepEqual(result.loaded,terrain==='rejected'?ready.loaded:ready.loaded.filter(id=>!terrainAssets.includes(id)));
 }
});
