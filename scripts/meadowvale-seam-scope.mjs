import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export const MEADOWVALE_SEAM_SCOPE=JSON.parse(readFileSync(new URL('./meadowvale-seam-scope.json',import.meta.url)));
// Remove only the exact accepted additive seam revision before historical guards.
export function restoreMeadowvaleSeamVersion(data){
 const {url,sha256}=MEADOWVALE_SEAM_SCOPE.asset;
 assert.equal(data.sha256[url],sha256,'exact accepted Meadowvale seam version');
 delete data.sha256[url];return data;
}
