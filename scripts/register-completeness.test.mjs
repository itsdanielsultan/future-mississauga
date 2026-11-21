import {readBeforePlanningReview} from './planning-review-guard.mjs';
import {restoreRegistryReconciliationRegister} from './registry-reconciliation-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerCompletenessScope as scope,restoreRegisterCompletion} from './register-completeness-scope.mjs';

const read=path=>readBeforePlanningReview(new URL('../public/'+path,import.meta.url),'utf8');
const csv=read('downloads/project-register.csv'),projects=JSON.parse(read('data/projects.json'));
function cells(line){
 const values=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  if(line[i]==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(line[i]===','&&!quoted){values.push(value);value='';}else value+=line[i];
 }
 assert.equal(quoted,false);values.push(value);return values;
}
const [header,...lines]=csv.trimEnd().split('\n').map(cells);
const rows=lines.map(values=>{assert.equal(values.length,header.length);return Object.fromEntries(header.map((key,i)=>[key,values[i]]));});

test('download register covers each public project exactly once, matching the Accuracy directory',()=>{
 assert.equal(rows.length,projects.length);assert.equal(rows.length,scope.currentRows);
 assert.deepEqual(rows.map(row=>row.id).sort(),projects.map(project=>project.id).sort());
 const accuracyIds=[...read('accuracy-review.html').matchAll(/<tr\b[^>]*>[\s\S]*?project=([^"&]+)[\s\S]*?<\/tr>/g)].map(match=>match[1]);
 assert.deepEqual(rows.map(row=>row.id).sort(),accuracyIds.sort());
});

test('Superior is appended from public source facts without inventing dates, heights or approvals',()=>{
 const row=rows.at(-1),project=projects.find(project=>project.id===scope.projectId);
 assert.equal(row.id,project.id);
 for(const field of header.filter(field=>!['sources','storeys','heightM'].includes(field)))assert.equal(row[field],String(project[field]??''),field);
 for(const field of ['sources','storeys','heightM'])assert.deepEqual(JSON.parse(row[field]),project[field]??[]);
 assert.equal(row.status,'Existing');assert.equal(row.actualCompletionDate,'');assert.equal(row.approvalStage,'');
 assert.match(row.modelCaveat,/photograph date is unknown/);assert.match(row.modelCaveat,/Ground contact is approximate/);
 assert.match(row.sources,/original photograph remains private and is not used as a texture/);
});

test('all previous CSV bytes stay exact, and the narrow append guard rejects corruption or duplicates',()=>{
 const previous=restoreRegisterCompletion(restoreRegistryReconciliationRegister(csv));
 assert.equal(createHash('sha256').update(previous).digest('hex'),scope.priorRegisterSHA256);
 assert.equal(previous.split('\n').length-2,scope.priorRows);assert.equal(restoreRegisterCompletion(previous),previous);
 const last=csv.trimEnd().split('\n').at(-1);
 assert.throws(()=>restoreRegisterCompletion(csv.replace(last,last.replace('Existing','Proposed'))),/exact source-qualified/);
 assert.throws(()=>restoreRegisterCompletion(csv+last+'\n'),/only one missing-project/);
 assert.throws(()=>restoreRegisterCompletion(csv.replace(last+'\n','').replace('\n','\n'+last+'\n')),/without reordering/);
});
