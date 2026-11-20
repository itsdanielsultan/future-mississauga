import {restoreRegistryReconciliationRecord,restoreRegistryReconciliationJSON,restoreRegistryReconciliationRegister} from './registry-reconciliation-scope.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {restoreRegisterCompletion} from './register-completeness-scope.mjs';

// The November 12–13 primary-source review is separate from the dated November 1
// lifecycle snapshot. Its exact content scope is tested independently.
export const namedProjectReviewBaseline='1bab6c6c165fcbfd180d3583e1075d78f512ba03';
export const namedProjectReviewFields={
  projects:{
    'fowler-1970':['status','statusDate','summary','sources','approvalStages','statusEvidenceDate','lastStatusReview','lifecycle','lifecycleReviewedOn','lifecycleConfidence','lifecycleNote','lifecycleSourceRefs'],
    'block-nine':['completionDateNote','completion','sources','completionYear'],
    'voya':['status','summary','sources','lifecycleReviewedOn','lifecycleNote'],
    'lakeview-aura':['summary','modelCaveat','sources','phaseApplications','lifecycleReviewedOn','lifecycleNote'],
    'port-credit-active-transportation-bridge':['statusDate','targetCompletionDate','summary','geometryCoverage','sources','lastStatusReview']
  },
  assets:{
    'fowler-1970-july2026-plan-envelope':['lifecycle','lifecycleReviewedOn'],
    'aura-additional-plan-envelopes':['warning']
  }
};
export const namedProjectReviewIds=new Set(Object.keys(namedProjectReviewFields.projects));
const cache=new Map();
export function beforeNamedProjectReview(path){
  if(!cache.has(path))cache.set(path,execFileSync('git',['show',namedProjectReviewBaseline+':'+path],{encoding:'utf8',maxBuffer:32*1024*1024}));
  return cache.get(path);
}
export function restoreNamedProjectReview(kind,record,id=record.id){
  record=restoreRegistryReconciliationRecord(kind,record,id);
  const fields=namedProjectReviewFields[kind]?.[id];
  if(!fields)return record;
  const data=JSON.parse(beforeNamedProjectReview('public/data/'+(kind==='assets'?'refinement-models':'projects')+'.json'));
  const prior=(kind==='assets'?data.assets:data).find(item=>item.id===id),result=structuredClone(record);
  for(const key of fields){if(Object.hasOwn(prior,key))result[key]=structuredClone(prior[key]);else delete result[key];}
  return result;
}
export function restoreNamedProjectCollection(kind,rows){
  for(let i=0;i<rows.length;i++)rows[i]=restoreNamedProjectReview(kind,rows[i]);
  return rows;
}
export function restoreNamedProjectJSON(text){
  text=restoreRegistryReconciliationJSON(text);
  const priorText=beforeNamedProjectReview('public/data/projects.json');
  const priorRows=new Map([...priorText.matchAll(/^  \{\n[\s\S]*?^  \}/gm)].map(([raw])=>[JSON.parse(raw).id,raw]));
  return text.replace(/^  \{\n[\s\S]*?^  \}/gm,raw=>{
    const record=JSON.parse(raw);
    if(!namedProjectReviewIds.has(record.id))return raw;
    const before=priorRows.get(record.id);
    assert.deepEqual(restoreNamedProjectReview('projects',record),JSON.parse(before),record.id+' protected fields');
    return before;
  });
}
function csvCells(line){
  const cells=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;
  }
  assert.equal(quoted,false,'complete CSV record');cells.push(value);return cells;
}
export function restoreNamedProjectRegister(text){
  text=restoreRegisterCompletion(restoreRegistryReconciliationRegister(text));
  const lines=beforeNamedProjectReview('public/downloads/project-register.csv').split('\n');
  const header=csvCells(lines[0]);assert.deepEqual(csvCells(text.split('\n')[0]),header);
  return text.split('\n').map(line=>{
    const id=line.slice(0,line.indexOf(','));
    if(!namedProjectReviewIds.has(id))return line;
    const before=lines.find(previous=>previous.startsWith(id+',')),old=csvCells(before),current=csvCells(line);
    const fields=new Set(namedProjectReviewFields.projects[id]);
    assert.equal(current.length,header.length,id+' complete register row');
    for(let i=0;i<header.length;i++)if(!fields.has(header[i]))assert.equal(current[i],old[i],id+' '+header[i]);
    return before;
  }).join('\n');
}
