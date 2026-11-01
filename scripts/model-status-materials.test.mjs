import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {statusColours,statusMaterialKey,resolveModelLifecycle,displayStatusForLifecycle} from '../public/model-status-materials.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const assets=JSON.parse(readFileSync(new URL('../public/data/refinement-models.json',import.meta.url))).assets;
const classifySource=app.split('\n').filter(line=>line.startsWith('function classify(')||line.startsWith('function lifecycleFor(')).join('\n');
const mainStart=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];');
const mainPass=app.slice(mainStart,app.indexOf(';nextContext.traverse',mainStart)+1);
const accentStart=app.indexOf("const role=(o.userData.role||'')+' '+o.name;");
const accentPass=app.slice(accentStart,app.indexOf('o.userData.nativeTexture=true;',accentStart)+'o.userData.nativeTexture=true;'.length)+'}';
const optionalPass=app.split('\n').find(line=>line.includes("if(!asset.preserveMaterials){if(o.userData.displayStatus==='Existing')"));
const makeMaterials=()=>Object.fromEntries(Object.entries(statusColours).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color})]));
function mesh(status,uncertainGeometry,name='tower-body'){
 const result=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));result.name=name;
 Object.assign(result.userData,{Status:status,uncertainAsset:uncertainGeometry});return result;
}
function context(overrides={}){
 const result={THREE,statusColours,statusMaterialKey,resolveModelLifecycle,displayStatusForLifecycle,projectById:new Map(),groupById:new Map(),groupByMesh:new Map(),overrides,materials:makeMaterials(),existingStyleIndex:{},applyExistingStyle(){},refinementData:{constructionEvidence:[]}};
 runInNewContext(classifySource,result);return result;
}

test('construction and geometry confidence are independent in all three real material paths',()=>{
 for(const id of ['mcity-m5-developer-proxy','voya-towers-plan-derived']){
  const recorded=assets.find(asset=>asset.id===id);assert.ok(recorded,id);assert.equal(recorded.status,'Under Construction');assert.equal(recorded.uncertainGeometry,true);
  for(const uncertainGeometry of [false,true]){
   const asset={...recorded,uncertainGeometry},body=mesh(asset.status,uncertainGeometry),nextModel=new THREE.Group();nextModel.add(body);
   const run=context();Object.assign(run,{nextModel,asset});runInNewContext(mainPass,run);
   assert.equal(body.userData.displayStatus,'Under Construction',id);
   assert.equal(body.material.color.getHex(),statusColours['Under Construction'],id+' body');
   assert.equal(body.userData.uncertain,uncertainGeometry,id+' keeps its confidence flag');
   const slab=mesh(asset.status,uncertainGeometry,'terrace-slab');run.o=slab;runInNewContext(accentPass,run);
   assert.equal(slab.material.color.getHex(),statusColours['Under Construction'],id+' slab');assert.equal(slab.userData.nativeTexture,true);
   const optional=mesh(asset.status,uncertainGeometry);run.o=optional;runInNewContext(optionalPass,run);
   assert.equal(optional.material.color.getHex(),statusColours['Under Construction'],id+' lazy detail');
  }
 }
});

test('existing and proposed status colours do not change when geometry is approximate',()=>{
 for(const status of ['Existing','Proposed'])for(const uncertainGeometry of [false,true]){
  const body=mesh(status,uncertainGeometry),nextModel=new THREE.Group();nextModel.add(body);const run=context();run.nextModel=nextModel;
  runInNewContext(mainPass,run);assert.equal(body.material.color.getHex(),statusColours[status]);
  assert.equal(body.userData.uncertain,uncertainGeometry);
 }
});

test('explicit uncertain status remains distinct from an uncertain shape',()=>{
 const body=mesh('Proposed',false);body.userData.id='source';const nextModel=new THREE.Group();nextModel.add(body);
 const run=context({source:{displayStatus:'Uncertain',includeInVerifiedScenario:false}});run.nextModel=nextModel;runInNewContext(mainPass,run);
 assert.equal(body.material.color.getHex(),statusColours.Uncertain);assert.equal(body.userData.uncertain,true);
 assert.equal(statusMaterialKey('Under Construction'),'Under Construction','a resolved construction status has priority');
 assert.equal(statusMaterialKey('Existing'),'Existing');
});

test('approved and dated proposal assets keep their separate lifecycle materials',()=>{
 for(const status of ['Approved','Proposed; dated 2024 reference','Proposed; applicant on hold']){
  const run=context();run.asset={status,uncertainGeometry:true};run.o=mesh(status,true);runInNewContext(optionalPass,run);
  assert.equal(run.o.material.color.getHex(),statusColours[status==='Approved'?'Approved':status.includes('on hold')?'On Hold':'Proposed'],status);
  assert.equal(run.o.userData.Status,status,'the source status remains unchanged');
 }
});

test('source materials are preserved independently of status and confidence',()=>{
 const run=context(),original=new THREE.MeshStandardMaterial({color:0x445566});run.asset={status:'Under Construction',uncertainGeometry:true,preserveMaterials:true};run.o=mesh(run.asset.status,true);run.o.material=original;
 runInNewContext(optionalPass,run);assert.equal(run.o.material,original);
});
