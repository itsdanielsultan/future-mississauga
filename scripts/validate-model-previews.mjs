import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {trustedModelURL} from '../public/model-preview-loading.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const sha=data=>createHash('sha256').update(data).digest('hex');

export async function validateModelPreviews(site) {
  const manifest=JSON.parse(await readFile(join(site,'data/model-previews.json'),'utf8'));
  const ids=new Set(), commits=new Set(); let localAssets=0,externalAssets=0,externalBytes=0;
  for(const asset of manifest.assets){
    assert(!ids.has(asset.id),'Duplicate model preview asset');ids.add(asset.id);
    assert(trustedModelURL(asset.url),'Unpinned or unapproved model host: '+asset.id);
    let encoded;
    if(asset.repositoryFile){
      assert.match(asset.repositoryCommit,/^[a-f0-9]{40}$/);
      assert.match(asset.repositoryFile,/^model-assets\/20261025\/[a-z0-9-]+\.glb\.gz$/);
      assert.equal(asset.url,`https://raw.githubusercontent.com/itsdanielsultan/future-mississauga/${asset.repositoryCommit}/${asset.repositoryFile}`);
      encoded=await readFile(join(root,asset.repositoryFile));
      const committed=execFileSync('git',['show',`${asset.repositoryCommit}:${asset.repositoryFile}`],{cwd:root,maxBuffer:100_000_000});
      assert.deepEqual(encoded,committed,'Local model differs from its pinned repository commit: '+asset.id);
      externalAssets++;externalBytes+=encoded.length;commits.add(asset.repositoryCommit);
    }else{encoded=await readFile(join(site,asset.url));localAssets++;}
    assert.equal(encoded.length,asset.bytes,asset.id);
    assert.equal(sha(encoded),asset.downloadSHA256,asset.id+' compressed identity');
    const decoded=gunzipSync(encoded);
    assert.equal(decoded.length,asset.decodedBytes,asset.id);
    assert.equal(sha(decoded),asset.sha256,asset.id+' decoded identity');
  }
  const views=new Set();
  for(const view of manifest.views){
    assert(!views.has(view.id),'Duplicate model preview route');views.add(view.id);
    assert(view.assets.length>0 && new Set(view.assets).size===view.assets.length);
    assert(view.assets.every(id=>ids.has(id)),'Unknown model in preview '+view.id);
    assert(view.credit && view.rights && view.limits && view.sources.length,'Missing model attribution');
    assert(view.cameraDirection.length===3 && view.cameraDirection.every(Number.isFinite));
  }
  return {views:views.size,localAssets,externalAssets,externalBytes,externalCommits:[...commits],allCompressedAndDecodedHashesVerified:true,externalCommitBytesVerifiedLocally:true,remoteAvailabilityCheckedSeparately:true};
}
