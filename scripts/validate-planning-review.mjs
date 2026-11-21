import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {projectStatus} from '../public/project-cards.js';
import {resolveModelLifecycle} from '../public/model-status-materials.js';
import {planningRows, validatePlanningReview} from './planning-review-guard.mjs';

const bridgeIds = Array.from({length:7},(_,i)=>'93-'+(742+i));
const references = {
  'dundas-1225':['https://www.mississauga.ca/wp-content/uploads/2026/10/08091543/OZ-OPA-22-20-W3-Notice-of-Passing-public-notice.pdf'],
  'hurontario-3115':['https://www.mississauga.ca/wp-content/uploads/2026/10/08092020/OZ-OPA-22-24-W7-OPA-17-Notice-of-Passing-public-notice.pdf'],
  'leanne-2155':['https://www.mississauga.ca/wp-content/uploads/2026/10/08093057/OZ-OPA-26-7-W2-OPA-15-Notice-of-Passing-public-notice.pdf'],
  'brightwater-bridge-house': ['https://sensomagazine.ca/en/construction/mississauga-bridge-house-brightwater-port-credit-construction/','https://experiencebrightwater.ca/bridge-house/'],
  'exchange-district': ['https://www.condoauthorityontario.ca/condo-registry-details/?id=ff38531f-56bb-f111-aaad-70a8a5ac79b5','https://condos.ca/mississauga/2-erskine-road-mississauga/unit-2404-W13683156','https://strata.ca/mississauga/exchange-district-condos-phase-2-ex2','https://urbantoronto.ca/forum/threads/toronto-exchange-district-condos-m-66s-camrost-felcorp-arcadis.29739/page-78'],
  'mcity-3': ['https://www.mcitycondos.com/construction.php','https://www.realtor.ca/real-estate/30476130/5107-448-burnhamthorpe-road-w-mississauga-city-centre','https://www.connectcre.ca/stories/urban-capital-acquires-final-m-city-lands-from-rogers-family/']
};

export function validateReviewedEdition(site) {
  const protectedFiles = validatePlanningReview(site);
  const load = filename => JSON.parse(readFileSync(join(site,'data',filename),'utf8'));
  const projects = load('projects.json'), overrides = load('overrides.json');
  const edition = load('project-lifecycle-20261121.json');
  const catalogue = new Map(projects.map(row=>[row.id,row]));
  const effective = new Map(edition.projects.map(row=>[row.id,row]));
  assert.equal(edition.reviewedOn,'2026-11-21');
  assert.equal(edition.projectCount,150);
  assert.equal(edition.projects.length,150);
  assert.deepEqual([...effective.keys()].sort(),[...catalogue.keys()].sort(),'all project IDs exactly once');
  const counts = {}, checked = {}, components = new Map();
  for (const row of edition.projects) {
    const project = catalogue.get(row.id);
    assert(Object.hasOwn(edition.taxonomy,row.lifecycle),row.id+' lifecycle');
    assert.equal(row.publicLabel,projectStatus(project).label,row.id+' visible status');
    if (project.lifecycle) assert.equal(row.lifecycle,project.lifecycle,row.id+' reviewed lifecycle');
    counts[row.lifecycle]=(counts[row.lifecycle]||0)+1;
    for (const id of row.sourceChecks) assert(Object.hasOwn(edition.sourceChecks,id),row.id+' checked source');
    for (const part of row.sourceComponents) {
      if (part.excluded) continue;
      if (components.has(part.id)) assert.equal(components.get(part.id),part.lifecycle,part.id+' shared municipal component');
      components.set(part.id,part.lifecycle);
    }
  }
  assert.deepEqual(counts,edition.projectLifecycleCounts);
  for (const [id,source] of Object.entries(edition.sourceChecks)) {
    assert.match(source.url,/^https?:\/\//);
    assert.equal(createHash('sha256').update(source.url).digest('hex').slice(0,14),id);
    assert(['retrieved','unavailable'].includes(source.result),id+' source disposition');
    if (source.result==='retrieved') assert.match(source.sampleSHA256,/^[0-9a-f]{64}$/);
    checked[source.result]=(checked[source.result]||0)+1;
  }
  assert.deepEqual(checked,edition.sourceCheckCounts);
  for (const [id,urls] of Object.entries(references)) {
    const sourceURLs = catalogue.get(id).sources.map(s=>s.url);
    for (const url of urls) assert(sourceURLs.includes(url),id+' requires '+url);
  }

  for (const id of ['dundas-1225','hurontario-3115','leanne-2155']) {
    const record = catalogue.get(id);
    assert.equal(record.lifecycle,'approved');
    assert.equal(record.statusDate,'2026-09-29');
    assert.match(record.lifecycleNote,/appeal deadline/i);
    assert.match(record.lifecycleNote,/No later disposition or construction start was confirmed/i);
    assert.equal(effective.get(id).lifecycle,record.lifecycle);
  }
  const bridge = catalogue.get('brightwater-bridge-house');
  assert.equal(bridge.statusDate,'2026-11-17');
  assert.equal(bridge.lifecycle,'under_construction');
  assert.equal(bridge.lifecycleReviewedOn,'2026-11-21');
  assert.equal(catalogue.get('brightwater-master').lifecycle,'mixed');
  assert.deepEqual(Object.keys(overrides).filter(id=>overrides[id].projectId===bridge.id).sort(),bridgeIds);
  assert.deepEqual(effective.get(bridge.id).sourceComponents.map(x=>x.id).sort(),bridgeIds);
  const ledger = planningRows('downloads/revision-ledger.csv',readFileSync(join(site,'downloads/revision-ledger.csv'),'utf8'));
  for (const id of bridgeIds) {
    assert.equal(components.get(id),'under_construction');
    assert.equal(resolveModelLifecycle({id},overrides[id],bridge),'under_construction');
    assert.equal(ledger.get(id).fields.reviewed_status,bridge.status);
    assert(overrides[id].evidenceUrls.includes(references[bridge.id][0]));
  }
  assert.equal(catalogue.get('exchange-district').statusDate,'2026-11');
  assert.equal(catalogue.get('exchange-district').summary,'EX1, EX2 and EXS are in residential use. EX3 is under construction.');
  const phases = Object.fromEntries(effective.get('exchange-district').phaseDetail.map(p=>[p.phase,p.lifecycle]));
  assert.deepEqual(phases,{EX1:'existing',EX2:'existing',EX3:'under_construction',EXS:'existing'});
  for (const phase of effective.get('exchange-district').registeredRefinements) {
    assert.equal(phase.lifecycle,phases[phase.id]);
    assert.deepEqual(phase.scenarios,phase.id==='EX3'?['construction','future']:['existing','construction','future']);
  }
  const m3 = catalogue.get('mcity-3');
  assert.equal(m3.statusDate,'2026-07-15');
  assert.equal(m3.lifecycleReviewedOn,'2026-11-21');
  assert.equal(effective.get(m3.id).lifecycle,'under_construction');
  const followupBytes=readFileSync(new URL('./editions/20261121/project-source-followup.json',import.meta.url));
  assert.equal(createHash('sha256').update(followupBytes).digest('hex'),'7c3fa564bf8bea2b4beb5b8d73c6acac4f180d8c61456341f6b32dc560b88f97','checked follow-up source receipts');
  const followup=JSON.parse(followupBytes);
  assert.deepEqual(edition.sourceFollowUpSummary,followup.followUp);
  assert.equal(Object.keys(followup.sourceRecords).length,17);
  for(const [key,record] of Object.entries(followup.sourceRecords)){
    const check=edition.sourceChecks[key];
    assert.equal(check.result,'unavailable',key+' original retrieval remains recorded');
    assert.equal(record.url,check.url,key+' original URL');
    assert.equal(check.followUp.result,record.result,key+' subsequent evidence');
    const citedProjects=[...new Set(check.followUp.references.map(ref=>ref.project))].sort();
    assert.deepEqual(citedProjects,[...record.projects].sort(),key+' projects checked against the alternative source');
    for(const ref of check.followUp.references){
      assert.ok(ref.url && ref.finding,key+' attributable evidence');
      assert(catalogue.get(ref.project).sources.some(source=>source.url===ref.url),ref.project+' links its checked evidence');
    }
  }
  const agnes=catalogue.get('agnes-45'), squareOne=catalogue.get('square-one-block5-t1');
  for(const project of [agnes,squareOne]){
    const sitePlan=followup.municipalRecords[project.id];
    assert(project.sources.some(source=>source.url===sitePlan.url),project.id+' links the municipal application record');
    assert.equal(project.sitePlan.replace(/\W/g,''),sitePlan.record.APP_FILE_NO.replace(/\W/g,''));
  }
  assert.equal(followup.municipalRecords[agnes.id].record.RES_APTS,338);
  assert.equal(agnes.lifecycle,'approved');
  assert.equal(agnes.statusDate,new Date(followup.municipalRecords[agnes.id].record.APPROVAL_DATE).toISOString().slice(0,10));
  assert.equal(followup.municipalRecords[squareOne.id].record.APPROVAL_DATE,null);
  assert.equal(squareOne.lifecycle,'proposed');
  const milestone=followup.constructionMilestone, harbourwalk=catalogue.get(milestone.project);
  assert(harbourwalk.sources.some(source=>source.url===milestone.url));
  assert.equal(harbourwalk.lifecycle,'under_construction');
  assert.match(harbourwalk.constructionStage,/forming at Level 11 and windows reaching Level 5/);
  const approvedComponents=followup.stageChanges[agnes.id].retainedComponents;
  assert.deepEqual(approvedComponents,['63-6235','63-6236']);
  assert.deepEqual(effective.get(agnes.id).sourceComponents.map(part=>part.id).sort(),approvedComponents);
  for(const id of approvedComponents){
    assert.equal(components.get(id),'approved');
    assert.equal(resolveModelLifecycle({id},overrides[id],agnes),'approved');
    assert.equal(ledger.get(id).fields.reviewed_status,agnes.status);
  }
  const rendering = JSON.parse(readFileSync(new URL('./editions/20261121/planning-components.json',import.meta.url)));
  assert.equal(rendering.edition,'2026-11-21');
  const inks=load('tower-stage-calibration.json').materials;
  assert.equal(inks.approved,inks.proposed,'the two planning terms share the same print ink');
  for (const [id,status] of Object.entries(rendering.components)) {
    if(approvedComponents.includes(id)){
      assert.equal(status,'proposed',id+' original frozen image classification');
      assert.equal(inks[status],inks[components.get(id)],id+' frozen print agrees with the approved project');
    }else assert.equal(components.get(id),status,id+' render classification must match the current component register');
  }
  return {protectedFiles,projects:edition.projectCount,sourceChecks:Object.keys(edition.sourceChecks).length};
}
