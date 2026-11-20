import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

// Exact public source facts reviewed on November 13. Geometry and historical
// November 1 classifications are outside this review's scope.
export const registryReconciliationScope=JSON.parse(readFileSync(new URL('./registry-reconciliation-scope.json',import.meta.url)));
export const registryReconciliationIds=new Set(Object.keys(registryReconciliationScope.projects));
const baseline='1bab6c6c165fcbfd180d3583e1075d78f512ba03',cache=new Map();
let preLifecycleProjects;
const isExactPreLifecycleRecord=record=>{
 preLifecycleProjects??=JSON.parse(execFileSync('git',['show','dc9bb6a53020ad77ef407affff56a8b94a585aab:public/data/projects.json'],{encoding:'utf8',maxBuffer:32*1024*1024}));
 return isDeepStrictEqual(record,preLifecycleProjects.find(row=>row.id===record.id));
};
const prior=path=>{if(!cache.has(path))cache.set(path,execFileSync('git',['show',baseline+':'+path],{encoding:'utf8',maxBuffer:32*1024*1024}));return cache.get(path);};
const matches=(record,changes,edition)=>Object.entries(changes).every(([key,value])=>Object.hasOwn(record,key)===value[edition+'Present']&&JSON.stringify(record[key])===JSON.stringify(value[edition+'Present']?value[edition]:undefined));
export function restoreRegistryReconciliationRecord(kind,record,id=record.id){
 const changes=registryReconciliationScope[kind]?.[id];
 if(!changes)return record;
 if(matches(record,changes,'before')||(kind==='projects'&&isExactPreLifecycleRecord(record)))return record;
 assert(matches(record,changes,'after'),id+' exact reviewed source fields');
 const result=structuredClone(record);
 for(const [key,value] of Object.entries(changes)){
  if(value.beforePresent)result[key]=structuredClone(value.before);else delete result[key];
 }
 return result;
}
export function restoreRegistryReconciliationJSON(text){
 const oldRows=new Map([...prior('public/data/projects.json').matchAll(/^  \{\n[\s\S]*?^  \}/gm)].map(([row])=>[JSON.parse(row).id,row]));
 return text.replace(/^  \{\n[\s\S]*?^  \}/gm,raw=>{
  const record=JSON.parse(raw);if(!registryReconciliationIds.has(record.id))return raw;
  const old=oldRows.get(record.id);assert.deepEqual(restoreRegistryReconciliationRecord('projects',record),JSON.parse(old),record.id+' protected project fields');return old;
 });
}
export function restoreRegistryReconciliationOverrides(text){
 const before=prior('public/data/overrides.json');
 for(const id of Object.keys(registryReconciliationScope.overrides)){
  const pattern=new RegExp('^  "'+id+'": \\{\\n[\\s\\S]*?^  \\}','m');
  const current=pattern.exec(text)?.[0],old=pattern.exec(before)?.[0];
  assert(current&&old,id+' exact override row exists');
  const parse=raw=>JSON.parse('{'+raw+'}')[id];
  assert.deepEqual(restoreRegistryReconciliationRecord('overrides',parse(current),id),parse(old),id+' protected override fields');
  text=text.replace(current,old);
 }
 return text;
}
export function restoreRegistryReconciliationGroups(text){
 const before=prior('public/data/groups.json');
 const oldRows=new Map([...before.matchAll(/^  \{\n[\s\S]*?^  \}/gm)].map(([raw])=>[JSON.parse(raw).id,raw]));
 return text.replace(/^  \{\n[\s\S]*?^  \}/gm,raw=>{
  const record=JSON.parse(raw);if(!registryReconciliationScope.groups[record.id])return raw;
  const old=oldRows.get(record.id);assert.deepEqual(restoreRegistryReconciliationRecord('groups',record),JSON.parse(old),record.id+' protected group fields');return old;
 });
}
export const restoreRegistryReconciliationData=(path,bytes)=>path.endsWith('overrides.json')?restoreRegistryReconciliationOverrides(bytes.toString()):path.endsWith('groups.json')?restoreRegistryReconciliationGroups(bytes.toString()):bytes;
function cells(line){
 const values=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  if(line[i]==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(line[i]===','&&!quoted){values.push(value);value='';}else value+=line[i];
 }
 assert.equal(quoted,false);values.push(value);return values;
}
const serialized=value=>value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value).replace(/,/g,', ').replace(/:/g,': '):String(value);
export function restoreRegistryReconciliationRegister(text){
 const lines=prior('public/downloads/project-register.csv').split('\n'),header=cells(lines[0]);
 return text.split('\n').map(line=>{
  const id=line.slice(0,line.indexOf(','));if(!registryReconciliationIds.has(id))return line;
  const before=lines.find(row=>row.startsWith(id+','));if(line===before)return line;
  const current=cells(line),old=cells(before),changes=registryReconciliationScope.projects[id];
  assert.equal(current.length,header.length,id+' complete CSV row');
  for(let i=0;i<header.length;i++){
   const change=changes[header[i]];
   if(!change)assert.equal(current[i],old[i],id+' protected CSV '+header[i]);
   else if(['sources','storeys','heightM'].includes(header[i]))assert.deepEqual(JSON.parse(current[i]),change.after,id+' reviewed CSV '+header[i]);
   else assert.equal(current[i],serialized(change.after),id+' reviewed CSV '+header[i]);
  }
  return before;
 }).join('\n');
}
export function restoreRegistryReconciliationUpdates(data){
 const result=structuredClone(data);
 for(const [id,before] of Object.entries(registryReconciliationScope.researchBeforeChanges)){
  const index=result.changes.findIndex(row=>row.projectId===id);
  if(index<0){assert.equal(before,null);continue;}
  if(before)result.changes[index]=structuredClone(before);else result.changes.splice(index,1);
 }
 return result;
}
