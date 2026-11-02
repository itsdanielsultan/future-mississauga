import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {statusColours,statusMaterialKey,resolveModelLifecycle,displayStatusForLifecycle} from '../public/model-status-materials.js';
import {createModelAppearance,NATURAL_MASSING_COLOUR} from '../public/model-appearance.js';
import {planningAppearanceKey,planningAppearanceColour} from '../public/planning-appearance.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const assets=JSON.parse(readFileSync(new URL('../public/data/refinement-models.json',import.meta.url))).assets;
const classifySource=app.split('\n').filter(line=>line.startsWith('function classify(')||line.startsWith('function lifecycleFor(')).join('\n');
const mainStart=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),mainPass=app.slice(mainStart,app.indexOf(';nextContext.traverse',mainStart)+1);
const optionalPass=app.split('\n').filter(line=>line.includes('o.userData.lifecycle=lifecycleFor(o.userData)')||line.includes('appearance.register(o,{authored:Boolean(asset.preserveMaterials)})')).join('\n');
function mesh(status,uncertainGeometry,name='tower-body'){
 const result=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));result.name=name;Object.assign(result.userData,{Status:status,uncertainAsset:uncertainGeometry});return result;
}
function context(overrides={}){
 const result={THREE,resolveModelLifecycle,displayStatusForLifecycle,projectById:new Map(),groupById:new Map(),groupByMesh:new Map(),overrides,appearance:createModelAppearance(THREE),refinementData:{constructionEvidence:[]}};runInNewContext(classifySource,result);return result;
}
test('actual eager body and slab paths keep construction lifecycle separate from confidence and appearance',()=>{
 for(const id of ['mcity-m5-authored-detail-20261101','voya-towers-plan-derived'])for(const uncertainGeometry of [false,true]){
  const asset=assets.find(a=>a.id===id);assert(asset);assert.equal(asset.lifecycle,'under_construction');
  const nextModel=new THREE.Group(),body=mesh(asset.status,uncertainGeometry),slab=mesh(asset.status,uncertainGeometry,'terrace-slab');nextModel.add(body,slab);const run=context();run.nextModel=nextModel;runInNewContext(mainPass,run);
  for(const object of [body,slab]){assert.equal(object.userData.lifecycle,'under_construction');assert.equal(object.userData.uncertain,uncertainGeometry);assert.equal(object.material.color.getHex(),NATURAL_MASSING_COLOUR);assert(!object.userData.nativeTexture);}
  run.appearance.setMode('status');for(const object of [body,slab])assert.equal(object.material.color.getHex(),statusColours['Under Construction']);run.appearance.dispose();
 }
});
test('actual lazy commit preserves authored finishes by default and uses consistent optional status colours',()=>{
 for(const authored of [false,true])for(const uncertainGeometry of [false,true]){
  const run=context(),original=new THREE.MeshStandardMaterial({color:0x445566});run.asset={status:'Under Construction',preserveMaterials:authored};run.o=mesh(run.asset.status,uncertainGeometry);run.o.material=original;runInNewContext(optionalPass,run);
  assert.equal(run.o.userData.lifecycle,'under_construction');if(authored)assert.equal(run.o.material,original);else assert.equal(run.o.material.color.getHex(),NATURAL_MASSING_COLOUR);
  run.appearance.setMode('status');assert.equal(run.o.material.color.getHex(),statusColours['Under Construction']);run.appearance.setMode('natural');if(authored)assert.equal(run.o.material,original);run.appearance.dispose();
 }
});
test('explicit unknown lifecycle remains distinct from an uncertain shape',()=>{
 const run=context({source:{displayStatus:'Uncertain',includeInVerifiedScenario:false}}),body=mesh('Proposed',false);body.userData.id='source';run.nextModel=new THREE.Group();run.nextModel.add(body);runInNewContext(mainPass,run);
 assert.equal(body.userData.lifecycle,'unknown');assert.equal(body.userData.uncertain,true);assert.equal(body.material.color.getHex(),NATURAL_MASSING_COLOUR);run.appearance.setMode('status');assert.equal(body.material.color.getHex(),NATURAL_MASSING_COLOUR);run.appearance.dispose();
});
test('approved and dated source statuses retain factual classification in the lazy path',()=>{
 for(const status of ['Existing','Approved','Proposed; dated2024 reference','Proposed; applicant on hold']){
  const run=context();run.asset={preserveMaterials:false};run.o=mesh(status,true);runInNewContext(optionalPass,run);run.appearance.setMode('status');
  assert.equal(run.o.material.color.getHex(),planningAppearanceColour(planningAppearanceKey(run.o.userData)));assert.equal(run.o.userData.Status,status);run.appearance.dispose();
 }
});
test('the city runtime no longer generates decorative outlines or special status-tinted slabs',()=>{
 assert.doesNotMatch(app,/addArchitecturalEdges|architecturalEdges|detailToggle/);assert.doesNotMatch(app,/slab\|terrace\|column/);
});
