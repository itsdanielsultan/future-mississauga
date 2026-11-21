import {readBeforePlanningReview} from './planning-review-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {registryReconciliationScope as scope,registryReconciliationIds,restoreRegistryReconciliationRecord,restoreRegistryReconciliationJSON,restoreRegistryReconciliationRegister,restoreRegistryReconciliationUpdates,restoreRegistryReconciliationOverrides,restoreRegistryReconciliationGroups} from './registry-reconciliation-scope.mjs';
import {resolveModelLifecycle,displayStatusForLifecycle} from '../public/model-status-materials.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {projectStatus} from '../public/project-cards.js';
const root=new URL('../',import.meta.url),read=path=>readBeforePlanningReview(new URL(path,root),'utf8'),json=path=>JSON.parse(read(path));
const projects=json('public/data/projects.json'),project=id=>projects.find(p=>p.id===id),overrides=json('public/data/overrides.json');
const baseline='1bab6c6c165fcbfd180d3583e1075d78f512ba03';
const prior=path=>JSON.parse(execFileSync('git',['show',baseline+':'+path],{encoding:'utf8',maxBuffer:32*1024*1024}));
const oldProjects=prior('public/data/projects.json'),oldOverrides=prior('public/data/overrides.json');
const johnIds=Array.from({length:7},(_,i)=>'72-'+(6105+i));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// These are exact review fields, not an unrestricted metadata exception.
const permitted={
 'john-69':['status','statusDate','application','summary','modelCaveat','geometryCoverage','statusEvidenceDate','lastStatusReview','lifecycle','lifecycleReviewedOn','lifecycleConfidence','lifecycleNote','lifecycleSourceRefs','applicationStatus','statusHistory','sources'],
 'tenth-data':['summary','modelCaveat','sources','geometrySources','lastStatusReview','latestSourcePackage'],
 'lakeshore-857-859':['application','lastStatusReview','summary','modelCaveat','evidenceUpdateNote','currentApplicationRecord','sources'],
 'lorne-1110-townhomes':['application','holdingRemovalApplication','lastStatusReview','summary','lifecycleReviewedOn','lifecycleNote','evidenceUpdateNote','sources','lifecycleSourceRefs']
};
test('four exact source corrections preserve every other project and all geometry fields',()=>{
 assert.deepEqual([...registryReconciliationIds].sort(),Object.keys(permitted).sort());
 for(const id of registryReconciliationIds){
  const p=project(id),before=oldProjects.find(p=>p.id===id);
  assert.deepEqual(Object.keys(scope.projects[id]).sort(),permitted[id].sort());
  assert.deepEqual(restoreRegistryReconciliationRecord('projects',p),before,id);
  assert.deepEqual(p.sources.slice(0,before.sources.length),before.sources,id+' retains dated source claims');
  for(const source of p.sources.slice(before.sources.length)){
   assert.equal(source.accessed||source.checked,'2026-11-13');assert.equal(new URL(source.url).protocol,'https:');
  }
 }
 const changed=structuredClone(projects);changed.find(p=>p.id==='john-69').position[0]+=1;
 assert.throws(()=>restoreRegistryReconciliationJSON(JSON.stringify(changed,null,2)),/protected project fields/);
 const corrupt=structuredClone(project('john-69'));corrupt.applicationStatus.cancellationDate='2024-12-17';
 assert.throws(()=>restoreRegistryReconciliationRecord('projects',corrupt),/exact reviewed source fields/);
 for(const [file,hash] of Object.entries(scope.unchangedFiles))assert.equal(sha(readBeforePlanningReview(new URL(file,root))),hash,file);
});

test('the seven-row override guard preserves the original byte pin and rejects exclusion or source drift',()=>{
 const raw=read('public/data/overrides.json'),restored=restoreRegistryReconciliationOverrides(raw);
 assert.equal(sha(restored),'681d45800329659f0627c9f86f63617facd98e9bf2ed5c83cbfbc35318ea09af');
 assert.equal(restoreRegistryReconciliationOverrides(restored),restored);
 const changed=structuredClone(overrides);changed['72-6105'].excludeSuperseded=false;
 assert.throws(()=>restoreRegistryReconciliationOverrides(JSON.stringify(changed,null,2)+'\n'),/protected override fields/);
 changed['72-6105'].excludeSuperseded=true;changed['72-6105'].lifecycle='proposed';
 assert.throws(()=>restoreRegistryReconciliationOverrides(JSON.stringify(changed,null,2)+'\n'),/exact reviewed source fields/);
});

test('John Street cancellation comes from the exact native City file, without inventing its event date',()=>{
 const p=project('john-69');assert.equal(p.status,'Application cancelled');assert.equal(p.lifecycle,'cancelled');assert.equal(p.statusDate,null);
 assert.equal(p.statusEvidenceDate,'2026-11-13');assert.equal(p.application,'OZ/OPA 24 16');
 assert.deepEqual(p.applicationStatus,{file:'OZ/OPA 24 16',status:'CANCELLED APPLICATION',appliedDate:'2024-12-17',cancellationDate:null,verifiedAtUTC:'2026-11-13T05:54:51Z',sourceURL:'https://www.mississauga.ca/apps/#/property/view/development-applications'});
 assert.deepEqual(projectStatus(p),{label:'Cancelled',tone:'neutral'});
 assert.deepEqual(p.modelMeshIds,johnIds);assert.deepEqual(p.meshIds,johnIds);assert.deepEqual(p.retainedMeshIds,[]);
 assert(p.sources.some(s=>s.verification==='native-city-result'&&s.claims.some(c=>c.includes('CANCELLED APPLICATION'))));
 assert(p.sources.some(s=>s.accessed==='2026-11-13'&&s.claims.some(c=>c.includes('69 and 117 John Street East'))));
 assert.match(p.summary,/historical proposal/);assert.match(p.modelCaveat,/Existing context remains/);
 assert.equal(scope.reviewSHA256,'5528fb848fcf267ed9ad2e9c2e9efa0ac179466ce0bffb80f8bf953fe01e610e');
 assert.equal(scope.johnNativeStatusAddendumSHA256,'a536229854ea4c977d11b4d55306c93a076d9885361326ebf4128e7ea1869287');
});

function meshes(path){
 const bytes=readFileSync(new URL(path,root));const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 return gltf.meshes.flatMap(mesh=>mesh.primitives.map(primitive=>({userData:structuredClone(mesh.extras||{}),geometry:{attributes:{position:{count:gltf.accessors[primitive.attributes.POSITION].count}},index:primitive.indices===undefined?undefined:{count:gltf.accessors[primitive.indices].count}}})));
}
function classify(mesh,lookup){
 const d=mesh.userData,ov=lookup[d.id]||{},p=project(ov.projectId||d.projectId)||{};
 d.lifecycle=resolveModelLifecycle(d,ov,p);d.displayStatus=displayStatusForLifecycle(d.lifecycle);d.projectId=ov.projectId||d.projectId;
 d.hiddenObsolete=Boolean(ov.excludeSuperseded||ov.excludeDuplicate||d.replacedByNative||d.outsideDistrict);
}
test('only seven cancelled scheme overrides change; actual district and city models retain their context',()=>{
 const changed=Object.keys(overrides).filter(id=>JSON.stringify(overrides[id])!==JSON.stringify(oldOverrides[id]));
 // Five earlier M City notes and lifecycle metadata are independently reviewed;
 // this current source review affects exactly the seven pinned John Street IDs.
 assert.deepEqual(Object.keys(scope.overrides).sort(),johnIds.sort());
 for(const id of johnIds){
  assert(changed.includes(id));const ov=overrides[id];assert.equal(ov.projectId,'john-69');assert.equal(ov.excludeSuperseded,true);assert.equal(ov.lifecycle,'cancelled');
  assert.deepEqual(restoreRegistryReconciliationRecord('overrides',ov,id),oldOverrides[id]);
  assert.deepEqual(Object.keys(scope.overrides[id]).sort(),['status','lifecycle','lifecycleReviewedOn','lifecycleNote','lifecycleSourceRefs'].sort());
  // Reintroduced source components are rejected even if the older superseded
  // flag were not present. Selection and the study toggle cannot revive them.
  const mesh={userData:{id,Status:'Proposed',lifecycle:'proposed'}};classify(mesh,overrides);mesh.userData.hiddenObsolete=false;
  for(const mode of ['existing','construction','future']){
   applyModelVisibility([mesh],mode,{referenceStudies:true,selectedStudyProjectId:'john-69'});assert.equal(mesh.visible,false,id+' '+mode);
  }
 }
 for(const path of ['public/models/cooksville.glb','public/models/citywide.glb']){
  const scene=meshes(path),original=structuredClone(scene);
  assert.equal(scene.filter(m=>johnIds.includes(m.userData.id)||m.userData.projectId==='john-69').length,0,path+' already excludes old proposed shapes');
  scene.forEach(m=>classify(m,overrides));original.forEach(m=>classify(m,oldOverrides));
  for(const mode of ['existing','construction','future']){
   applyModelVisibility(scene,mode);applyModelVisibility(original,mode);
   assert.deepEqual(scene.map(m=>m.visible),original.map(m=>m.visible),path+' preserves all unrelated component visibility in '+mode);
   assert(scene.some(m=>m.visible&&m.userData.lifecycle==='existing'),path+' retains built context');
  }
  const adjacent=scene.filter(m=>['hurontario-3085','hurontario-3115'].includes(m.userData.projectId));
  assert(adjacent.length>0);applyModelVisibility(scene,'future');assert(adjacent.some(m=>m.visible),'neighbouring proposals are not removed');
 }
 const assets=json('public/data/refinement-models.json').assets;assert.equal(assets.filter(a=>a.projectId==='john-69').length,0,'no replacement asset can reintroduce this cancelled scheme');
});

test('the exact linked municipal group receives current cancellation without rewriting its historical inventory',()=>{
 const groups=json('public/data/groups.json'),group=groups.find(g=>g.id==='city-group-83'),before=prior('public/data/groups.json').find(g=>g.id===group.id);
 assert.deepEqual(Object.keys(scope.groups),['city-group-83']);assert.deepEqual(group.meshIds,johnIds);assert.deepEqual(group.reviewedProjectIds,['john-69']);
 assert.equal(group.OZ,'OZ 24 16');assert.equal(group.status,'Proposed');assert.equal(group.asOf,'2026-09-20');
 assert.equal(group.lifecycle,'cancelled');assert.match(group.currentStatus,/Application cancelled/);assert.equal(group.statusEvidenceDate,'2026-11-13');
 assert.deepEqual(restoreRegistryReconciliationRecord('groups',group),before);
 assert.deepEqual(Object.keys(scope.groups[group.id]).sort(),['currentStatus','lifecycle','lifecycleReviewedOn','lifecycleNote','lifecycleSourceRefs','statusEvidenceDate','sources'].sort());
 const oldText=execFileSync('git',['show',baseline+':public/data/groups.json'],{encoding:'utf8'});
 assert.equal(restoreRegistryReconciliationGroups(read('public/data/groups.json')),oldText);
 const changed=structuredClone(groups);changed.find(g=>g.id===group.id).meshIds.push('72-6112');
 assert.throws(()=>restoreRegistryReconciliationGroups(JSON.stringify(changed,null,2)+'\n'),/protected group fields/);
});

test('Tenth Line records package and sheet dates separately while preserving its pause and address ambiguity',()=>{
 const p=project('tenth-data'),old=oldProjects.find(p=>p.id==='tenth-data'),s=p.latestSourcePackage;
 assert.equal(p.status,old.status);assert.equal(p.statusDate,old.statusDate);assert.equal(p.address,old.address);assert.deepEqual(p.position,old.position);
 assert.equal(s.coverLetterDate,'2026-10-15');assert.equal(s.elevationIssueDate,'2026-07-04');assert.equal(s.elevationRevision,3);assert.equal(s.elevationSheet,'A.400');assert.equal(s.elevationIssue,'ISSUED FOR SPA');
 assert.equal(s.releasedForConstruction,false);assert.equal(s.geometryChangeVerified,false);assert.equal(p.geometryVerifiedCurrent,false);
 assert.deepEqual(p.geometrySources.slice(0,old.geometrySources.length),old.geometrySources);assert.equal(p.geometrySources.at(-1).geometryAdopted,false);
 assert.match(p.modelCaveat,/7700 Tenth Line West.*0 Tenth Line West.*7564 Tenth Line West/);assert.match(p.modelCaveat,/not released for construction/);
 assert.equal(p.actualCompletionDate,null);assert.deepEqual(p.meshIds,[]);
});

test('Lakeshore transfer and Lorne Park holding removal retain their exact scope',()=>{
 const lake=project('lakeshore-857-859'),lorne=project('lorne-1110-townhomes');
 assert.equal(lake.application,'SP 24/051');assert.equal(lake.currentApplicationRecord.linkedHistoricalFile,'SP 18/110');assert.equal(lake.currentApplicationRecord.planningApplicationId,187683);
 assert.equal(lake.currentApplicationRecord.status,'Active');assert.equal(lake.currentApplicationRecord.approvalDate,null);assert.deepEqual(lake.currentApplicationRecord.growthSnapshot,{asOf:'2026-08-25',status:'Withheld'});
 assert.equal(lake.status,'Redesign in progress; latest drawings unavailable');assert.equal(lake.statusDate,'2026-10-05');assert.equal(lake.includeInModel,false);assert.deepEqual(lake.storeys,[]);assert.deepEqual(lake.heightM,[]);assert.deepEqual(lake.meshIds,[]);
 assert.equal(lorne.application,'OZ-OPA 19/006');assert.equal(lorne.holdingRemovalApplication,'H-OZ/22/002');assert.equal(lorne.lifecycle,'approved');
 assert.match(lorne.lifecycleNote,/January 6, 2022.*February 28, 2024/);assert.match(lorne.lifecycleNote,/do not establish building permits, construction start, occupancy or completion/);
 assert.equal(lorne.proposedGeometryAvailable,false);assert.equal(lorne.actualCompletionDate,null);assert.deepEqual(lorne.meshIds,[]);
});

function csvRows(text){
 const lines=text.trimEnd().split('\n').map(line=>{const result=[];let value='',quoted=false;for(let i=0;i<line.length;i++){if(line[i]==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(line[i]===','&&!quoted){result.push(value);value='';}else value+=line[i];}result.push(value);return result;});
 const [keys,...data]=lines;return data.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]])));
}
test('current CSV, Accuracy and research use the same qualified source facts',()=>{
 const csv=read('public/downloads/project-register.csv'),rows=csvRows(csv),html=read('public/accuracy-review.html'),research=json('public/data/recent-project-updates.json');
 for(const id of registryReconciliationIds){
  const p=project(id),row=rows.find(r=>r.id===id),card=html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g).find(r=>r.includes('project='+id+'"')),note=research.changes.find(r=>r.projectId===id);
  for(const key of ['status','statusDate','geometryCoverage','modelCaveat','lifecycle','lifecycleReviewedOn','lifecycleNote'])assert.equal(row[key],p[key]??'',id+' '+key);
  assert.deepEqual(JSON.parse(row.sources),p.sources);assert(card.includes(p.sources.length+' linked sources'));
  assert(card.includes('data-status="'+projectStatus(p).label+'"'),id);assert(card.includes('<td data-label="Status">'+projectStatus(p).label+'<'));
  assert.equal(note.change,p.summary);assert.equal(note.status,p.status);assert.equal(note.evidenceDate,'2026-11-13');
 }
 assert.throws(()=>restoreRegistryReconciliationRegister(csv.replace('john-69,69–117 John Street,','john-69,An invented new scheme,')),/protected CSV name/);
 const restored=restoreRegistryReconciliationUpdates(research),before=prior('public/data/recent-project-updates.json');
 // The bridge forecast is a separately qualified November 13 review.
 const bridge='port-credit-active-transportation-bridge';restored.changes[restored.changes.findIndex(r=>r.projectId===bridge)]=before.changes.find(r=>r.projectId===bridge);
 assert.deepEqual(restored,before);
 assert.doesNotMatch(JSON.stringify(projects.filter(p=>registryReconciliationIds.has(p.id))),/\/Users\/|gmail|threadId|file:\/\//i);
});
