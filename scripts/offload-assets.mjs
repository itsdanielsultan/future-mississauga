// Build-only removal after the complete source package has passed validation.
// The original public files remain in the source checkout and Git history.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, lstat, readdir, rm, writeFile} from 'node:fs/promises';
import {join, resolve, basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function offloadValidatedAssets(stage, {policyPath = join(root,'scripts/asset-delivery-policy.json'), proofPath = join(root,'scripts/asset-delivery-remote-proof.json')} = {}) {
  stage = resolve(stage);
  // Do not accept the source or an arbitrary existing directory as a build stage.
  assert(/^\.publication-stage-|^future-mississauga-check-|^asset-delivery-test-/.test(basename(stage)), 'Offload requires an isolated build stage');
  assert((await lstat(stage)).isDirectory());
  const policy = JSON.parse(await readFile(policyPath,'utf8'));
  const proof = JSON.parse(await readFile(proofPath,'utf8'));
  assert.equal(policy.schema,'future-mississauga-asset-delivery/v3');
  assert.equal(proof.schema,'future-mississauga-asset-delivery-proof/v3');
  assert.equal(proof.origin,policy.origin);
  assert.equal(proof.legacyRedirectsVerified,true,'Legacy URLs must still work for open viewers');
  assert.equal(proof.viewerChecksPassed,true,'Measure the actual viewer before cutover');
  assert.equal(proof.zeroCostPlanConfirmed,true,'No usage-billed hosting plan is authorized');
  // The browser's static map must name precisely the copies verified here. A
  // refreshed policy alone must never remove files while serving an older map.
  const browserMap=await readFile(join(stage,'asset-delivery-map.js'),'utf8');
  const mapOrigin=browserMap.match(/^export const assetOrigin = ("[^"\n]+");$/m);
  const mapPaths=browserMap.match(/^export const deliveryPaths = Object\.freeze\((\{[^\n]+\})\);$/m);
  assert(mapOrigin&&mapPaths,'Generated browser delivery map unavailable');
  assert.equal(JSON.parse(mapOrigin[1]),policy.origin,'Browser asset origin is stale');
  assert.deepEqual(JSON.parse(mapPaths[1]),Object.fromEntries(policy.assets.map(row=>[row.path,row.target])),'Browser delivery map is stale');
  const verified = new Map(proof.files.map(row=>[row.path,row]));
  assert.equal(new Set(policy.assets.map(row=>row.path)).size,policy.assets.length,'Duplicate offload source');
  // Verify the whole list before removing any build-stage file. A new edition
  // must be uploaded and proven first; never silently use an older CDN copy.
  let offloadedBytes=0;
  for(const row of policy.assets) {
    assert(/^(?:models\/[a-zA-Z0-9_./-]+\.glb(?:\.gz)?|data\/[a-zA-Z0-9_-]+\.json\.gz)$/.test(row.path) && !row.path.includes('..'),'Unexpected offload path');
    const transport=row.transport;
    assert(transport&&['negotiated-gzip','identity'].includes(transport.mode),'Missing explicit transport policy');
    assert.equal(row.target,`assets/${row.sha256}/${basename(row.path)}`);
    if(transport.mode==='negotiated-gzip'){
      assert(row.path.endsWith('.glb'),'Negotiated HTTP gzip applies only to ordinary GLBs');
      assert.equal(transport.contentEncoding,'gzip');
    }else{
      assert(row.path.endsWith('.gz'),'Only manually decoded gzip assets use identity transfer');
      assert.equal(transport.contentEncoding,null);
    }
    assert(row.bytes<=25*1024*1024);
    const file=join(stage,row.path), info=await lstat(file);
    assert(info.isFile()&&!info.isSymbolicLink(),'Asset must be a regular file');
    const bytes=await readFile(file), remote=verified.get(row.path);
    assert.equal(bytes.length,row.bytes,'Local size changed: '+row.path);
    assert.equal(sha(bytes),row.sha256,'Local bytes changed: '+row.path);
    assert(remote,'Missing remote proof: '+row.path);
    assert.equal(remote.url,policy.origin+'/'+row.target);
    assert.equal(remote.status,200);assert.equal(remote.sha256,row.sha256);
    assert.equal(remote.bytes,row.bytes);assert.equal(remote.corsAllowed,true);
    assert.equal(remote.contentEncoding,transport.contentEncoding,'Incorrect HTTP transport encoding');
    assert(Number.isSafeInteger(remote.encodedBytes)&&remote.encodedBytes>0,'Missing observed wire size');
    assert.match(remote.encodedSHA256,/^[a-f0-9]{64}$/,'Missing observed wire SHA256');
    if(transport.mode==='negotiated-gzip'){
      // Cloudflare negotiates the wire encoding. Its bytes can vary with the
      // compressor, but one HTTP decode must exactly restore the original GLB.
      assert.equal(remote.wireGzipMagic,true,'HTTP-gzip response must be gzip on the wire');
      assert.equal(remote.decodedGLBMagic,true,'One HTTP decode must produce GLB, not gzip');
    }else{
      assert.equal(remote.encodedSHA256,row.sha256,'Manual gzip transport bytes changed');
      assert.equal(remote.encodedBytes,row.bytes,'Manual gzip transport size changed');
    }
    if(row.path.endsWith('.gz'))assert.equal(remote.contentEncoding,null,'Manual gzip files must stay undecoded');
    offloadedBytes+=row.bytes;
  }
  for(const row of policy.assets)await rm(join(stage,row.path));
  const report={schema:'future-mississauga-offloaded-assets/v1',origin:policy.origin,sourceFilesRetained:true,quality:'Exact published bytes',offloadedFiles:policy.assets.length,offloadedBytes,assets:policy.assets};
  await writeFile(join(stage,'data/asset-delivery.json'),JSON.stringify(report)+'\n');
  // Enforce the original strict publication limit on the actual final output.
  let bytes=0, files=0;
  const walk=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){assert(!entry.isSymbolicLink());const file=join(directory,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile()){bytes+=(await lstat(file)).size;files++;}}};
  await walk(stage);
  assert(bytes<1_000_000_000,'Final published output exceeds conservative 1 GB limit');
  return {...report,assets:undefined,publishedBytes:bytes,publishedFiles:files};
}
