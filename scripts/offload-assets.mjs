// Build-only removal after the complete source package has passed validation.
// The original public files remain in the source checkout and Git history.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, lstat, readdir, rm, writeFile} from 'node:fs/promises';
import {join, resolve, basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Only these ten reviewed display/download derivatives may join the existing
// model/data offload policy. A broader path pattern or policy edit is not approval.
const approvedPNGs = new Map([
  ["gallery/revision-20261109/downtown-existing-clean-381b478c8d95.png","381b478c8d95096627b90f625d98653331e07768e5ec636064a56965244d33a8",24733434,[6144,3840]],
  ["gallery/revision-20261109/downtown-existing-credited-19f24a346b5f.png","19f24a346b5fde5e1a59a9b3fa2e4b85f17edeb1c89143bf8200adda4656ec13",24809674,[6144,4238]],
  ["gallery/revision-20261109/downtown-skyline-existing-clean-c734f7a07a8f.png","c734f7a07a8f136572ff4c8fc963ba299a2fd09f30d695c239e197abfc1ed079",5791916,[6144,2240]],
  ["gallery/revision-20261109/downtown-skyline-existing-credited-a04cd714ebe5.png","a04cd714ebe5ebd872e05c759faa9bedb62663480b421984311eeca0e05aaf6d",5870923,[6144,2638]],
  ["gallery/revision-20261109/downtown-skyline-construction-clean-20e1978e1681.png","20e1978e1681d964c2b7a85709c7fea9327c8cc9e74707cbb116176165a48ae4",5889656,[6144,2240]],
  ["gallery/revision-20261109/downtown-skyline-construction-credited-0e1e00af6d7e.png","0e1e00af6d7e7c1d1e68733bdf10a3962016e566fe0e1fe2d87768bb71786f0b",5980937,[6144,2638]],
  ["gallery/revision-20261109/downtown-future-clean-16453283e980.png","16453283e980b7a98b7acc9c918f6ea0931f30d3e385c4711d4bd6a7d7cd9730",25219594,[6144,3840]],
  ["gallery/revision-20261109/downtown-future-credited-f58ad013a866.png","f58ad013a866c1967511f0cd9f1fba298d39491570519a8246a669b73cc12174",25314194,[6144,4238]],
  ["gallery/revision-20261109/downtown-skyline-future-clean-39afe038e208.png","39afe038e208efa28d2f46ddb2b1bfb7e9797897c69e7d991eb7810a5da05f54",6100920,[6144,2240]],
  ["gallery/revision-20261109/downtown-skyline-future-credited-b83e273a5263.png","b83e273a52636a551ee400b95b8a45a89eb4109155d2bc873fb032f54a923de5",6196395,[6144,2638]],
].map(([path, sha256, bytes, dimensions]) => [path, {sha256, bytes, dimensions}]));
const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);

// This metadata check is independently exercised with synthetic PNG fixtures.
// Production callers must first pass the exact reviewed path/hash allowlist below.
export function validatePNGTransfer(row, bytes, remote) {
  assert.equal(row.contentType, 'image/png', 'PNG policy must specify image/png');
  assert.equal(row.transport.mode, 'identity', 'PNG transfer must preserve original bytes');
  assert.equal(row.transport.contentEncoding, null, 'PNG transfer must not use Content-Encoding');
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature), 'Local PNG signature changed');
  assert.equal(bytes.readUInt32BE(8), 13, 'Invalid PNG IHDR length');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'Missing PNG IHDR');
  assert(Array.isArray(row.dimensions) && row.dimensions.length === 2 && row.dimensions.every(v => Number.isSafeInteger(v) && v > 0), 'Invalid PNG dimensions');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], row.dimensions, 'Local PNG dimensions changed');
  assert.equal(remote.contentType, 'image/png', 'Remote PNG Content-Type changed');
  assert.equal(remote.contentEncoding, null, 'Remote PNG transfer must use identity encoding');
  assert.equal(remote.pngMagic, true, 'Remote PNG signature was not verified');
  assert.deepEqual(remote.dimensions, row.dimensions, 'Remote PNG dimensions changed');
}

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
  assert.equal(verified.size,proof.files.length,'Duplicate remote proof source');
  assert.equal(new Set(policy.assets.map(row=>row.path)).size,policy.assets.length,'Duplicate offload source');
  // Verify the whole list before removing any build-stage file. A new edition
  // must be uploaded and proven first; never silently use an older CDN copy.
  let offloadedBytes=0;
  for(const row of policy.assets) {
    const png = approvedPNGs.get(row.path);
    const legacyPath = /^(?:models\/[a-zA-Z0-9_./-]+\.glb(?:\.gz)?|data\/[a-zA-Z0-9_-]+\.json\.gz)$/.test(row.path);
    assert((legacyPath || png) && !row.path.includes('..'),'Unexpected offload path');
    if (png) {
      assert.equal(row.sha256, png.sha256, 'PNG hash is outside the reviewed allowlist');
      assert.equal(row.bytes, png.bytes, 'PNG size is outside the reviewed allowlist');
      assert.deepEqual(row.dimensions, png.dimensions, 'PNG dimensions are outside the reviewed allowlist');
      assert.equal(row.contentType, 'image/png', 'PNG policy must specify image/png');
    }
    const transport=row.transport;
    assert(transport&&['negotiated-gzip','identity'].includes(transport.mode),'Missing explicit transport policy');
    assert.equal(row.target,`assets/${row.sha256}/${basename(row.path)}`);
    if(transport.mode==='negotiated-gzip'){
      assert(row.path.endsWith('.glb'),'Negotiated HTTP gzip applies only to ordinary GLBs');
      assert.equal(transport.contentEncoding,'gzip');
    }else{
      assert(row.path.endsWith('.gz') || png,'Identity transfer requires manually decoded gzip or an approved PNG');
      assert.equal(transport.contentEncoding,null);
    }
    assert(Number.isSafeInteger(row.bytes) && row.bytes>0 && row.bytes<=25*1024*1024);
    const remote=verified.get(row.path);
    assert(remote,'Missing remote proof: '+row.path);
    const file=join(stage,row.path), info=await lstat(file);
    assert(info.isFile()&&!info.isSymbolicLink(),'Asset must be a regular file');
    const bytes=await readFile(file);
    assert.equal(bytes.length,row.bytes,'Local size changed: '+row.path);
    assert.equal(sha(bytes),row.sha256,'Local bytes changed: '+row.path);
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
      assert.equal(remote.encodedSHA256,row.sha256,'Identity transport bytes changed');
      assert.equal(remote.encodedBytes,row.bytes,'Identity transport size changed');
    }
    if(row.path.endsWith('.gz'))assert.equal(remote.contentEncoding,null,'Manual gzip files must stay undecoded');
    if(png)validatePNGTransfer(row, bytes, remote);
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
