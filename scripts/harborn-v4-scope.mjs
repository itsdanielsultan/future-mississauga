import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const HARBORN_SCOPE=JSON.parse(readFileSync(new URL('./harborn-v4-scope.json',import.meta.url)));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const harbornFingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export function restoreHarbornFields(row,full=false){if(row.id!==HARBORN_SCOPE.id||row.url!==HARBORN_SCOPE.newValues.url)return row;if(full)assert.equal(harbornFingerprint(row),HARBORN_SCOPE.newFingerprint);for(const[k,v]of Object.entries(HARBORN_SCOPE.newValues))assert.deepEqual(row[k],v,k);for(const k of HARBORN_SCOPE.absentKeys)delete row[k];Object.assign(row,structuredClone(HARBORN_SCOPE.oldValues));return row;}
export function restoreHarbornRefinements(data){restoreHarbornFields(data.assets.find(a=>a.id===HARBORN_SCOPE.id),true);return data;}
export function restoreHarbornVersions(data){for(const v of HARBORN_SCOPE.versions){assert.equal(data.sha256[v.url],v.sha256);delete data.sha256[v.url];}return data;}
