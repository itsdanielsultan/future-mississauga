// Test-only verification of the two declared transport states. No network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const nativeReleasePrefix='https://github.com/itsdanielsultan/future-mississauga/releases/download/pictures-native-2026-11-02/';
const localPrefix='gallery/native-20261102/';
const sha=body=>createHash('sha256').update(body).digest('hex');
const releaseRoot=new URL('../../release/native-media/',import.meta.url);

export function nativeAssetFilename(row,asset,index){
 assert.match(row.identity,/^(?:(?:wide|portraits)\/[a-z0-9-]+\.png|neighbourhood\/fairview\/(?:before|after))$/);
 assert.match(asset.sha256,/^[a-f0-9]{64}$/);assert(Number.isInteger(asset.bytes)&&asset.bytes>0);
 assert.equal(asset.dimensions.length,2);assert(asset.dimensions.every(value=>Number.isInteger(value)&&value>0));
 let role,extension;
 if(index<2){assert.equal(asset.mimeType,'image/png');assert.equal(asset.role,index===0?'cleanNativeScene':'nativeSceneWithAppendedCreditFooter');role=index===0?'clean':'download';extension='png';}
 else{assert.equal(asset.role,'responsivePreview');assert(['image/avif','image/jpeg'].includes(asset.mimeType));role='scene-'+asset.dimensions[0];extension=asset.mimeType==='image/avif'?'avif':'jpg';}
 return row.identity.replace(/\.png$/,'').replaceAll('/','-')+'-'+role+'-'+asset.sha256.slice(0,12)+'.'+extension;
}

export function verifiedNativeHosting({proof,planBytes}={}){
 if(!proof){proof=JSON.parse(fs.readFileSync(new URL('public-byte-proof.json',releaseRoot),'utf8'));planBytes=fs.readFileSync(new URL('plan.json',releaseRoot));}
 assert.equal(proof.state,'PUBLIC_BYTES_VERIFIED');assert.equal(proof.repository,'itsdanielsultan/future-mississauga');assert.equal(proof.tag,'pictures-native-2026-11-02');
 assert.equal(proof.planSHA256,sha(planBytes));const plan=JSON.parse(planBytes);
 assert.equal(plan.readyForPublication,true);assert.equal(plan.imageCount,59);assert.equal(plan.tag,proof.tag);assert.equal(plan.assetSetSHA256,proof.assetSetSHA256);
 for(const key of ['nativeResolutionPreserved','existingAssetsUnchanged','providerDigestExact','allRequestsUnauthenticatedForDownloads'])assert.equal(proof[key],true,key);
 assert.equal(proof.publicHashesVerified,236);assert.equal(proof.assets.length,236);assert.equal(plan.assets.length,236);
 const byURL=new Map(proof.assets.map(asset=>[asset.url,asset]));assert.equal(byURL.size,236);
 const planned=new Map(plan.assets.map(asset=>[asset.url,asset]));assert.equal(planned.size,236);
 for(const asset of proof.assets){
  assert(asset.url.startsWith(nativeReleasePrefix));assert.equal(asset.contentEncoding,'identity');
  const intended=planned.get(asset.url);assert(intended,'verified URL must be present in the immutable plan');
  for(const key of ['file','kind','imageFile','purpose','bytes','sha256','width','height','format','sourceSHA256','url'])assert.deepEqual(asset[key],intended[key],key);
  const png=asset.format==='image/png';assert(png||asset.format==='image/jpeg');
  assert.equal(asset[png?'PNGSignatureVerified':'JPEGSignatureVerified'],true);
  assert([asset.format,'application/octet-stream'].includes(asset.responseMIME));
 }
 assert.equal(proof.totalBytes,proof.assets.reduce((sum,asset)=>sum+asset.bytes,0));assert.equal(plan.totalBytes,proof.totalBytes);
 return byURL;
}

export function assertNativeMediaTransport(wrapper,publicRoot,{rows=wrapper.images,hosting}={}){
 const staged=wrapper.state==='LOCAL_STAGED_ONLY'&&wrapper.publication===false;
 const ready=wrapper.state==='READY_FOR_PUBLICATION'&&wrapper.publication===true;
 assert(staged||ready,'native state and publication flag must agree');
 const remote=ready?verifiedNativeHosting(hosting):null;
 let localCount=0,remoteCount=0;
 for(const row of rows){
  assert.equal(row.responsivePreviews.length,4);assert.equal(row.responsivePreviews.filter(asset=>asset.mimeType==='image/avif').length,2);assert.equal(row.responsivePreviews.filter(asset=>asset.mimeType==='image/jpeg').length,2);
  const assets=[row.displayMaster,row.download,...row.responsivePreviews];let local=0,hosted=0;
  for(const [index,asset] of assets.entries()){
   const filename=nativeAssetFilename(row,asset,index),mustBeLocal=staged||asset.mimeType==='image/avif';
   assert.equal(asset.url,(mustBeLocal?localPrefix:nativeReleasePrefix)+filename,'only the exact role/hash URL is eligible');
   if(mustBeLocal){
    const bytes=fs.readFileSync(new URL(asset.url,publicRoot));assert.equal(bytes.length,asset.bytes,asset.url);assert.equal(sha(bytes),asset.sha256,asset.url);
    if(asset.mimeType==='image/png')assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],asset.dimensions,asset.url);
    local++;
   }else{
    const verified=remote.get(asset.url);assert(verified,'exact remote image must have an existing public-byte proof');
    assert.equal(verified.sha256,asset.sha256);assert.equal(verified.bytes,asset.bytes);assert.deepEqual([verified.width,verified.height],asset.dimensions);assert.equal(verified.format,asset.mimeType);
    assert.equal(verified.kind,row.identity.split('/')[0]);assert.equal(verified.imageFile,row.identity.split('/').slice(1).join('/'));
    assert.equal(verified.purpose,index===0?'displayMaster':index===1?'download':asset.dimensions[0]===Math.min(row.nativeSceneDimensions[0],1200)?'jpeg1200':'jpeg3200');
    assert.equal(verified.sourceSHA256,index===0?row.sourceSceneSHA256:row.displayMaster.sha256);hosted++;
   }
  }
  assert.equal(local,staged?6:2);assert.equal(hosted,staged?0:4);localCount+=local;remoteCount+=hosted;
 }
 return {localCount,remoteCount};
}
