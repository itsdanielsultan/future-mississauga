import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assertNativeMediaTransport,nativeAssetFilename,nativeReleasePrefix} from './native-media-transport.mjs';
const pub=new URL('../public/',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL(file,pub),'utf8'));
const gallery=read('data/native-media-20261102.json'),neighbourhood=read('data/neighbourhood-media-20261102.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Synthetic in-memory provider receipt. It is never written as release evidence.
function readyFixture(){
 const images=structuredClone([...gallery.images,...neighbourhood.images]),assets=[];
 for(const row of images){
  for(const [index,asset] of [row.displayMaster,row.download,...row.responsivePreviews].entries()){
   if(asset.mimeType==='image/avif')continue;
   const file=nativeAssetFilename(row,asset,index);asset.url=nativeReleasePrefix+file;
   assets.push({file,kind:row.identity.split('/')[0],imageFile:row.identity.split('/').slice(1).join('/'),purpose:index===0?'displayMaster':index===1?'download':asset.dimensions[0]===Math.min(row.nativeSceneDimensions[0],1200)?'jpeg1200':'jpeg3200',bytes:asset.bytes,sha256:asset.sha256,width:asset.dimensions[0],height:asset.dimensions[1],format:asset.mimeType,sourceSHA256:index===0?row.sourceSceneSHA256:row.displayMaster.sha256,url:asset.url});
  }
 }
 assert.equal(assets.length,236);
 const plan={readyForPublication:true,imageCount:59,tag:'pictures-native-2026-11-02',assetSetSHA256:sha(JSON.stringify(assets)),assets,totalBytes:assets.reduce((sum,a)=>sum+a.bytes,0)};
 const planBytes=Buffer.from(JSON.stringify(plan));
 const proof={state:'PUBLIC_BYTES_VERIFIED',repository:'itsdanielsultan/future-mississauga',tag:plan.tag,planSHA256:sha(planBytes),assetSetSHA256:plan.assetSetSHA256,publicHashesVerified:236,totalBytes:plan.totalBytes,nativeResolutionPreserved:true,existingAssetsUnchanged:true,providerDigestExact:true,allRequestsUnauthenticatedForDownloads:true,assets:assets.map(a=>({...a,responseMIME:'application/octet-stream',contentEncoding:'identity',[a.format==='image/png'?'PNGSignatureVerified':'JPEGSignatureVerified']:true}))};
 return {wrapper:{state:'READY_FOR_PUBLICATION',publication:true,images:[images.find(row=>row.identity==='neighbourhood/fairview/before')]},hosting:{proof,planBytes}};
}
test('final transport verifies four exact hosted originals and two local AVIFs without file-reading https',()=>{
 const {wrapper,hosting}=readyFixture();assert.deepEqual(assertNativeMediaTransport(wrapper,pub,{hosting}),{localCount:2,remoteCount:4});
});
test('staged transport remains all-local and byte-exact',()=>{
 const row=structuredClone(gallery.images.find(row=>row.identity==='wide/clarkson-future.png'));
 // The test continues covering staging after the real catalogue switches to READY.
 for(const [index,asset]of[row.displayMaster,row.download,...row.responsivePreviews].entries())asset.url='gallery/native-20261102/'+nativeAssetFilename(row,asset,index);
 const wrapper={state:'LOCAL_STAGED_ONLY',publication:false,images:[row]};
 // Hosted originals may have been retired from public only after verified delivery.
 // This branch uses an exact retained on-disk scene only while staging exists.
 if(fs.existsSync(new URL(row.displayMaster.url,pub)))assert.deepEqual(assertNativeMediaTransport(wrapper,pub),{localCount:6,remoteCount:0});
 else assert.throws(()=>assertNativeMediaTransport(wrapper,pub),/ENOENT/);
});
test('mixed states, arbitrary hosts, altered immutable filenames and remote AVIFs are rejected',()=>{
 const changes=[w=>w.publication=false,w=>w.state='LOCAL_STAGED_ONLY',w=>w.state='PUBLIC',w=>w.images[0].displayMaster.url='https://example.com/picture.png',w=>w.images[0].displayMaster.url=w.images[0].displayMaster.url.replace('pictures-native-2026-11-02','different-tag'),w=>w.images[0].download.url+='?download=1',w=>w.images[0].displayMaster.url=w.images[0].displayMaster.url.replace(w.images[0].displayMaster.sha256.slice(0,12),'000000000000'),w=>w.images[0].responsivePreviews.find(a=>a.mimeType==='image/avif').url=nativeReleasePrefix+'bad.avif',w=>w.images[0].displayMaster.url='gallery/native-20261102/'+nativeAssetFilename(w.images[0],w.images[0].displayMaster,0),w=>w.images[0].responsivePreviews.pop()];
 for(const change of changes){const {wrapper,hosting}=readyFixture();change(wrapper);assert.throws(()=>assertNativeMediaTransport(wrapper,pub,{hosting}));}
});
test('READY requires complete successful public-byte proof matching its immutable plan and image metadata',()=>{
 for(const change of [p=>p.state='PUBLIC_PROVIDER_VERIFIED_BYTES_PENDING',p=>p.publicHashesVerified=235,p=>p.assets.pop(),p=>p.planSHA256='0'.repeat(64),p=>p.assets[0].contentEncoding='gzip',p=>p.assets[0].PNGSignatureVerified=false,p=>p.assets[0].sha256='0'.repeat(64),p=>p.assets[0].responseMIME='text/html']){
  const {wrapper,hosting}=readyFixture();change(hosting.proof);assert.throws(()=>assertNativeMediaTransport(wrapper,pub,{hosting}));
 }
 const {wrapper,hosting}=readyFixture();wrapper.images[0].displayMaster.bytes++;assert.throws(()=>assertNativeMediaTransport(wrapper,pub,{hosting}));
});
