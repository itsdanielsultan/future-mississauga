import {withoutAcceptedModelFields as withoutModel,comparableMcityAssets,acceptedModelProjectIds} from './mcity-asset-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {statusMetadataScope as scope, withoutReviewedStatusMetadata as withoutStatus} from './status-metadata-scope.mjs';
import {mcityContentIds, withoutReviewedMcityContent as withoutMcity, withoutReviewedMcityNote as withoutMcityNote} from './mcity-content-scope.mjs';
const base='dc9bb6a53020ad77ef407affff56a8b94a585aab';
const read=f=>JSON.parse(fs.readFileSync(new URL('../public/data/'+f,import.meta.url)));
const prior=f=>JSON.parse(execFileSync('git',['show',base+':public/data/'+f],{maxBuffer:32*1024*1024}));
const projects=read('projects.json'),groups=read('groups.json'),overrides=read('overrides.json'),manifest=read('refinement-models.json');
const snapshot=read('project-lifecycle-20261101.json');
const project=id=>projects.find(p=>p.id===id), group=id=>groups.find(p=>p.id===id), asset=id=>manifest.assets.find(a=>a.id===id);
const allowed=new Set(['existing','under_construction','approved','proposed','on_hold','cancelled','unknown','mixed']);

for(const [kind,file,list] of [['projects','projects.json',projects],['groups','groups.json',groups],['assets','refinement-models.json',manifest.assets]]){
 test(`${kind}: exact reviewed IDs may only receive the listed new metadata; all prior fields remain intact`,()=>{
  const oldData=prior(file),old=kind==='assets'?oldData.assets:oldData;
  const comparable=rows=>(kind==='assets'?comparableMcityAssets(rows):rows).map(r=>withoutModel(kind,kind==='projects'?withoutMcity(withoutStatus(kind,r)):withoutStatus(kind,r)));
  assert.deepEqual(comparable(list),comparable(old));
  for(const r of list){
   const expected=scope[kind][r.id];
   if(!expected)continue;
   const before=old.find(x=>x.id===r.id);
   const metadataAfter=withoutModel(kind,kind==='projects'?withoutMcity(r):r),metadataBefore=withoutModel(kind,kind==='projects'?withoutMcity(before):before);
   assert.deepEqual(Object.keys(metadataAfter).filter(k=>!Object.hasOwn(metadataBefore,k)).sort(),expected);
   assert(allowed.has(r.lifecycle),r.id);assert.equal(r.lifecycleReviewedOn,'2026-11-01');
  }
  if(kind==='assets')assert.deepEqual({...manifest,assets:old},oldData,'manifest history and non-asset records stay unchanged');
 });
}
test('exact 209 mesh records receive status metadata without changing source fields, geometry or exclusion flags',()=>{
 const old=prior('overrides.json');assert.deepEqual(Object.keys(overrides),Object.keys(old));
 assert.equal(Object.keys(scope.overrides).length,209);
 for(const [id,r] of Object.entries(overrides)){
  assert.deepEqual(withoutMcityNote(withoutStatus('overrides',r,id),id),withoutMcityNote(old[id],id),id);
  if(scope.overrides[id]){
   assert.deepEqual(Object.keys(r).filter(k=>!Object.hasOwn(old[id],k)).sort(),scope.overrides[id]);
   assert(allowed.has(r.lifecycle));assert.notEqual(r.lifecycle,'mixed');
  }
 }
 for(const id of ['41-7753','23-6949'])assert.deepEqual(overrides[id],old[id],'excluded historical designs are untouched');
});
test('the 71 reviewed records preserve their identity and classify actual lifecycle separately from accuracy',()=>{
 assert.equal(Object.keys(scope.projects).length,48);assert.equal(Object.keys(scope.groups).length,23);
 assert.equal(snapshot.projects.length,71);assert.equal(new Set(snapshot.projects.map(x=>x.id)).size,71);
 assert.equal(snapshot.schema,'future-mississauga-project-lifecycle/v1');assert.equal(snapshot.baseline,base);
 for(const r of snapshot.projects){
  const record=r.recordType==='municipalGroup'?group(r.id):project(r.id);
  assert.equal(r.lifecycle,record.lifecycle);assert.equal(r.note,record.lifecycleNote);assert.deepEqual(r.sourceRefs,record.lifecycleSourceRefs);
  assert(r.sourceRefs.length);for(const url of r.sourceRefs)assert.equal(new URL(url).protocol,'https:');
 }
 for(const id of ['mcity-1-2','perla-towers','block-nine','st-hilarys-anglican-church'])assert.equal(project(id).lifecycle,'existing');
 for(const id of ['mcity-5','voya','lakeview-harbourwalk','city-group-30','village-green-725','clarkson-creekside-1639','south-common-community-centre'])assert.equal(project(id).lifecycle,'under_construction');
 for(const id of ['aldo-1422-study','courtney-630','merner-42-john'])assert.equal(project(id).lifecycle,'unknown');
 assert.equal(project('square-one-block22').lifecycle,'on_hold');
 for(const id of ['mcity-6','mcity-7-8'])assert.equal(project(id).planningSnapshot.asOf,'2026-10-29','separately verified M City content merged without geometry changes');
 const encoded=JSON.stringify(snapshot);assert.doesNotMatch(encoded,/\/Users\/|gmail|messageId|threadId|file:\/\//i);
});
test('the seven newly verified site plans are approved, not completed or under construction',()=>{
 const expected={'city-group-139':'2025-11-25','city-group-156':'2025-05-13','city-group-158':'2025-07-02','city-group-55':'2026-01-27','city-group-70':'2025-08-19','city-group-81':'2025-09-11','city-group-9':'2025-12-19'};
 for(const [id,date] of Object.entries(expected)){
  const r=group(id);assert.equal(r.lifecycle,'approved');assert.equal(r.approvalStage,'Site plan approved '+date);assert.equal(r.statusEvidenceDate,'2026-11-01');assert.match(r.lifecycleNote,/Construction and completion have not been verified/);
 }
 assert.match(group('city-group-81').lifecycleNote,/2512 Argyle Road with 101 homes/);
 assert.match(project('emtc-northwest').approvalStage,/subdivision under review/);
 assert.match(project('ninth-6344').lifecycleNote,/deadline has passed; the appeal outcome has not been verified/);
 assert.match(project('longview-44-45').lifecycleNote,/appeal outcome and remaining holding conditions have not been verified/);
 assert.match(project('port-credit-88-park').lifecycleNote,/does not establish final site-plan approval/);
});
test('mixed communities have explicit component phases; retained existing office is not coloured as new construction',()=>{
 for(const id of ['brightwater-master','lakeview-master','watergarden'])assert.equal(project(id).lifecycle,'mixed');
 for(const n of [14233,14234,14235,14240])assert.equal(overrides['22-'+n].componentPhase.lifecycle,'existing');
 for(const n of [14236,14237,14238,14239])assert.equal(overrides['22-'+n].componentPhase.lifecycle,'proposed');
 for(let n=1087;n<=1094;n++)assert.equal(overrides['103-'+n].componentPhase.lifecycle,'approved');
 for(const n of [1077,1078,1079,1080,1081,1082,1083,1084,1085,1086,1095,1096,1097,1098,1099,1100,1101,1102])assert.equal(overrides['103-'+n].componentPhase.lifecycle,'proposed');
 for(let n=749;n<=756;n++)assert.equal(overrides['93-'+n].componentPhase.lifecycle,'proposed');
 assert.equal(asset('30-eglinton-west-retained-office').componentPhase.lifecycle,'existing');
 assert.equal(asset('30-eglinton-west-approved-envelope').lifecycle,'approved');
 assert.equal(asset('wf-brightwater-missing-blocks-concept').componentPhase.lifecycle,'proposed');
 assert.equal(overrides['22-14240'].excludeDuplicate,true);
});
test('all nine unresolved meshes stay explicitly unknown; no cancellation or completion is inferred',()=>{
 for(const id of ['102-7101','102-7105','103-1103','11-5545','71-6200','51-5314','92-4866','21-4741','41-7762'])assert.equal(overrides[id].lifecycle,'unknown');
 assert.equal(snapshot.projects.filter(r=>r.lifecycle==='cancelled').length,0);
});
function parseCSV(text){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}
  else value+=c;
 }
 if(value||row.length){row.push(value);rows.push(row);}
 const [headers,...data]=rows;return {headers,rows:data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))};
}
test('CSV preserves every original record and field while adding only reviewed lifecycle columns',()=>{
 const old=parseCSV(execFileSync('git',['show',base+':public/downloads/project-register.csv'],{encoding:'utf8',maxBuffer:16*1024*1024}));
 const current=parseCSV(restore26Register(fs.readFileSync(new URL('../public/downloads/project-register.csv',import.meta.url),'utf8')));
 const added=['lifecycle','approvalStage','lifecycleReviewedOn','lifecycleNote'];assert.deepEqual(current.headers,[...old.headers,...added]);
 const unchangedFields=r=>Object.fromEntries(old.headers.filter(k=>(!mcityContentIds.has(r.id)||!['status','statusDate','storeys','geometryCoverage','modelCaveat','sources'].includes(k))&&(!['ninth-6344','longview-44-45'].includes(r.id)||k!=='status')&&(!acceptedModelProjectIds.has(r.id)||!['modelCaveat','geometryCoverage'].includes(k))).map(k=>[k,r[k]]));
 assert.deepEqual(current.rows.map(unchangedFields),old.rows.map(unchangedFields));
 for(const r of current.rows)for(const k of added)assert.equal(r[k],scope.projects[r.id]?(project(r.id)[k]||''):'');
});
test('accuracy table current status matches project metadata while model notes remain unchanged',()=>{
 const current=fs.readFileSync(new URL('../public/accuracy-review.html',import.meta.url),'utf8');
 const old=execFileSync('git',['show',base+':public/accuracy-review.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
 const rowFor=(text,id)=>[...text.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).find(r=>r.includes('project='+id+'"')||r.includes('project='+id+'&amp;'));
 for(const id of Object.keys(scope.projects)){
  if(mcityContentIds.has(id))continue;
  const row=rowFor(current,id),before=rowFor(old,id);assert(row&&before,id);
  const cells=[...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m=>m[1]);const oldCells=[...before.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
  assert(cells[1].includes(snapshot.taxonomy[project(id).lifecycle]),id);
  if(acceptedModelProjectIds.has(id)){
   assert.equal(cells[0],oldCells[0],id);assert.equal(cells[2],oldCells[2].replace('No separate refinement asset registered','Supplemental model registered'),id);
   const concise={'mcity-1-2':['CORE’s seven floor-plate outlines guide the exterior. Added glazing and bands improve selected podium surfaces.','Floor phase, heights and podium details remain approximate. M1’s low faceted pavilion is coarse or absent; this is not a measured as-built model.'],'mcity-3':['±15 m uncertainty','City’s lower building geometry','mechanical steel and cavities are not modelled'],'mcity-4':['March 2020','215.65 m','Spring 2026','level 41','level 26'],'mcity-5':['36-storey','building height is unverified','not a measured construction stage'],'port-credit-50-high':['December 2025 drawings','facade frames and roof arches','Frame depths, glazing and finishes are approximate','future view shows the planned building','dated City model retains the older building','extent of demolition is not mapped']}[id];
   if(concise){for(const text of concise)assert(cells[3].includes(text),id+': '+text);}else{assert(cells[3].includes(project(id).geometryCoverage),id);assert(cells[3].includes(project(id).modelCaveat),id);}
  }else assert.deepEqual([cells[0],...cells.slice(2)],[oldCells[0],...oldCells.slice(2)],id);
 }
});

test('expanded approvals retain exact stages, conditional decisions and existing context boundaries',()=>{
 for(const id of ['lakeview-birch','port-credit-70-park','bloor-1785','orchard-189','port-credit-50-high','lakeview-1407-lakeshore-east','lorne-1110-townhomes','port-credit-128-lakeshore','port-credit-170-lakeshore'])assert.equal(project(id).lifecycle,'approved',id);
 for(const id of ['73-4300','73-4301'])assert.equal(overrides[id].lifecycle,'approved');
 for(const id of ['wf-50high-current-plan','wf-128-current-plan','wf-70-settlement-envelope','wf-170-settlement-envelope'])assert.equal(asset(id).lifecycle,'approved');
 for(const id of ['port-credit-128-lakeshore','port-credit-170-lakeshore']){
  assert.match(project(id).approvalStage,/in principle/);assert.match(project(id).lifecycleNote,/Later resolution and construction have not been verified/);
 }
 assert.match(project('bloor-1785').approvalStage,/site plan required/);
 assert.match(project('lakeview-1407-lakeshore-east').approvalStage,/Earlier zoning.*current site plan active/);
 assert.match(project('port-credit-50-high').lifecycleNote,/Demolition does not establish new-building construction/);
 assert.equal(project('port-credit-marina').lifecycle,'proposed');assert.match(project('port-credit-marina').approvalStage,/Environmental assessment approved/);
 assert.match(project('port-credit-marina').lifecycleNote,/does not establish development approval/);
 for(const id of ['mcity-6','mcity-7-8'])assert.equal(project(id).lifecycle,'proposed');
 for(const id of ['63-6170','63-6171','63-6172','63-6173','63-6174'])assert.equal(overrides[id].lifecycle,'proposed');
});
test('elapsed appeal labels are current while their prior wording is preserved as dated history',()=>{
 const old=prior('projects.json');
 for(const id of ['ninth-6344','longview-44-45']){
  const r=project(id),before=old.find(p=>p.id===id);assert.match(r.status,/outcomes? unverified/);assert.doesNotMatch(r.status,/period open/);
  assert.deepEqual(r.statusHistory,[{status:before.status,statusDate:before.statusDate,statusEvidenceDate:before.statusEvidenceDate,supersededOn:'2026-11-01'}]);
 }
 const r=asset('ninth-6344-three-plan-envelopes'),before=prior('refinement-models.json').assets.find(x=>x.id===r.id);
 assert.equal(r.displayStatus,'Council passed; appeal outcome unverified');assert.deepEqual(r.displayStatusHistory,[{displayStatus:before.displayStatus,supersededOn:'2026-11-01'}]);
});
import {restore26Register} from './park26-scope.mjs';
