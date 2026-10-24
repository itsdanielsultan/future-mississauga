import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyModelVisibility} from '../public/model-visibility.js';
const publicRoot=new URL('../public/',import.meta.url);
const assets=JSON.parse(readFileSync(new URL('data/refinement-models.json',publicRoot))).assets;
function sourceMeshes(url){
 const bytes=readFileSync(new URL(url,publicRoot));
 const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 return data.meshes.flatMap(mesh=>mesh.primitives.map(primitive=>({
  userData:{...mesh.extras,displayStatus:mesh.extras?.Status},
  geometry:{attributes:{position:{count:data.accessors[primitive.attributes.POSITION].count}},index:primitive.indices===undefined?undefined:{count:data.accessors[primitive.indices].count}},
 })));
}
function fixture(){
 const study=assets.find(a=>a.projectId==='square-one-block22');
 const original=sourceMeshes('models/downtown.glb').filter(mesh=>study.replacesSourceIds.includes(mesh.userData.id));
 for(const mesh of original)mesh.userData.sourceReplacements=[{assetId:study.id,modes:study.replacementModes}];
 const models=[];
 for(const project of ['square-one-block22','merner-42-john','merner-41-bay']){
  const asset=assets.find(a=>a.projectId===project);
  for(const mesh of sourceMeshes(asset.url)){
   Object.assign(mesh.userData,{assetId:asset.id,projectId:project,displayStatus:asset.status==='Existing'?'Existing':'Proposed',draftStudy:!!asset.localOptional,modes:asset.modes,uncertain:!!asset.uncertainGeometry});
   models.push(mesh);
  }
 }
 return {all:[...original,...models],original,study,models};
}
const visibleFor=(meshes,project)=>meshes.filter(mesh=>mesh.visible&&mesh.userData.projectId===project&&mesh.userData.assetId);
test('one selected earlier study replaces only its own source version and return restores the source',()=>{
 const {all,original,models}=fixture();
 applyModelVisibility(all,'future');
 assert.equal(original.length,3);assert.ok(original.every(mesh=>mesh.visible));
 assert.equal(visibleFor(models,'square-one-block22').length,0);
 assert.equal(visibleFor(models,'merner-42-john').length,0);
 assert.ok(visibleFor(models,'merner-41-bay').length>0);
 applyModelVisibility(all,'future',{selectedStudyProjectId:'square-one-block22'});
 assert.equal(visibleFor(models,'square-one-block22').length,6);
 assert.equal(visibleFor(models,'merner-42-john').length,0);
 assert.ok(original.every(mesh=>!mesh.visible));
 assert.ok(visibleFor(models,'merner-41-bay').length>0);
 applyModelVisibility(all,'future',{selectedStudyProjectId:null});
 assert.ok(original.every(mesh=>mesh.visible));assert.equal(visibleFor(models,'square-one-block22').length,0);
});
test('existing and construction scenarios never show the selected future-only dated study',()=>{
 const {all,models}=fixture();
 for(const scenario of ['existing','construction']){
  applyModelVisibility(all,scenario,{selectedStudyProjectId:'square-one-block22',referenceStudies:true});
  assert.equal(visibleFor(models,'square-one-block22').length,0);
  assert.equal(visibleFor(models,'merner-42-john').length,0);
  assert.ok(visibleFor(models,'merner-41-bay').length>0);
 }
});
test('showing all earlier studies requires the explicit global filter, and keeps other filters intact',()=>{
 const {all,models,original}=fixture();
 applyModelVisibility(all,'future',{referenceStudies:true});
 assert.equal(visibleFor(models,'square-one-block22').length,6);
 assert.equal(visibleFor(models,'merner-42-john').length,7);
 applyModelVisibility(all,'future',{selectedStudyProjectId:'square-one-block22',uncertainVersions:false});
 assert.equal(visibleFor(models,'square-one-block22').length,0);
 assert.ok(original.every(mesh=>mesh.visible));
 for(const mesh of models)if(mesh.userData.projectId==='square-one-block22')mesh.userData.hiddenObsolete=true;
 applyModelVisibility(all,'future',{referenceStudies:true,selectedStudyProjectId:'square-one-block22'});
 assert.equal(visibleFor(models,'square-one-block22').length,0);assert.ok(original.every(mesh=>mesh.visible));
});
