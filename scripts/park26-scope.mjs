import {restoreMcityV6Projects} from './mcity-v6-scope.mjs';
import {restoreHarbornRefinements} from './harborn-v4-scope.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {restoreNamedProjectCollection,restoreNamedProjectRegister} from './named-project-review-scope.mjs';
export const PARK26_SCOPE=JSON.parse(readFileSync(new URL('./park26-scope.json',import.meta.url)));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const park26Fingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function restore(row,spec,full=true){if(full)assert.equal(park26Fingerprint(row),spec.newFingerprint);for(const [k,v]of Object.entries(spec.newValues))assert.deepEqual(row[k],v,k);for(const k of spec.absentKeys)delete row[k];Object.assign(row,structuredClone(spec.oldValues));return row;}
export function restore26Fields(kind,row){const spec=kind==='assets'?PARK26_SCOPE.asset:kind==='projects'?PARK26_SCOPE.project:null;if(spec&&row.id===spec.id&&(kind==='assets'?row.url===spec.newValues.url:row.geometryCoverage===spec.newValues.geometryCoverage))restore(row,spec,false);return row;}
export function restore26Refinements(data){restoreHarbornRefinements(data);restore(data.assets.find(a=>a.id===PARK26_SCOPE.asset.id),PARK26_SCOPE.asset);return data;}
export function restore26Projects(rows){restoreMcityV6Projects(rows);restoreNamedProjectCollection('projects',rows);restore(rows.find(p=>p.id===PARK26_SCOPE.project.id),PARK26_SCOPE.project);return rows;}
export function restore26Register(text){text=restoreNamedProjectRegister(text);assert.equal(text.split(PARK26_SCOPE.csvNewRow).length,2);return text.replace(PARK26_SCOPE.csvNewRow,PARK26_SCOPE.csvOldRow);}
// UI attributes do not change the exact protected source/status/notes payload.
export function restore26Accuracy(text){const content=text.replace(/(<tr) data-area="[^"]*" data-status="[^"]*"/g,'$1').replace(/<td data-label="[^"]*">/g,'<td>'),reviewedRow=PARK26_SCOPE.accuracyNewRow.replace('Supplemental model registered','Added model detail');assert.equal(content.split(reviewedRow).length,2);return content.replace(reviewedRow,PARK26_SCOPE.accuracyOldRow);}
