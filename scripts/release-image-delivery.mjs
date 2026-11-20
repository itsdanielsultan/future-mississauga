// Publication-only verification of additive image hosting. Historical CDN policy
// and source files are immutable; no network or provider writes happen here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,lstat,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COVERAGE_MANIFEST_SHA256} from '../public/coverage-media-policy.js';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=/^[a-f0-9]{64}$/;
const releaseRoot='https://github.com/itsdanielsultan/future-mississauga/releases/download/';
const historicalPins=Object.freeze({
 'scripts/asset-delivery-policy.json':'2263c6fcab929096c29fe884d4154a6e7a0fdfb7b9eb68406f8872a4a6de2580',
 'scripts/asset-delivery-remote-proof.json':'3a6003902a82e1a4f81723126bb32a6b2a80b63d5b6947b6c6b9e6706a62f938',
 'public/asset-delivery-map.js':'77f914fef1dc1093514868caf75c45b53d430d8bf3a952c36b59d32be1e951ad'
});
export const releaseImageManifestPins=Object.freeze([
 Object.freeze({path:'data/coverage-media-20261113.json',sha256:COVERAGE_MANIFEST_SHA256}),
 Object.freeze({path:'data/east-credit-media-20261113.json',sha256:'e1ee0fc1e6f4e64addd780b1ee29e550cf65acf683a98b10c042ef7d671ba614'}),
 Object.freeze({path:'data/meadowvale-media-20261113.json',sha256:'ccc8d432770d6bd5e2ffbbf0c7835b1a59aa3ff28d3fbe87e08114bfc53b2702'}),
 Object.freeze({path:'data/downtown-current-media-20261113.json',sha256:'20719b18cf14a8b4f1443d167310e8386935de8f63facb0b6249f73e626b9e74',kind:'native-media-catalog/v2',sourcePackageSHA256:'a9f1b0a129d485b0737cb889d1e2cc022cdaba43f56db22cfc8733debb46cb32'})
]);
const keys=['path','url','sha256','bytes','mimeType','width','height'];
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|\+00:00)$/.test(value)&&Number.isFinite(Date.parse(value));
function parseMap(text){
 const match=text.match(/^export const releaseImageAssets = Object\.freeze\((\[[^\n]*\])\);$/m);
 assert(match,'Release image map must be one static immutable array');
 assert.equal(text.replace(match[0],'').replace(/^\s*\/\/[^\n]*$/gm,'').trim(),'','Release image map cannot contain executable additions');
 const rows=JSON.parse(match[1]);assert(Array.isArray(rows));return rows;
}
function assetShape(row){
 assert.deepEqual(Object.keys(row).sort(),keys.toSorted(),'Exact release image map fields required');
 assert.match(row.path,/^gallery\/(?:missing-areas-20261113|refreshed-20261113|refreshed-20261113-v2)\/[a-zA-Z0-9-]+\.(?:png|avif|jpg)$/,'Only approved additive image paths are supported');
 assert.match(row.sha256,digest);assert(Number.isSafeInteger(row.bytes)&&row.bytes>0);
 assert(Number.isSafeInteger(row.width)&&row.width>0&&Number.isSafeInteger(row.height)&&row.height>0);
 const mime={png:'image/png',avif:'image/avif',jpg:'image/jpeg'}[row.path.split('.').at(-1)];assert.equal(row.mimeType,mime);
 assert(basename(row.path).endsWith('-'+row.sha256.slice(0,12)+'.'+row.path.split('.').at(-1)),'Image basename must include its exact SHA prefix');
 const url=new URL(row.url);assert.equal(url.origin,'https://github.com');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
 const parts=url.pathname.split('/');assert.equal(parts.length,7);assert.deepEqual(parts.slice(1,5),['itsdanielsultan','future-mississauga','releases','download']);
 assert.match(parts[5],/^neighbourhood-images-2026-11-13-[a-z0-9]+(?:-[a-z0-9]+)*$/,'Unexpected image release tag');
 assert.equal(parts[6],basename(row.path),'Remote filename must preserve the exact local identity');
 assert.equal(row.url,releaseRoot+parts[5]+'/'+basename(row.path),'Only canonical immutable release URLs are supported');return parts[5];
}
async function optionalRegularFile(stage,path){
 const parts=path.split('/');
 for(let i=1;i<=parts.length;i++){
  let info;try{info=await lstat(join(stage,...parts.slice(0,i)));}catch(error){if(error.code==='ENOENT')return null;throw error;}
  assert(!info.isSymbolicLink(),'Release image paths must not traverse symbolic links');
  assert(i===parts.length?info.isFile():info.isDirectory(),'Release image path must name a regular file');
 }
 return readFile(join(stage,path));
}
function collectAssets(manifest,manifestSHA256,pin={}){
 const direct=pin.kind==='native-media-catalog/v2';
 if(direct){assert.equal(manifest.schema,'future-mississauga-native-media-catalog/v2');assert.match(pin.sourcePackageSHA256,digest);assert.equal(manifest.finalFrozenAdoptionSHA256??null,null);}
 assert(Array.isArray(manifest.images)&&manifest.images.length>0,'Missing current image rows');
 const assets=[];
 for(const row of manifest.images){
  assert(row.displayMaster&&row.download&&Array.isArray(row.responsivePreviews),'Incomplete current media row');
  if(direct){
   assert.equal(row.sourceFreezeState,'FINAL_FROZEN');assert.equal(row.finalSourceAdoption??null,null);
   const sourceKeys=['sceneProof','creditProof','renderProof','sourceRevision','importProof','nativeInventory','compositionProof','packageScript','footerScript','packageContract',...(row.identity.startsWith('wide/')?['footerWordingRevision']:[])];
   assert.deepEqual(Object.keys(row.provenance).sort(),sourceKeys.sort(),'Exact direct-source provenance required');
   for(const proof of Object.values(row.provenance)){assert.deepEqual(Object.keys(proof),['sha256']);assert.match(proof.sha256,digest);}
  }
  if(manifest.finalFrozenAdoptionSHA256)assert.match(row.provenance.sourceAdoption?.sha256||'',digest,'Original per-source adoption pin must remain separate from global adoption');
  for(const asset of [row.displayMaster,row.download,...row.responsivePreviews]){
   assert(Array.isArray(asset.dimensions)&&asset.dimensions.length===2,'Missing approved image dimensions');
   assets.push({path:asset.url,sha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType,width:asset.dimensions[0],height:asset.dimensions[1],sourceSceneSHA256:row.sourceSceneSHA256,sourceManifestSHA256:direct?manifestSHA256:row.provenance.deliveryManifest.sha256,nativeSourceSHA256:row.displayMaster.sha256,sourceAdoptionSHA256:row.provenance.sourceAdoption?.sha256??null,finalFrozenAdoptionSHA256:manifest.finalFrozenAdoptionSHA256??null,sourceMediaManifestSHA256:manifestSHA256,sourcePackageSHA256:direct?pin.sourcePackageSHA256:manifest.sourcePackageSHA256,...(direct?{sourceManifestKind:pin.kind,sourceProofs:row.provenance,sourceFreezeState:row.sourceFreezeState}:{}),role:!direct&&asset.role==='nativeSceneOnExpandedWhiteCanvas'?'nativeSceneOnTrue4x5WhiteCanvas':asset.role,renderTimestampUTC:row.renderTimestampUTC,sourceDates:row.caption?.sourceDates,credits:row.caption?.fullCredits});
  }
 }
 return assets;
}

export async function validateReleaseImageDelivery(stage,{
 proofPath=join(root,'scripts/release-image-delivery-proof.json'),
 evidenceRoot=join(root,'scripts/release-image-delivery-evidence'),
 manifestPins=releaseImageManifestPins
}={}){
 stage=resolve(stage);
 for(const [path,hash] of Object.entries(historicalPins))assert.equal(sha(await readFile(join(root,path))),hash,'Historical CDN policy/map/proof changed');
 assert.equal(sha(await readFile(join(stage,'asset-delivery-map.js'))),historicalPins['public/asset-delivery-map.js'],'Staged historical CDN map changed');
 const policy=JSON.parse(await readFile(join(root,'scripts/asset-delivery-policy.json'),'utf8'));assert.equal(policy.assets.length,290);
 const legacyPaths=new Set(policy.assets.map(row=>row.path));
 const map=parseMap(await readFile(join(stage,'release-asset-map.js'),'utf8'));
 const expected=[];
 assert.equal(new Set(manifestPins.map(pin=>pin.path)).size,manifestPins.length,'Duplicate approved manifest');
 for(const pin of manifestPins){
  assert.match(pin.path,/^data\/[a-z0-9-]+\.json$/);assert.match(pin.sha256,digest);
  const bytes=await readFile(join(stage,pin.path));assert.equal(sha(bytes),pin.sha256,'Current image manifest changed: '+pin.path);
  expected.push(...collectAssets(JSON.parse(bytes),pin.sha256,pin));
 }
 assert(expected.length>0,'No approved current release images');
 const expectedByPath=new Map(expected.map(row=>[row.path,row]));assert.equal(expectedByPath.size,expected.length,'Duplicate current image identity');
 assert.equal(map.length,expected.length,'Release map must cover every current approved image exactly once');
 assert.equal(new Set(map.map(row=>row.path)).size,map.length,'Duplicate release path');assert.equal(new Set(map.map(row=>row.url)).size,map.length,'Duplicate release URL');
 const tags=new Map();
 for(const row of map){
  tags.set(row.path,assetShape(row));assert(!legacyPaths.has(row.path),'Historical CDN assets cannot be rebound');
  const approved=expectedByPath.get(row.path);assert(approved,'Unapproved release image path');
  for(const key of keys.filter(key=>key!=='url'))assert.deepEqual(row[key],approved[key],'Release map differs from the approved image: '+key+' '+row.path);
 }
 const proofBytes=await readFile(proofPath),proof=JSON.parse(proofBytes);
 assert.equal(proof.schema,'future-mississauga-release-image-delivery-proof/v1');assert(Array.isArray(proof.batches)&&proof.batches.length>0,'Missing verified release batches');
 assert.equal(new Set(proof.batches.map(batch=>batch.tag)).size,proof.batches.length,'Duplicate release batch');
 const verified=new Map();
 for(const batch of proof.batches){
  assert.match(batch.tag,/^neighbourhood-images-2026-11-13-[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.match(batch.targetCommit,/^[a-f0-9]{40}$/);
  assert.match(batch.planSHA256,digest);assert.match(batch.publicVerificationSHA256,digest);
  const evidenceBytes=await readFile(join(evidenceRoot,batch.publicVerificationSHA256+'.json'));
  assert.equal(sha(evidenceBytes),batch.publicVerificationSHA256,'Public verification artifact changed');
  assert(!/\/Users\/|\/private\/|file:\/\/|["'](?:localPath|sourcePath|sourceFile)["']\s*:/.test(evidenceBytes.toString()),'Public evidence must not contain private source paths');
  const evidence=JSON.parse(evidenceBytes);
  assert.equal(evidence.schema,'future-mississauga-coverage-public-byte-proof/v1');assert.equal(evidence.tag,batch.tag);assert.equal(evidence.targetCommit,batch.targetCommit);assert.equal(evidence.planSHA256,batch.planSHA256,'Private plan provenance must match the sanitized verification');
  assert(Array.isArray(batch.files)&&batch.files.length>0);assert(Array.isArray(evidence.assets));
  assert.equal(evidence.publicHashesVerified,batch.files.length);assert.equal(evidence.publicDimensionsVerified,batch.files.length);assert.equal(evidence.assets.length,batch.files.length);
  const evidenceByPath=new Map(evidence.assets.map(row=>[row.logicalURL,row]));assert.equal(evidenceByPath.size,evidence.assets.length,'Duplicate remote body proof');
  for(const row of batch.files){
   const mapped=map.find(item=>item.path===row.path);assert(mapped,'Proof names an unapproved image');assert.equal(tags.get(row.path),batch.tag,'Proof batch does not own this immutable URL');
   assert(!verified.has(row.path),'Duplicate cross-batch image proof');
   for(const key of keys)assert.deepEqual(row[key],mapped[key],'Remote proof differs from release map: '+key+' '+row.path);
   assert.equal(row.status,200,'Full public image response must be 200');assert.equal(row.completeBodyHashed,true,'Complete remote body hashing is required');assert(timestamp(row.verifiedAt),'Missing observed remote verification timestamp');
   const body=evidenceByPath.get(row.path),approved=expectedByPath.get(row.path);assert(body,'Missing public full-body evidence');
   for(const key of keys.filter(key=>key!=='path'))assert.deepEqual(body[key],row[key],'Public body evidence differs: '+key+' '+row.path);
   assert.equal(body.file,basename(row.path));assert.equal(body.status,200);assert.equal(body.completeBodyHashed,true);assert.equal(body.verifiedAt,row.verifiedAt);
   assert.equal(body.publicHTTPVerified,true);assert.equal(body.publicDimensionsVerified,true);assert.equal(body.published,true);assert.equal(body.providerDigest,'sha256:'+row.sha256);
   assert.equal(body.decodedMimeType,row.mimeType,'Decoded image MIME must match the approved image');
   assert.equal(body.providerMimeType,row.mimeType,'Provider image MIME must match the approved image');
   assert.equal(body.decodedFormat,{'image/png':'PNG','image/jpeg':'JPEG','image/avif':'AVIF'}[row.mimeType],'Decoded image format must match the approved image');
   assert.equal(body.decodedWidth,row.width,'Decoded image width must match the approved image');
   assert.equal(body.decodedHeight,row.height,'Decoded image height must match the approved image');
   assert([row.mimeType,'application/octet-stream'].includes(body.httpContentType),'Unexpected public image transport MIME');
   for(const key of ['sourceSceneSHA256','sourceManifestSHA256','nativeSourceSHA256','sourceAdoptionSHA256','role','renderTimestampUTC','sourceDates','credits'])assert.deepEqual(body[key],approved[key],'Public proof source pin differs: '+key);
   if(approved.sourceManifestKind){
    for(const key of ['sourceManifestKind','sourceProofs','sourceFreezeState'])assert.deepEqual(body[key],approved[key],'Public direct-source proof differs: '+key);
    assert.equal(evidence.sourceManifestKind,approved.sourceManifestKind,'Batch direct-source contract differs');
   }
   assert.equal(evidence.finalFrozenAdoptionSHA256??null,approved.finalFrozenAdoptionSHA256,'Batch adoption pin differs from the approved source');
   for(const key of ['sourceMediaManifestSHA256','sourcePackageSHA256'])assert.equal(evidence[key],approved[key],'Public proof manifest/package pin differs: '+key);
   verified.set(row.path,row);
  }
 }
 assert.equal(verified.size,map.length,'Every release image must have a successful full-body public proof');
 // Any optional local copies must also be exact. Images absent from the build
 // are valid only after the immutable remote evidence above has passed.
 const stagedPaths=[];
 for(const row of map){
  const bytes=await optionalRegularFile(stage,row.path);if(bytes===null)continue;
  assert.equal(bytes.length,row.bytes,'Staged release image size changed: '+row.path);assert.equal(sha(bytes),row.sha256,'Staged release image bytes changed: '+row.path);stagedPaths.push(row.path);
 }
 return {schema:'future-mississauga-release-image-delivery-validation/v1',state:'PUBLIC_BODY_PROOF_VERIFIED',images:map.length,batches:proof.batches.length,totalRemoteBytes:map.reduce((sum,row)=>sum+row.bytes,0),proofSHA256:sha(proofBytes),historicalCDNAssetsPreserved:290,sourceFilesRetained:true,stagedPaths};
}

export async function offloadReleaseImages(stage,options){
 stage=resolve(stage);assert(/^\.publication-stage-|^future-mississauga-check-|^release-image-test-/.test(basename(stage)),'Release offload requires an isolated publication stage');
 const info=await lstat(stage);assert(info.isDirectory()&&!info.isSymbolicLink(),'Publication stage must be a regular directory');
 const verified=await validateReleaseImageDelivery(stage,options);
 // No local file is removed until every manifest, map and body proof succeeds.
 for(const path of verified.stagedPaths)await rm(join(stage,path));
 const {stagedPaths,...report}=verified;report.removedStagedCopies=stagedPaths.length;
 await writeFile(join(stage,'data/release-image-delivery.json'),JSON.stringify(report)+'\n');return report;
}
