import {restoreM1M2Revisions} from './mcity-m1-m2-v5-scope.mjs';
import {withoutAcceptedModelFields as withoutModel,acceptedModelProjectIds} from './mcity-asset-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {projectDetailsHTML,projectStatus} from '../public/project-cards.js';
import {statusMetadataScope,withoutReviewedStatusMetadata as withoutStatus} from './status-metadata-scope.mjs';

// This is a content-only review of the October 28/29 replies. Source drawings,
// municipal meshes, historical audits and source-publication holds are separate.
const base='dc9bb6a53020ad77ef407affff56a8b94a585aab';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const original=path=>execFileSync('git',['show',base+':'+path],{maxBuffer:64*1024*1024,encoding:'utf8'});
const projects=JSON.parse(await read('public/data/projects.json'));
const baseline=JSON.parse(original('public/data/projects.json'));
const ids=['mcity-6','mcity-7-8'];
const allowedContent=new Set(['status','statusDate','summary','modelCaveat','sources','lastStatusReview','geometryCoverage','evidenceUpdateNote','ownershipReview','planningSnapshot','submittedDrawing']);
function protectedFields(project){
 project=withoutStatus('projects',project);
 const allowed=new Set(allowedContent);if(project.id==='mcity-7-8')allowed.add('storeys');
 return {...Object.fromEntries(Object.entries(project).filter(([key])=>!allowed.has(key))),completion:Object.fromEntries(Object.entries(project.completion).filter(([key])=>!['note','reviewed'].includes(key)))};
}
const expected={
 'mcity-6':{storeys:[58],units:889,application:'SP 22-145 W7',cycle:/Cycle 5 comments issued 12 August 2025/},
 'mcity-7-8':{storeys:[51,46],units:1457,application:'SP 24-30 W7',cycle:/Cycle 1 comments issued 11 December 2024/}
};

test('November intake changes only the two reviewed project records and permitted content fields',()=>{
 assert.deepEqual(projects.map(p=>p.id),baseline.map(p=>p.id));
 for(const before of baseline){
  const after=projects.find(p=>p.id===before.id);
  if(!ids.includes(before.id)){assert.deepEqual(withoutModel('projects',withoutStatus('projects',after)),withoutModel('projects',before),before.id);continue;}
  assert.deepEqual(withoutModel('projects',protectedFields(after)),withoutModel('projects',protectedFields(before)),before.id+' geometry and other facts');
 }
});

for(const id of ids)test(id+' retains dated proposal counts, unresolved tenure and no issued permits',()=>{
 const p=projects.find(p=>p.id===id),e=expected[id];
 assert.deepEqual(p.storeys,e.storeys);
 assert.equal(p.status,'plans-under-review');assert.equal(p.statusDate,'2026-10-29');
 assert.equal(p.lastStatusReview,'2026-11-01');assert.equal(p.completion.reviewed,'2026-11-01');
 assert.equal(p.actualCompletionDate,null);assert.equal(p.targetCompletionDate,null);
 assert.equal(p.completion.actual,null);assert.equal(p.completion.target,null);assert.equal(p.completion.targetIsGuaranteed,false);
 assert.deepEqual(p.ownershipReview,{owner:'UC M City Inc.',acquisitionClosed:'2026-10-23',confirmedBy:'Urban Capital',confirmedOn:'2026-10-28',rogersRetainedRole:false,plansAndTenure:'Under review',imminentCondoLaunch:false});
 const snapshot={asOf:'2026-10-29',application:e.application,submittedStoreys:e.storeys,submittedUnits:e.units,postSaleResubmissionReceived:false,buildingPermitsIssued:false,holdingRemoval:'Awaiting resubmission; not yet approved',status:'Last-submitted proposal; future plans under review'};
 if(id==='mcity-7-8')snapshot.storeyConvention='The City reports 51/46 storeys. HPA describes these as including mechanical penthouses, while the elevations label Level 51/46 below Mech and Mech Roof. The counting convention remains unresolved; 1,457 units is the combined total.';
 assert.deepEqual(p.planningSnapshot,snapshot);
 assert.match(p.evidenceUpdateNote,/29 October 2026/);assert.match(p.evidenceUpdateNote,/no resubmission followed the sale/);
 assert.match(p.evidenceUpdateNote,/no building permits had been issued/);assert.match(p.evidenceUpdateNote,e.cycle);
 assert.match(p.modelCaveat,/exterior study follows HPA/);assert.match(p.modelCaveat,/dated proposal/);assert.doesNotMatch(p.modelCaveat,/unverified architectural|not (?:a )?verified architectural/);
 assert.deepEqual(p.heightM,[]);assert.match(p.summary,/reviewing the plans and tenure/);
 assert.match(p.summary,id==='mcity-6'?/58 storeys and 889 homes/:/51 and 46 storeys.*1,457 homes combined/);
 if(id==='mcity-7-8')assert.match(p.modelCaveat,/sampled viewer terrain/);
 assert.doesNotMatch(p.evidenceUpdateNote,/lateSeptember/);
 assert.doesNotMatch([p.summary,p.modelCaveat,p.evidenceUpdateNote,p.completion.note].join(' '),/no (?:building[- ]?)permit applications|(?:approved|confirmed|settled) (?:rental|condominium|condo) (?:design|tenure)|\bwill (?:start|complete|open)\b/i);
 assert.deepEqual(projectStatus(p),{label:'Under review',tone:'proposed'});
});

test('submitted drawing metadata preserves exact date, height definitions and unresolved storey conventions',()=>{
 const m6=projects.find(p=>p.id==='mcity-6'),m78=projects.find(p=>p.id==='mcity-7-8');
 assert.deepEqual(m6.submittedDrawing,{
  architect:'Hariri Pontarini Architects',date:'2025-07-03',revision:6,revisionDescription:'Issued for 5th SPA submission',
  towers:['M6'],heightExcludingMPHM:[186.85],heightIncludingMPHM:[195.85],
  storeyCountNote:'The City reports 58 storeys. A003 labels 58 + MECHANICAL and the elevations label Level 58/Mech. These do not establish 58 residential storeys.',
  reviewed:'2026-11-01',status:'Last-submitted proposal; comparison with displayed geometry pending'
 });
 assert.deepEqual(m78.submittedDrawing,{
  architect:'Hariri Pontarini Architects',date:'2024-09-17',revision:6,revisionDescription:'Issued for Zoning Review No. 03',
  towers:['M7','M8'],heightExcludingMPHM:[163.16,146.91],heightIncludingMPHM:[175.16,158.91],
  storeyCountNote:'The City reports 51/46 storeys. HPA describes these as including mechanical penthouses, while the elevations label Level 51/46 below Mech and Mech Roof. The counting convention remains unresolved; 1,457 units is the combined total.',
  reviewed:'2026-11-01',status:'Last-submitted proposal; comparison with displayed geometry pending'
 });
 assert.match(m6.modelCaveat,/revision 6, dated 3 July 2025/);
 assert.match(m78.modelCaveat,/issue 6, dated 17 September 2024/);
 for(const p of [m6,m78]){
  const drawing=p.sources.at(-1);assert.equal(drawing.publisher,'Hariri Pontarini Architects; supplied by City of Mississauga');
  assert(drawing.note.includes(p.submittedDrawing.storeyCountNote));
  for(const height of [...p.submittedDrawing.heightExcludingMPHM,...p.submittedDrawing.heightIncludingMPHM])assert(drawing.note.includes(String(height)));
 }
});

test('historical source claims remain dated while new response summaries carry no private identifiers',()=>{
 for(const id of ids){
  const p=projects.find(p=>p.id===id),before=baseline.find(p=>p.id===id);
  const historical=structuredClone(before.sources);
  historical[0].note='Earlier published design. Counts differ from the last submission; future plans remain under review.';
  assert.deepEqual(p.sources.slice(0,historical.length),historical);
  const added=p.sources.slice(historical.length);
  assert.deepEqual(added.map(s=>s.title),['Urban Capital response, 28 October 2026','City planning response, 29 October 2026',...(id==='mcity-7-8'?['HPA response, 28 October 2026']:[]),id==='mcity-6'?'M6 submitted drawings, revision 6, 3 July 2025':'M7/M8 submitted drawings, issue 6, 17 September 2024']);
  for(const source of added){
   assert.equal(source.accessed,'2026-11-01');assert.equal(source.url,undefined);
   assert.deepEqual(Object.keys(source).sort(),['accessed','note','publisher','title']);
   assert.doesNotMatch(JSON.stringify(source),/@|\/Users\/|message_id|threadId|1a18398acf44e446|1a183d3cddd94817|1a18826fa79757aa/);
  }
  assert.match(added[0].note,/23 October to UC M City Inc/);assert.match(added[0].note,/no imminent condo launch/);
  assert.match(added[1].note,/No post-sale resubmission or building permits issued as of that date/);
  if(id==='mcity-7-8')assert.match(added[2].note,/51 and 46 storeys including mechanical penthouses/);
 }
});

test('project cards visibly explain the dated proposal and render the new sources',()=>{
 for(const id of ids){
  const p=projects.find(p=>p.id===id),html=projectDetailsHTML(p);
  assert.match(html,/Under review/);assert.match(html,/Source storey counts/);
  assert.match(html,/Urban Capital response, 28 October 2026/);assert.match(html,/City planning response, 29 October 2026/);
  assert.match(html,/No post-sale resubmission or building permits issued as of that date/);
  assert.match(html,id==='mcity-6'?/889 homes/:/1,457 homes combined/);
  if(id==='mcity-7-8')assert.match(html,/mechanical penthouses/);
 }
});

function csv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(cell);cell='';}
  else if(ch==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell);rows.push(row);}assert(!quoted,'complete CSV quoting');
 const [header,...values]=rows;return {header,rows:values.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]])))};
}
test('download register mirrors the reviewed records and preserves every other row',async()=>{
 const current=csv(restore26Register(await read('public/downloads/project-register.csv'))),before=csv(original('public/downloads/project-register.csv'));
 const statusColumns=['lifecycle','approvalStage','lifecycleReviewedOn','lifecycleNote'];
 assert.deepEqual(current.header,[...before.header,...statusColumns]);assert.deepEqual(current.rows.map(r=>r.id),before.rows.map(r=>r.id));
 for(const row of current.rows){
  const prior=before.rows.find(r=>r.id===row.id);
  if(!ids.includes(row.id)){
   const fields=before.header.filter(k=>!acceptedModelProjectIds.has(row.id)||!['modelCaveat','geometryCoverage'].includes(k));
   assert.deepEqual(Object.fromEntries(fields.map(k=>[k,k==='status'&&['ninth-6344','longview-44-45'].includes(row.id)?prior[k]:row[k]])),Object.fromEntries(fields.map(k=>[k,prior[k]])));
   if(acceptedModelProjectIds.has(row.id)){const project=projects.find(p=>p.id===row.id);for(const key of ['modelCaveat','geometryCoverage'])assert.equal(row[key],project[key]);}continue;
  }
  const project=projects.find(p=>p.id===row.id);
  for(const key of ['status','statusDate','geometryCoverage','modelCaveat'])assert.equal(row[key],project[key]);
  assert.deepEqual(JSON.parse(row.storeys),project.storeys);
  assert.deepEqual(JSON.parse(row.sources),project.sources);
  for(const key of before.header.filter(key=>!['status','statusDate','storeys','geometryCoverage','modelCaveat','sources'].includes(key)))assert.equal(row[key],prior[key]);
 }
});

test('accuracy rows and dated update explain the same facts without changing unrelated rows',async()=>{
 const accuracy=restore26Accuracy(await read('public/accuracy-review.html')),prior=original('public/accuracy-review.html');
 const rows=text=>text.match(/<tr\b[^>]*>.*?<\/tr>/gs)||[];
 const targeted=row=>/data-search="m city m(?:6 |7 and m8 )/.test(row);
 // Other rows are covered by the separate lifecycle-table and release guards.
 const reviewed=rows(accuracy).filter(targeted);assert.equal(reviewed.length,2);
 for(const id of ids){
  const p=projects.find(p=>p.id===id),row=reviewed.find(r=>r.includes('project='+id+'"'));
  assert(row);assert(row.includes(p.modelCaveat));assert(row.includes(p.evidenceUpdateNote));
  assert.match(row,/Plans under review/);assert.match(row,/4 linked sources \+ dated correspondence and drawings/);
 }
 const updates=await read('public/updates.html'),entry=updates.match(/<section[^>]+id="november-1-m-city"[^>]*>(.*?)<\/section>/s)?.[1];
 assert(entry);assert.match(updates, /id="latestNotesDate"[^>]*><time datetime="2026-11-01">1 November 2026<\/time>/);assert.match(updates, /id="november-1-m-city" aria-describedby="latestNotesDate"/);assert.match(entry,/October 23/);assert.match(entry,/October 29/);
 assert.match(entry,/Rogers retains no ownership, financing or development role in those lands/);
 assert.match(entry,/58 storeys and 889 homes/);assert.match(entry,/51 and 46 storeys, with 1,457 homes combined/);
 assert.doesNotMatch(entry,/mechanical penthouse/);assert.match(entry,/no building permits/);
 for(const id of ids)assert(entry.includes('explore.html?district=downtown&amp;project='+id));
});

test('source-geometry records and historical audit files remain byte-for-byte unchanged',async()=>{
 const revisions=restoreM1M2Revisions(JSON.parse(await read('public/data/model-revisions.json'))),priorRevisions=JSON.parse(original('public/data/model-revisions.json'));
 const appended=revisions.revisions.filter(row=>row.id==='mcity-m5-v5-20261101');assert.equal(appended.length,1);assert.equal(appended[0].modelAssets[0].sha256,'af9d51546ca35a1fbc850b2afc3cbf1565010ee7c196f03df7e8cf6679ff829a');
 assert.deepEqual({...revisions,revisions:revisions.revisions.filter(row=>row.id!=='mcity-m5-v5-20261101')},priorRevisions,'Only the exact M5 revision may append; every historical record stays unchanged');
 for(const path of ['public/downloads/revision-ledger.csv','public/downloads/project-reference-audit.json','public/downloads/project-reference-audit.csv','public/downloads/public-project-reference-coverage.json','public/downloads/research-log.json','public/data/history/presentation-sources-before-refresh-2026-10-23.json']){
  assert.equal(await read(path),original(path),path);
 }
});

test('five component notes append only the exact dated review; all source flags and other records remain unchanged',async()=>{
 const before=JSON.parse(original('public/data/overrides.json')),after=JSON.parse(await read('public/data/overrides.json'));
 assert.deepEqual(Object.keys(after),Object.keys(before));
 const notes={
  'mcity-6':'Review, 1 November 2026: HPA revision 6, dated 3 July 2025, gives M6 heights of 186.85 m excluding and 195.85 m including the mechanical penthouse. The displayed City geometry is unchanged and still needs comparison with these sheets. Plans and tenure remain under review.',
  'mcity-7-8':'Review, 1 November 2026: HPA issue 6, dated 17 September 2024, gives M7 heights of 163.16/175.16 m and M8 heights of 146.91/158.91 m, excluding/including mechanical penthouses. The displayed City geometry is unchanged; individual component-to-tower matching remains unchecked. Plans and tenure remain under review.'
 };
 const changed=['63-6170','63-6171','63-6172','63-6173','63-6174'];
 for(const [key,value] of Object.entries(before)){
  const expected=changed.includes(key)?{...value,evidenceNote:value.evidenceNote+'\n\n'+notes[value.projectId]}:value;
  assert.deepEqual(withoutStatus('overrides',after[key],key),expected,key);
 }
});
import {restore26Register,restore26Accuracy} from './park26-scope.mjs';
