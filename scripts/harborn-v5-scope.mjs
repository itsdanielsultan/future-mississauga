import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const HARBORN_V5_SCOPE=JSON.parse(readFileSync(new URL('./harborn-v5-scope.json',import.meta.url)));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const harbornV5Fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

// Normalize only the exact accepted revision before the older scope guards run.
// Their original planning fingerprints and historical asset assertions stay intact.
export function restoreHarbornV5Fields(row,full=false){
 if(row?.id!==HARBORN_V5_SCOPE.id||row.url!==HARBORN_V5_SCOPE.newValues.url)return row;
 if(full)assert.equal(harbornV5Fingerprint(row),HARBORN_V5_SCOPE.newFingerprint,'exact accepted Harborn V5 asset');
 for(const [key,value] of Object.entries(HARBORN_V5_SCOPE.newValues))assert.deepEqual(row[key],value,'Harborn V5 '+key);
 for(const key of HARBORN_V5_SCOPE.absentKeys)delete row[key];
 Object.assign(row,structuredClone(HARBORN_V5_SCOPE.oldValues));
 if(full)assert.equal(harbornV5Fingerprint(row),HARBORN_V5_SCOPE.priorFingerprint,'unchanged Harborn V4 planning facts');
 return row;
}

export function restoreHarbornV5Versions(data){
 for(const [url,hash] of Object.entries(HARBORN_V5_SCOPE.versions)){
  assert.equal(data.sha256[url],hash,'accepted Harborn V5 version');
  delete data.sha256[url];
 }
 return data;
}
