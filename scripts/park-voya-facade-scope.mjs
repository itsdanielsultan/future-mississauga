import {restoreUptownEligibility} from './uptown-neighbour-scope.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const QUALIFIED_FACADE_SCOPE=JSON.parse(readFileSync(new URL('./park-voya-facade-scope.json',import.meta.url)));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const qualifiedFacadeFingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

// Only the two exact accepted revisions normalize to their prior source records.
// Earlier guards continue to protect planning facts and every unrelated asset.
export function restoreQualifiedFacadeFields(row,full=false){restoreUptownEligibility(row);
 const scope=QUALIFIED_FACADE_SCOPE.assets[row?.id];
 if(!scope||row.url!==scope.newURL)return row;
 if(full)assert.equal(qualifiedFacadeFingerprint(row),scope.newFingerprint,'exact accepted '+row.id);
 for(const [key,value] of Object.entries(scope.newValues))assert.deepEqual(row[key],value,row.id+' '+key);
 for(const key of scope.absentKeys)delete row[key];
 Object.assign(row,structuredClone(scope.oldValues));
 if(full)assert.equal(qualifiedFacadeFingerprint(row),scope.priorFingerprint,'unchanged source facts '+row.id);
 return row;
}
export function restoreQualifiedFacadeCollection(rows){for(const row of rows)restoreQualifiedFacadeFields(row,true);return rows;}
export function restoreQualifiedFacadeVersions(data){
 for(const [url,sha256] of Object.entries(QUALIFIED_FACADE_SCOPE.versions)){assert.equal(data.sha256[url],sha256,'accepted facade version '+url);delete data.sha256[url];}
 return data;
}
