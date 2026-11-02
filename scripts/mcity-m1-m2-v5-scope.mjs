import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const M1_M2_V5_SCOPE=JSON.parse(readFileSync(new URL('./mcity-m1-m2-v5-scope.json',import.meta.url)));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const modelScopeFingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function restoreFields(row,spec,full=true){if(full)assert.equal(modelScopeFingerprint(row),spec.newFingerprint);for(const [key,value]of Object.entries(spec.newValues))assert.deepEqual(row[key],value,key);for(const key of spec.absentKeys)delete row[key];Object.assign(row,structuredClone(spec.oldValues));return row;}
export function restoreM1M2ReviewedFields(row){const spec=M1_M2_V5_SCOPE.refinements.find(s=>s.id===row.id);if(spec&&row.sourceRevision==='05')restoreFields(row,spec,false);return row;}
export function restoreM1M2Refinements(data){restore26Refinements(data);for(const spec of M1_M2_V5_SCOPE.refinements)restoreFields(data.assets.find(a=>a.id===spec.id),spec);return data;}
export function restoreM1M2Catalogue(data){for(const kind of ['assets','views'])for(const spec of M1_M2_V5_SCOPE[kind])restoreFields(data[kind].find(a=>a.id===spec.id),spec);return data;}
export function restoreM1M2Projects(rows){restore26Projects(rows);restoreFields(rows.find(p=>p.id==='mcity-1-2'),M1_M2_V5_SCOPE.project);return rows;}
export function restoreM1M2Revisions(data){const rows=data.revisions.filter(r=>M1_M2_V5_SCOPE.revisionIds.includes(r.id));assert.equal(rows.length,3);assert.equal(modelScopeFingerprint(rows),M1_M2_V5_SCOPE.newRevisionFingerprint);data.revisions=data.revisions.filter(r=>!M1_M2_V5_SCOPE.revisionIds.includes(r.id));return data;}
export function restoreM1M2Register(text){text=restore26Register(text);assert.equal(text.split(M1_M2_V5_SCOPE.csvNewRow).length,2);return text.replace(M1_M2_V5_SCOPE.csvNewRow,M1_M2_V5_SCOPE.csvOldRow);}
import {restore26Refinements,restore26Projects,restore26Register} from './park26-scope.mjs';
