import {restoreRegistryReconciliationUpdates} from './registry-reconciliation-scope.mjs';
import {restoreMcityV6Projects,restoreMcityV6Register} from './mcity-v6-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectStatus,projectDetailsHTML} from '../public/project-cards.js';
import {resolveModelLifecycle} from '../public/model-status-materials.js';
import {namedProjectReviewFields as scope,beforeNamedProjectReview,restoreNamedProjectReview,restoreNamedProjectJSON,restoreNamedProjectRegister,namedProjectReviewIds} from './named-project-review-scope.mjs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const projects=JSON.parse(read('public/data/projects.json'));
const beforeProjects=JSON.parse(beforeNamedProjectReview('public/data/projects.json'));
const manifest=JSON.parse(read('public/data/refinement-models.json'));
const beforeManifest=JSON.parse(beforeNamedProjectReview('public/data/refinement-models.json'));
const project=id=>projects.find(p=>p.id===id),prior=id=>beforeProjects.find(p=>p.id===id);
const asset=id=>manifest.assets.find(a=>a.id===id);
const opa='https://www7.mississauga.ca/Departments/PB/OfficialDocs/ListOfUnconsolidatedOfficialPlanAmendments_and_LPAT_Decisions.pdf';
const zoning='https://www7.mississauga.ca/Departments/PB/OfficialDocs/UnconsolidatedZBL_Amendments.pdf';

test('the five current records preserve every field outside the primary-source review scope',()=>{
  for(const id of namedProjectReviewIds){
    const current=project(id),before=prior(id);
    assert.deepEqual(restoreNamedProjectReview('projects',current),before,id);
    assert.deepEqual(current.sources.slice(0,before.sources.length),before.sources,id+' preserves dated source claims');
    for(const source of current.sources.slice(before.sources.length)){
      assert.equal(source.accessed||source.checked,id==='port-credit-active-transportation-bridge'?'2026-11-13':'2026-11-12');
      assert.equal(new URL(source.url).protocol,'https:');
      assert.doesNotMatch(JSON.stringify(source),/\/Users\/|gmail|threadId|file:\/\//i);
    }
  }
});

test('current metadata leaves model geometry, inclusion flags and dated review history intact',()=>{
  for(const id of Object.keys(scope.assets)){
    const current=asset(id),before=beforeManifest.assets.find(a=>a.id===id);
    assert.deepEqual(restoreNamedProjectReview('assets',current),before,id);
    const file=new URL('../public/'+current.url.replace(/^\.?\//,''),import.meta.url);
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before.sha256,id+' GLB');
  }
  assert.equal(read('public/data/project-lifecycle-20261101.json'),beforeNamedProjectReview('public/data/project-lifecycle-20261101.json'));
  const withoutAssets=({assets,...rest})=>rest;
  assert.deepEqual(withoutAssets(manifest),withoutAssets(beforeManifest));
});

test('legacy file guards restore only the exact review and still reject protected-field changes',()=>{
  const json=read('public/data/projects.json'),csv=read('public/downloads/project-register.csv');
  assert.deepEqual(restoreMcityV6Projects(JSON.parse(restoreNamedProjectJSON(json))),JSON.parse(beforeNamedProjectReview('public/data/projects.json')));
  assert.equal(restoreMcityV6Register(restoreNamedProjectRegister(csv)),beforeNamedProjectReview('public/downloads/project-register.csv'));
  const changed=structuredClone(projects);changed.find(p=>p.id==='fowler-1970').mainHeightM=79;
  assert.throws(()=>restoreNamedProjectJSON(JSON.stringify(changed,null,2)),/protected fields/);
  const changedCSV=csv.replace('fowler-1970,1970–1980 Fowler Drive,','fowler-1970,Changed building name,');
  assert.notEqual(changedCSV,csv);assert.throws(()=>restoreNamedProjectRegister(changedCSV),/fowler-1970 name/);
});

test('Fowler planning is in effect without asserting construction permission or a zoning effective day',()=>{
  const p=project('fowler-1970'),a=p.approvalStages;
  assert.equal(p.status,'Official plan and zoning in effect');
  assert.equal(p.statusDate,'2026-11-10');assert.equal(p.statusEvidenceDate,'2026-11-10');
  assert.equal(p.lastStatusReview,'2026-11-12');assert.equal(p.lifecycle,'approved');
  assert.equal(a.councilPassage,'2026-09-29');assert.equal(a.noticePublished,'2026-10-08');assert.equal(a.appealDeadline,'2026-10-28');
  assert.equal(a.finalInForceVerified,true);assert.equal(a.officialPlanInEffectDate,'2026-10-29');
  assert.equal(a.zoningInForceVerifiedAsOf,'2026-11-10');assert.equal(a.constructionPermissionVerified,false);
  assert.equal(a.zoningInEffectDate,undefined);assert.deepEqual(a.currentStatusSources,[opa,zoning]);
  assert.equal(p.mainHeightM,78.05);assert.equal(p.overallHeightM,87.85);assert.deepEqual(p.heightM,[78.05]);
  assert.deepEqual(projectStatus(p),{label:'Approved planning',tone:'approved'});
  assert.equal(resolveModelLifecycle(asset('fowler-1970-july2026-plan-envelope'),{},p),'approved');
  assert.match(p.sources.find(s=>s.url===opa).claim,/location cell repeats Longview Place/);
  assert.doesNotMatch([p.status,p.summary,p.lifecycleNote,projectDetailsHTML(p)].join(' '),/appeal period (?:remains )?open|open through October 28/);
});

test('Aura approval is limited to three eastern Block 8 rows and 88 townhomes',()=>{
  const p=project('lakeview-aura'),old=prior(p.id),phase=p.phaseApplications.find(a=>a.application==='SP25/68 W1');
  assert.equal(p.lifecycle,'proposed');assert.deepEqual(projectStatus(p),{label:'Proposed',tone:'proposed'});
  assert.equal(phase.units,88);assert.match(phase.modelCoverage,/approved on October 8, 2026/);
  assert.match(phase.modelCoverage,/Construction is unverified/);
  assert.deepEqual(p.phaseApplications.find(a=>a.application==='SP26/24 W1'),old.phaseApplications.find(a=>a.application==='SP26/24 W1'));
  assert.match(p.lifecycleNote,/Phase 2 remains active.*two western contextual rows are unassigned/);
  assert.match(p.summary,/88 townhomes/);assert.match(p.summary,/forms remain approximate/);
  const sentence='Three eastern rows lie within SP 25/68 W1 (Block 8, 88 townhouses), recorded as site-plan approved on October 8, 2026; two western contextual rows remain outside the reviewed application polygons with no verified file assignment.';
  assert.equal(p.modelCaveat,old.modelCaveat.replace('Three eastern rows lie within current SP 25/68 W 1 (Block 8, 88 townhouses); two western contextual rows lie outside the reviewed current application polygons and have no verified active-file assignment.',sentence));
  assert(asset('aura-additional-plan-envelopes').warning.includes(sentence));
  assert.equal(asset('aura-additional-plan-envelopes').lifecycle,'proposed');
  assert.equal(p.actualCompletionDate,null);
});

test('Block Nine keeps conflicting completion-year evidence without inventing an exact day',()=>{
  const p=project('block-nine');
  assert.equal(p.completionYear,2021);assert.equal(p.actualCompletionDate,null);assert.equal(p.completion.actual,null);
  assert.equal(p.status,'completed');assert.equal(p.lifecycle,'existing');assert.deepEqual(p.storeys,[25,34]);
  assert.match(p.completionDateNote,/Amacon reports completion in 2021; secondary catalogues report 2020/);
  assert.match(p.completion.note,/exact completion and occupancy dates remain unverified/);
  assert.deepEqual({...p.completion,note:prior(p.id).completion.note},prior(p.id).completion);
  assert(p.sources.some(s=>s.url==='https://www.blockresidences.com/'&&s.accessed==='2026-11-12'));
});

test('Voya distinguishes formed structures from the undated completion target',()=>{
  const p=project('voya');
  assert.equal(p.status,'Under construction; tower structures topped');
  assert.equal(p.lifecycle,'under_construction');assert.equal(p.modelLayer,'construction');
  assert.deepEqual(p.storeys,[44,38]);assert.equal(p.actualCompletionDate,null);
  assert.match(p.summary,/late-2025 update/);assert.match(p.summary,/fall 2026 completion target/);
  assert.match(p.lifecycleNote,/does not date that status or confirm final completion or occupancy/);
  assert.doesNotMatch(p.status,/upper roof finishing continues/);
  assert(p.sources.some(s=>s.accessed==='2026-11-12'&&/photographs are labelled August 2025/.test(s.claim)));
});

test('the Port Credit bridge forecast stays separate from public opening and model geometry',()=>{
  const id='port-credit-active-transportation-bridge',p=project(id),old=prior(id);
  assert.equal(p.targetCompletionDate,'Spring 2027 construction forecast; opening unverified');
  assert.equal(p.statusDate,'2026-11-13 current City page');assert.equal(p.lastStatusReview,'2026-11-13');
  assert.equal(p.status,'Under construction · public opening not verified');assert.equal(p.actualCompletionDate,null);
  assert.equal(p.modelLayer,'unmodelled');assert.deepEqual(p.position,old.position);assert.equal(p.positionCaveat,old.positionCaveat);
  assert.deepEqual(p.meshIds,[]);assert.deepEqual(p.geometrySources,[]);assert.equal(p.modelCaveat,old.modelCaveat);
  assert.match(p.geometryCoverage,/66 m clear span/);assert.match(p.geometryCoverage,/2\.33 m vertical clearance above ordinary high water mark/);
  assert.match(p.geometryCoverage,/not an absolute deck elevation or an as-built verification/);
  const city=p.sources.find(s=>s.checked==='2026-11-13'&&s.url==='https://www.mississauga.ca/projects-and-strategies/city-projects/port-credit-active-transportation-bridge/');
  assert(city);assert.match(city.supports,/no explicit revision date/);assert.match(city.supports,/supersedes the fall 2026 forecast/);
  assert(p.sources.some(s=>s.checked==='2026-10-12'&&/fall 2026 forecast/.test(s.supports)),'historical forecast remains dated');
  assert(p.sources.some(s=>s.url==='https://nwar-rlen.tc.canada.ca/documents/ess/applications/12237/53614/UnclassifiedApplication.pdf'&&/2025-414741 \/ registry 12237/.test(s.title)));
  assert.deepEqual(projectStatus(p),{label:'Under construction',tone:'construction'});
  assert.match(projectDetailsHTML(p),/Spring 2027 construction forecast; opening unverified/);
  const research=JSON.parse(read('public/data/recent-project-updates.json')),previous=JSON.parse(beforeNamedProjectReview('public/data/recent-project-updates.json'));
  const row=research.changes.find(r=>r.projectId===id),before=previous.changes.find(r=>r.projectId===id);
  assert.equal(row.evidenceDate,'2026-11-13');assert.equal(row.change,p.summary);assert.equal(row.geometryAction,p.geometryCoverage);
  assert.deepEqual(row.sourceURLs.slice(0,before.sourceURLs.length),before.sourceURLs);
  assert.deepEqual({...row,change:before.change,evidenceDate:before.evidenceDate,sourceURLs:before.sourceURLs,geometryAction:before.geometryAction},before);
  const restored=restoreRegistryReconciliationUpdates(research);restored.changes[restored.changes.findIndex(r=>r.projectId===id)]=before;assert.deepEqual(restored,previous,'only the bridge current research row changes');
});

function parseCSV(text){
  const lines=[];let cells=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){cells.push(value);value='';}
    else if(ch==='\n'&&!quoted){cells.push(value.replace(/\r$/,''));lines.push(cells);cells=[];value='';}
    else value+=ch;
  }
  const [keys,...rows]=lines;return rows.map(values=>Object.fromEntries(keys.map((k,i)=>[k,values[i]])));
}
test('current register and accuracy rows reflect the same qualified facts',()=>{
  const rows=parseCSV(read('public/downloads/project-register.csv'));
  const html=read('public/accuracy-review.html'),tableRows=html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g);
  for(const id of namedProjectReviewIds){
    const p=project(id),row=rows.find(r=>r.id===id),card=tableRows.find(r=>r.includes('project='+id+'"'));
    for(const field of ['status','statusDate','modelCaveat','lifecycle','lifecycleReviewedOn','lifecycleNote'])assert.equal(row[field],p[field]||'',id+' '+field);
    assert.deepEqual(JSON.parse(row.sources),p.sources);
    assert(card.includes('data-status="'+projectStatus(p).label+'"'));
    assert(card.includes('<td data-label="Status">'+projectStatus(p).label));
    assert(card.includes(p.sources.length+' linked sources'));
  }
  assert.equal(rows.find(r=>r.id==='block-nine').completionYear,'2021');
});
