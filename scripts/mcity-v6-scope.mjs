import {restoreUptownEligibility} from './uptown-neighbour-scope.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {restorePublicStandaloneAdditions} from './public-standalone-additions.mjs';
export const MCITY_V6_SCOPE=JSON.parse(readFileSync(new URL('./mcity-v6-scope.json',import.meta.url)));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const mcityV6Fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function restore(row,spec,full=true){
  // Older independent guards may already have restored this exact revision.
  if(Object.entries(spec.oldValues).every(([key,value])=>JSON.stringify(row[key])===JSON.stringify(value))&&spec.absentKeys.every(key=>!(key in row)))return row;
  if(full)assert.equal(mcityV6Fingerprint(row),spec.newFingerprint,`${spec.id} approved v6 row`);
  for(const [key,value] of Object.entries(spec.newValues))assert.deepEqual(row[key],value,`${spec.id}.${key}`);
  for(const key of spec.absentKeys)delete row[key];
  Object.assign(row,structuredClone(spec.oldValues));return row;
}
export function restoreMcityV6Fields(row,full=true){restoreUptownEligibility(row);const spec=MCITY_V6_SCOPE.refinements.find(item=>item.id===row.id);return spec&&(full||row.url===spec.newValues.url)?restore(row,spec,full):row;}
export function restoreMcityV6Refinements(data){for(const row of data.assets)restoreMcityV6Fields(row);return data;}
export function restoreMcityV6Catalogue(data){
 restorePublicStandaloneAdditions(data);
 for(const kind of ['assets','views'])for(const spec of MCITY_V6_SCOPE[kind])restore(data[kind].find(row=>row.id===spec.id),spec);
 for(const asset of MCITY_V6_SCOPE.addedAssets){const row=data.assets.find(row=>row.id===asset.id);if(row){assert.deepEqual(row,asset);data.assets=data.assets.filter(row=>row.id!==asset.id);}}
 return data;
}
export function restoreMcityV6Projects(rows){restore(rows.find(row=>row.id===MCITY_V6_SCOPE.project.id),MCITY_V6_SCOPE.project);return rows;}
export function restoreMcityV6Revisions(data){for(const revision of MCITY_V6_SCOPE.addedRevisions){const row=data.revisions.find(row=>row.id===revision.id);if(row){assert.deepEqual(row,revision);data.revisions=data.revisions.filter(row=>row.id!==revision.id);}}return data;}
export function restoreMcityV6Versions(data){for(const [url,hash] of Object.entries(MCITY_V6_SCOPE.addedVersions)){if(url in data.sha256){assert.equal(data.sha256[url],hash);delete data.sha256[url];}}return data;}
export function restoreMcityV6Register(text){if(text.includes(MCITY_V6_SCOPE.csvNewRow)){assert.equal(text.split(MCITY_V6_SCOPE.csvNewRow).length,2);return text.replace(MCITY_V6_SCOPE.csvNewRow,MCITY_V6_SCOPE.csvOldRow);}assert.equal(text.split(MCITY_V6_SCOPE.csvOldRow).length,2);return text;}
