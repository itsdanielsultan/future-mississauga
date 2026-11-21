import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {beforePlanningReview, planningRows} from './planning-review-guard.mjs';
import {validateReviewedEdition} from './validate-planning-review.mjs';

const publicDirectory = new URL('../public/',import.meta.url);
const read = file => readFileSync(new URL(file,publicDirectory),'utf8');
const scope = JSON.parse(readFileSync(new URL('./editions/20261121/planning-review-scope.json',import.meta.url)));
const followUp = JSON.parse(readFileSync(new URL('./editions/20261121/project-source-followup.json',import.meta.url)));
const named = [...new Set([...followUp.updatedProjectSourceArrays,'brightwater-bridge-house','brightwater-master','dundas-1225','exchange-district','hurontario-3115','leanne-2155','mcity-3'])].sort();
const parts = ['63-6235','63-6236',...Array.from({length:7},(_,i)=>'93-'+(742+i))];

test('the current edition verifies the 150 projects, recorded source checks and model-component phases',()=>{
  const report=validateReviewedEdition(fileURLToPath(publicDirectory));
  assert.equal(report.projects,150);
  assert.equal(report.protectedFiles,5);
  assert(report.sourceChecks>=235);
});

test('only the 20 reviewed projects and nine municipal components can differ from the published baseline',()=>{
  for (const [path,rule] of Object.entries(scope)) {
    const expected = path.endsWith('overrides.json') || path.endsWith('revision-ledger.csv') ? parts : named;
    assert.deepEqual(Object.keys(rule.fields).sort(),expected,path+' exact IDs');
    const restored=beforePlanningReview(path,read(path));
    if (!path.endsWith('.html')) {
      assert.equal(createHash('sha256').update(restored).digest('hex'),rule.priorFileSHA256,path+' historical byte pin');
    }
  }
});

function modifyJSON(file,change) {
  const original=read(file);
  const value=JSON.parse(original);
  change(value);
  return JSON.stringify(value,null,2)+'\n';
}

test('an unverified address, authoritative URL, exclusion flag or wrong phase cannot pass restoration',()=>{
  const path='data/projects.json';
  const changes=[
    projects=>{projects.find(r=>r.id==='brightwater-bridge-house').statusDate='2026-12-17';},
    projects=>{projects.find(r=>r.id==='mcity-3').sources[0].url='https://example.org/unverified';},
    projects=>{projects.find(r=>r.id==='exchange-district').towers.find(t=>t.name==='EX3').lifecycle='existing';},
    projects=>{projects.find(r=>r.id==='hurontario-3115').mainHeightM=999;},
    projects=>{projects.find(r=>r.id==='agnes-45').statusDate='2026-03-15';},
    projects=>{projects.find(r=>r.id==='lakeview-harbourwalk').constructionStage='Complete';},
    projects=>{projects.find(r=>r.id==='fowler-1970').address='Changed municipal address';},
    projects=>{projects.push(structuredClone(projects[0]));}
  ];
  for (const change of changes) assert.throws(()=>beforePlanningReview(path,modifyJSON(path,change)));
  const overrides='data/overrides.json';
  const excluded=modifyJSON(overrides,rows=>{rows['93-742'].excludeSuperseded=!rows['93-742'].excludeSuperseded;});
  assert.throws(()=>beforePlanningReview(overrides,excluded),/protected fields/);
});

test('a modified register cell, ledger URL or unrelated accuracy row cannot be hidden by a dated guard',()=>{
  for (const [file,id,what,replacement] of [
    ['downloads/project-register.csv','brightwater-bridge-house','2026-11-17','2026-12-17'],
    ['downloads/revision-ledger.csv','93-742','https://sensomagazine.ca','https://example.org'],
    ['accuracy-review.html','fowler-1970','1970','2000']
  ]) {
    const original=read(file),{raw}=planningRows(file,original).get(id);
    const changed=raw.replace(what,replacement);
    assert.notEqual(raw,changed);
    assert.throws(()=>beforePlanningReview(file,original.replace(raw,()=>changed)));
  }
});
