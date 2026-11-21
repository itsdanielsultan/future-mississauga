import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// The share catalogue switches with the published HTML. A staged future
// catalogue can exist on disk while the November 20 edition still serves visitors.
export function activeArtworkEdition(site=fileURLToPath(new URL('../public/',import.meta.url))) {
  const shares=JSON.parse(readFileSync(join(site,'data/edition-shares.json'),'utf8'));
  const selected=/^gallery\/edition-(\d{8})\/signed\/home-downtown-future\.webp$/.exec(shares.index.source);
  assert(selected,'Home must identify the published, signed Downtown edition');
  const date=selected[1];
  assert.equal(shares.index.url,'gallery/edition-'+date+'/share/index.jpg');
  return date;
}
