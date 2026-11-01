import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {imageDimensions} from './validate-current-citywide-media.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const PREFIX='https://github.com/itsdanielsultan/future-mississauga/releases/download/pictures-downtown-2026-11-01/';

export async function validateCurrentPictureMedia(root){
 const manifestBytes=await readFile(join(root,'data/downtown-media-20261101.json'));
 const proofBytes=await readFile(join(root,'data/downtown-media-20261101-integrity.json'));
 assert.equal(sha(manifestBytes),'65419d920618c4b27cb6b00ac6466e161f64488b34d796812a6fa23d6f3bb852','Current Downtown catalogue differs from the reviewed twelve-view package');
 assert.equal(sha(proofBytes),'7837330191c1a46b99cdaaa2c3ae2f31509e7324652a6db1015af19a13fb2b1c','Current Downtown accepted asset identities changed');
 const manifest=JSON.parse(manifestBytes),proof=JSON.parse(proofBytes);
 assert.equal(manifest.images.length,12);assert.equal(manifest.retainedDowntownIdentities.length,4);
 assert.equal(proof.assets.length,48);assert.equal(proof.status,'LOCAL_SOURCE_BYTES_VERIFIED');
 assert.equal(sha(await readFile(join(root,'data/labelled-image-assets.json'))),manifest.historicalCatalogueSHA256,'Historical image catalogue changed');
 const expected=manifest.images.flatMap(row=>['preview','responsive','displayMaster','download'].map(purpose=>({url:row[purpose].url,kind:row.kind,file:row.file,purpose,...Object.fromEntries(['bytes','sha256','width','height','format','sourceSHA256'].map(k=>[k,row[purpose][k]]))})));
 assert.deepEqual(proof.assets,expected);
 let localBytes=0,remoteBytes=0;
 for(const a of proof.assets){
  if(a.format==='image/avif'){
   assert(/^gallery\/downtown-20261101\/[a-z0-9-]+\.avif$/.test(a.url));
   const bytes=await readFile(join(root,a.url));assert.equal(bytes.length,a.bytes);assert.equal(sha(bytes),a.sha256);
   assert.deepEqual(imageDimensions(bytes,'image/avif'),[a.width,a.height]);localBytes+=a.bytes;
  }else{
   assert.equal(a.format,'image/png');assert(a.url.startsWith(PREFIX));assert.equal(new URL(a.url).search,'');
   assert.equal(a.url,PREFIX+a.kind+'-'+(a.purpose==='displayMaster'?'display-':'')+a.file);
   assert.equal(a.width,a.kind==='wide'?6144:3240);remoteBytes+=a.bytes;
  }
 }
 assert.equal(localBytes,6199452);assert.equal(remoteBytes,305391894);
 const shareBytes=await readFile(join(root,'data/share-preview-20261101.json'));
 assert.equal(sha(shareBytes),'9e471bc8999a5d0e9e91af326ee37715686847530ca4173f18f1d74c48174ab6');
 const share=JSON.parse(shareBytes),bytes=await readFile(join(root,share.url));
 assert.equal(sha(bytes),share.sha256);assert.equal(bytes.length,share.bytes);assert.equal(bytes.readUInt16BE(0),0xffd8);
 assert.equal(share.sourceSHA256,manifest.images.find(r=>r.kind==='wide'&&r.file==='downtown-future.png').download.sha256);
 return {currentViews:12,retainedDowntownViews:4,localAVIFs:24,localAVIFBytes:localBytes,remoteOriginalPNGs:24,remoteOriginalBytes:remoteBytes,nativeDimensionsPreserved:true,shareJPEGBytes:bytes.length,publicationEvidence:'REQUIRES_SEPARATE_PUBLIC_BYTE_RECEIPT'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await validateCurrentPictureMedia(resolve(process.argv[2]||'public')),null,2));
