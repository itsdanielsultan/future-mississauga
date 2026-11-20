import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const UPTOWN_SCOPE=JSON.parse(readFileSync(new URL('./uptown-neighbour-scope.json',import.meta.url)));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const uptownFingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
// Permit only the reviewed Uptown eligibility addition before older revision guards.
// An already restored historical row has no such field and passes through unchanged.
export function restoreUptownEligibility(row){
 const spec=UPTOWN_SCOPE.assets.find(asset=>asset.id===row?.id);
 if(!spec||!Object.hasOwn(row,'forceDistricts'))return row;
 assert.deepEqual(row.forceDistricts,spec.forceDistricts,'only Uptown is newly eligible');
 assert.equal(uptownFingerprint(row),spec.currentFingerprint,'exact accepted Uptown row '+row.id);
 delete row.forceDistricts;
 assert.equal(uptownFingerprint(row),spec.priorFingerprint,'all original asset fields stay exact');
 return row;
}
