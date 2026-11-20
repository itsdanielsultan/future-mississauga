import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,access,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {validateReleaseImageDelivery,offloadReleaseImages,releaseImageManifestPins} from './release-image-delivery.mjs';
const sha=body=>createHash('sha256').update(body).digest('hex');
const repo=new URL('../',import.meta.url),read=path=>readFile(new URL(path,repo));
const urlPrefix='https://github.com/itsdanielsultan/future-mississauga/releases/download/';
const stamp='2026-11-13T08:00:00.000Z';

async function fixture(t,{kinds=['coverage','east-credit']}={}){
 const stage=await mkdtemp(join(tmpdir(),'release-image-test-'));t.after(()=>rm(stage,{recursive:true,force:true}));
 const evidenceRoot=join(stage,'proof-evidence'),proofPath=join(stage,'proof.json');await mkdir(evidenceRoot);await mkdir(join(stage,'data'));
 await writeFile(join(stage,'asset-delivery-map.js'),await read('public/asset-delivery-map.js'));
 const map=[],manifests=[],manifestPins=[],evidence=[],proof={schema:'future-mississauga-release-image-delivery-proof/v1',batches:[]},bodies=new Map();
 for(const [index,kind] of kinds.entries()){
  const tag='neighbourhood-images-2026-11-13-test-'+kind,targetCommit='a'.repeat(40),adoption=index===0?'b'.repeat(64):null;
  const entry={identity:'wide/test-'+kind+'.png',renderTimestampUTC:stamp,caption:{sourceDates:'Original source dates retained',fullCredits:['Test fixture creator','Test fixture source']},sourceSceneSHA256:'c'.repeat(64),provenance:{deliveryManifest:{sha256:'d'.repeat(64)},...(adoption?{sourceAdoption:{sha256:'1'.repeat(64),bytes:1234}}:{})},finalSourceAdoption:adoption?{sha256:adoption}:null,responsivePreviews:[]};
  const direct=kind==='downtown';
  if(direct){entry.identity='portraits/test-downtown.png';entry.sourceFreezeState='FINAL_FROZEN';entry.provenance=Object.fromEntries(['sceneProof','creditProof','renderProof','sourceRevision','importProof','nativeInventory','compositionProof','packageScript','footerScript','packageContract'].map(key=>[key,{sha256:'d'.repeat(64)}]));}
  const assets=[];
  for(const role of ['displayMaster','download']){
   const body=Buffer.from('Synthetic test-only remote image bytes: '+kind+' '+role),hash=sha(body);
   const path=(direct?'gallery/refreshed-20261113-v2/':'gallery/missing-areas-20261113/')+'test-'+kind+'-'+role+'-'+hash.slice(0,12)+'.png';bodies.set(path,body);
   const row={path,url:urlPrefix+tag+'/'+basename(path),sha256:hash,bytes:body.length,mimeType:'image/png',width:2,height:1};map.push(row);assets.push(row);
   entry[role]={role:role==='displayMaster'?'cleanNativeScene':index===0||direct?'nativeSceneOnExpandedWhiteCanvas':'nativeSceneWithAppendedCreditFooter',url:path,sha256:hash,bytes:body.length,mimeType:'image/png',dimensions:[2,1]};
  }
  const manifest={...(direct?{schema:'future-mississauga-native-media-catalog/v2'}:{}),sourcePackageSHA256:'f'.repeat(64),images:[entry],...(adoption?{finalFrozenAdoptionSHA256:adoption}:{})},path='data/'+kind+'-media-20261113.json',bytes=JSON.stringify(manifest);
  manifests.push({path,manifest});manifestPins.push({path,sha256:sha(bytes),...(direct?{kind:'native-media-catalog/v2',sourcePackageSHA256:manifest.sourcePackageSHA256}:{})});await writeFile(join(stage,path),bytes);
  const publicProof={schema:'future-mississauga-coverage-public-byte-proof/v1',tag,targetCommit,planSHA256:'e'.repeat(64),sourceMediaManifestSHA256:sha(bytes),sourcePackageSHA256:manifest.sourcePackageSHA256,finalFrozenAdoptionSHA256:adoption,...(direct?{sourceManifestKind:'native-media-catalog/v2'}:{}),publicHashesVerified:assets.length,publicDimensionsVerified:assets.length,assets:assets.map(row=>({...row,path:undefined,logicalURL:row.path,file:basename(row.path),sourceSceneSHA256:entry.sourceSceneSHA256,sourceManifestSHA256:direct?sha(bytes):entry.provenance.deliveryManifest.sha256,...(direct?{sourceManifestKind:'native-media-catalog/v2',sourceProofs:entry.provenance,sourceFreezeState:'FINAL_FROZEN'}:{}),sourceAdoptionSHA256:adoption?'1'.repeat(64):null,nativeSourceSHA256:entry.displayMaster.sha256,role:row.path.includes('-displayMaster-')?'cleanNativeScene':index===0?'nativeSceneOnTrue4x5WhiteCanvas':direct?'nativeSceneOnExpandedWhiteCanvas':'nativeSceneWithAppendedCreditFooter',renderTimestampUTC:entry.renderTimestampUTC,sourceDates:entry.caption.sourceDates,credits:entry.caption.fullCredits,providerDigest:'sha256:'+row.sha256,decodedMimeType:row.mimeType,decodedFormat:'PNG',decodedWidth:row.width,decodedHeight:row.height,providerMimeType:row.mimeType,httpContentType:row.mimeType,published:true,publicHTTPVerified:true,publicDimensionsVerified:true,status:200,verifiedAt:stamp,completeBodyHashed:true}))};
  evidence.push(publicProof);proof.batches.push({tag,targetCommit,planSHA256:'e'.repeat(64),publicVerificationSHA256:'',files:assets.map(row=>({...row,status:200,verifiedAt:stamp,completeBodyHashed:true}))});
 }
 const options={proofPath,evidenceRoot,manifestPins};
 const save=async()=>{
  for(let i=0;i<evidence.length;i++){const bytes=JSON.stringify(evidence[i]);proof.batches[i].publicVerificationSHA256=sha(bytes);await writeFile(join(evidenceRoot,sha(bytes)+'.json'),bytes);}
  await writeFile(proofPath,JSON.stringify(proof));
  await writeFile(join(stage,'release-asset-map.js'),'// Exact verified image destinations.\nexport const releaseImageAssets = Object.freeze('+JSON.stringify(map)+');\n');
 };
 const local=async(paths=map.map(row=>row.path))=>{for(const path of paths){await mkdir(dirname(join(stage,path)),{recursive:true});await writeFile(join(stage,path),bodies.get(path));}};
 const retained=async()=>{for(const row of map)await access(join(stage,row.path));};
 await save();return {stage,evidenceRoot,proofPath,map,proof,evidence,options,manifests,bodies,save,local,retained};
}

test('current image publication pins require all 144 binaries across four independently frozen manifests',async()=>{
 assert.deepEqual(releaseImageManifestPins.map(pin=>pin.path),['data/coverage-media-20261113.json','data/east-credit-media-20261113.json','data/meadowvale-media-20261113.json','data/downtown-current-media-20261113.json']);
 for(const pin of releaseImageManifestPins)assert.equal(sha(await read('public/'+pin.path)),pin.sha256,pin.path);
 assert.equal(releaseImageManifestPins[1].sha256,'e1ee0fc1e6f4e64addd780b1ee29e550cf65acf683a98b10c042ef7d671ba614');
 assert.equal(releaseImageManifestPins[2].sha256,'ccc8d432770d6bd5e2ffbbf0c7835b1a59aa3ff28d3fbe87e08114bfc53b2702');
 assert.equal(releaseImageManifestPins[3].sha256,'20719b18cf14a8b4f1443d167310e8386935de8f63facb0b6249f73e626b9e74');
 assert.equal(releaseImageManifestPins[3].sourcePackageSHA256,'a9f1b0a129d485b0737cb889d1e2cc022cdaba43f56db22cfc8733debb46cb32');
 const manifests=await Promise.all(releaseImageManifestPins.map(async pin=>JSON.parse(await read('public/'+pin.path))));
 assert.deepEqual(manifests.map(manifest=>manifest.images.length),[6,2,2,14]);
 const assets=manifests.flatMap(manifest=>manifest.images.flatMap(row=>[row.displayMaster,row.download,...row.responsivePreviews]));
 assert.equal(assets.length,144);assert.equal(new Set(assets.map(asset=>asset.url)).size,144);
 assert.equal(assets.reduce((total,asset)=>total+asset.bytes,0),856339060);
 assert.equal(manifests[2].sourcePackageSHA256,'6684467eb06f7fcbf8722aa34f36600c62a687bf5674b9c536d51e293ad4e394');
 for(const row of manifests[2].images){assert.equal(row.sourceFreezeState,'FINAL_FROZEN');assert.equal(row.finalSourceAdoption,null);assert.equal(row.provenance.sourceAdoption,undefined);}

});

test('two verified immutable batches work without copying any image into the publication stage',async t=>{
 const f=await fixture(t),result=await offloadReleaseImages(f.stage,f.options);
 assert.equal(result.images,4);assert.equal(result.batches,2);assert.equal(result.removedStagedCopies,0);assert.equal(result.historicalCDNAssetsPreserved,290);
 assert.equal(result.state,'PUBLIC_BODY_PROOF_VERIFIED');assert.equal(result.sourceFilesRetained,true);
 assert.equal(sha(await readFile(join(f.stage,'asset-delivery-map.js'))),'77f914fef1dc1093514868caf75c45b53d430d8bf3a952c36b59d32be1e951ad');
 assert.deepEqual(JSON.parse(await readFile(join(f.stage,'data/release-image-delivery.json'))),result);
});

test('a third independently pinned manifest cannot publish until its own full-body batch is complete',async t=>{
 const f=await fixture(t,{kinds:['coverage','east-credit','meadowvale']});
 assert.equal((await validateReleaseImageDelivery(f.stage,f.options)).images,6);
 assert.equal((await validateReleaseImageDelivery(f.stage,f.options)).batches,3);
 await f.local();
 // A successful first two batches cannot stand in for the third batch.
 const third=f.proof.batches.pop(),thirdEvidence=f.evidence.pop();await f.save();
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Every release image must have a successful full-body public proof/);
 await f.retained();
 f.proof.batches.push(third);f.evidence.push(thirdEvidence);await f.save();
 f.evidence[2].assets[0].sourceSceneSHA256=f.evidence[0].assets[0].sourceSceneSHA256.replace(/^c/,'d');await f.save();
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Public proof source pin differs: sourceSceneSHA256/);
 await f.retained();
});

test('Downtown fourth batch retains the actual catalogue provenance and expanded portrait role',async t=>{
 const f=await fixture(t,{kinds:['coverage','east-credit','meadowvale','downtown']});
 const result=await validateReleaseImageDelivery(f.stage,f.options);assert.equal(result.images,8);assert.equal(result.batches,4);
 assert.equal(f.evidence[3].assets[1].role,'nativeSceneOnExpandedWhiteCanvas');
 await f.local();f.evidence[3].assets[0].sourceProofs={...f.evidence[3].assets[0].sourceProofs,sceneProof:{sha256:'0'.repeat(64)}};await f.save();
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Public direct-source proof differs: sourceProofs/);await f.retained();
});

for(const [name,mutate,pattern] of [
 ['invented delivery manifest',f=>f.evidence[3].assets[0].sourceManifestSHA256='0'.repeat(64),/Public proof source pin differs: sourceManifestSHA256/],
 ['invented source adoption',f=>f.evidence[3].assets[0].sourceAdoptionSHA256='0'.repeat(64),/Public proof source pin differs: sourceAdoptionSHA256/],
 ['wrong source contract kind',f=>f.evidence[3].sourceManifestKind='delivery-manifest',/Batch direct-source contract differs/],
 ['wrong final freeze state',f=>f.evidence[3].assets[0].sourceFreezeState='DRAFT',/Public direct-source proof differs: sourceFreezeState/],
 ['raw role substituted for actual public role',f=>f.evidence[3].assets[1].role='nativeSceneOnTrue4x5WhiteCanvas',/Public proof source pin differs: role/]
])test('Downtown source projection rejects '+name,async t=>{
 const f=await fixture(t,{kinds:['coverage','east-credit','meadowvale','downtown']});mutate(f);await f.save();
 await assert.rejects(validateReleaseImageDelivery(f.stage,f.options),pattern);
});

test('observed UTC ISO timestamps with offsets are retained exactly',async t=>{
 const f=await fixture(t);
 for(let i=0;i<f.proof.batches.length;i++)for(let j=0;j<f.proof.batches[i].files.length;j++){
  const observed='2026-11-13T08:00:00.123456+00:00';f.proof.batches[i].files[j].verifiedAt=observed;f.evidence[i].assets[j].verifiedAt=observed;
 }
 await f.save();assert.equal((await validateReleaseImageDelivery(f.stage,f.options)).images,4);
});

test('generic download transport MIME is accepted only with exact decoded and provider image formats',async t=>{
 const f=await fixture(t);
 for(const batch of f.evidence)for(const asset of batch.assets)asset.httpContentType='application/octet-stream';
 await f.save();assert.equal((await validateReleaseImageDelivery(f.stage,f.options)).images,4);
});

test('optional exact staged copies are removed only after complete public verification',async t=>{
 const f=await fixture(t);await f.local();const result=await offloadReleaseImages(f.stage,f.options);assert.equal(result.removedStagedCopies,4);
 for(const row of f.map)await assert.rejects(access(join(f.stage,row.path)),{code:'ENOENT'});
});

test('an empty pending map cannot publish accepted local preview rows',async t=>{
 const f=await fixture(t);f.map.splice(0);await f.save();await assert.rejects(validateReleaseImageDelivery(f.stage,f.options),/must cover every current approved image/);
});

for(const [name,mutate,pattern] of [
 ['partial release map',f=>f.map.pop(),/must cover every current approved image/],
 ['duplicate logical path',f=>f.map[1]={...f.map[0]},/Duplicate release path/],
 ['unapproved historical path',f=>f.map[0].path='gallery/native-20261102/historical.png',/Only approved additive image paths/],
 ['changed SHA',f=>f.map[0].sha256='0'.repeat(64),/exact SHA prefix/],
 ['changed bytes',f=>f.map[0].bytes++,/differs from the approved image/],
 ['changed dimensions',f=>f.map[0].width++,/differs from the approved image/],
 ['wrong MIME',f=>f.map[0].mimeType='image/jpeg',/image\/png/],
 ['mutable GitHub branch URL',f=>f.map[0].url='https://github.com/itsdanielsultan/future-mississauga/blob/main/'+basename(f.map[0].path),/Expected values/],
 ['changed release filename',f=>f.map[0].url+='?download=1',/Expected values/],
 ['historical release tag',f=>f.map[0].url=f.map[0].url.replace('neighbourhood-images-2026-11-13-test-coverage','pictures-native-2026-11-02'),/Unexpected image release tag/],
 ['missing batch body proof',f=>f.proof.batches[0].files.pop(),/Expected values/],
 ['partial HTTP response',f=>f.proof.batches[0].files[0].status=206,/Full public image response must be 200/],
 ['unhashed full body',f=>f.proof.batches[0].files[0].completeBodyHashed=false,/Complete remote body hashing is required/],
 ['missing observation timestamp',f=>f.proof.batches[0].files[0].verifiedAt=null,/Missing observed/],
 ['duplicate batch',f=>f.proof.batches.push(f.proof.batches[0]),/Duplicate release batch/],
 ['changed independent body hash',f=>f.evidence[0].assets[0].sha256='0'.repeat(64),/Public body evidence differs/],
 ['unverified HTTP body',f=>f.evidence[0].assets[0].publicHTTPVerified=false,/false !== true/],
 ['missing decoded MIME',f=>delete f.evidence[0].assets[0].decodedMimeType,/Decoded image MIME/],
 ['incorrect decoded MIME',f=>f.evidence[0].assets[0].decodedMimeType='image/jpeg',/Decoded image MIME/],
 ['incorrect decoded format',f=>f.evidence[0].assets[0].decodedFormat='JPEG',/Decoded image format/],
 ['missing decoded width',f=>delete f.evidence[0].assets[0].decodedWidth,/Decoded image width/],
 ['incorrect decoded dimensions',f=>f.evidence[0].assets[0].decodedHeight++,/Decoded image height/],
 ['missing provider MIME',f=>delete f.evidence[0].assets[0].providerMimeType,/Provider image MIME/],
 ['incorrect provider MIME',f=>f.evidence[0].assets[0].providerMimeType='application/octet-stream',/Provider image MIME/],
 ['missing transport MIME',f=>delete f.evidence[0].assets[0].httpContentType,/Unexpected public image transport MIME/],
 ['HTML transport MIME',f=>f.evidence[0].assets[0].httpContentType='text/html',/Unexpected public image transport MIME/],
 ['incorrect image transport MIME',f=>f.evidence[0].assets[0].httpContentType='image/jpeg',/Unexpected public image transport MIME/],
 ['changed source package',f=>f.evidence[0].sourcePackageSHA256='0'.repeat(64),/manifest\/package pin differs/],
 ['changed approved media manifest',f=>f.evidence[0].sourceMediaManifestSHA256='0'.repeat(64),/manifest\/package pin differs/],
 ['global adoption substituted for raw source adoption',f=>f.evidence[0].assets[0].sourceAdoptionSHA256='b'.repeat(64),/source pin differs/],
 ['normalized public role substituted for original canvas role',f=>f.evidence[0].assets[1].role='nativeSceneOnExpandedWhiteCanvas',/source pin differs/],
 ['changed source scene',f=>f.evidence[0].assets[0].sourceSceneSHA256='0'.repeat(64),/source pin differs/],
 ['changed source manifest',f=>f.evidence[0].assets[0].sourceManifestSHA256='0'.repeat(64),/source pin differs/],
 ['changed clean master for derivative',f=>f.evidence[0].assets[1].nativeSourceSHA256='0'.repeat(64),/source pin differs/],
 ['missing final adoption',f=>f.evidence[0].finalFrozenAdoptionSHA256=null,/Batch adoption pin differs/],
 ['invented East Credit adoption',f=>f.evidence[1].assets[0].sourceAdoptionSHA256='b'.repeat(64),/source pin differs/],
 ['changed source credits',f=>f.evidence[0].assets[0].credits=[],/source pin differs/],
 ['changed render date',f=>f.evidence[0].assets[0].renderTimestampUTC='2026-11-14T00:00:00Z',/source pin differs/],
 ['private source path in evidence',f=>f.evidence[0].assets[0].sourcePath='/Users/private/example.png',/must not contain private source paths/]
])test('publication rejects '+name+' before removing any staged image',async t=>{
 const f=await fixture(t);await f.local();const originalPaths=f.map.map(row=>row.path);mutate(f);await f.save();
 await assert.rejects(offloadReleaseImages(f.stage,f.options),pattern);
 for(const path of originalPaths)await access(join(f.stage,path));
});

test('changed approved manifest, tampered evidence bytes and a missing proof all fail closed',async t=>{
 const f=await fixture(t);await f.local();
 const manifestPath=join(f.stage,f.manifests[0].path),original=await readFile(manifestPath);await writeFile(manifestPath,original+' ');
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Current image manifest changed/);await f.retained();await writeFile(manifestPath,original);
 const evidencePath=join(f.evidenceRoot,f.proof.batches[0].publicVerificationSHA256+'.json');await writeFile(evidencePath,'{}');
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Public verification artifact changed/);await f.retained();await f.save();await rm(f.proofPath);
 await assert.rejects(offloadReleaseImages(f.stage,f.options),{code:'ENOENT'});await f.retained();
});

test('one corrupt optional local copy prevents removal of all other exact staged copies',async t=>{
 const f=await fixture(t);await f.local();await writeFile(join(f.stage,f.map.at(-1).path),'corrupt');
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/Staged release image size changed/);await f.retained();
});

test('image paths cannot traverse a symlink out of the isolated stage',async t=>{
 const f=await fixture(t),external=await mkdtemp(join(tmpdir(),'release-images-outside-'));t.after(()=>rm(external,{recursive:true,force:true}));
 await symlink(external,join(f.stage,'gallery'));await assert.rejects(offloadReleaseImages(f.stage,f.options),/symbolic links/);
});

test('executable map additions and changed historical CDN bindings are rejected',async t=>{
 const f=await fixture(t);await f.local();await writeFile(join(f.stage,'release-asset-map.js'),'export const releaseImageAssets = Object.freeze('+JSON.stringify(f.map)+');\nthrow Error("not a static map");');
 await assert.rejects(offloadReleaseImages(f.stage,f.options),/cannot contain executable additions/);await f.retained();await f.save();
 await writeFile(join(f.stage,'asset-delivery-map.js'),'changed');await assert.rejects(offloadReleaseImages(f.stage,f.options),/historical CDN map changed/);await f.retained();
});

test('build and publication checks require release-body validation before the final CDN offload and size gate',async()=>{
 for(const file of ['scripts/build.mjs','scripts/check-publication.mjs']){
  const text=(await read(file)).toString();assert(text.includes("import {offloadReleaseImages,validateReleaseImageDelivery} from './release-image-delivery.mjs'"));
  assert(text.indexOf('await validateReleaseImageDelivery(')<text.indexOf('await preparePublication(stage)'));
  assert(text.indexOf('await offloadReleaseImages(stage)')>text.indexOf('await validatePublicationDerivatives(stage)'));
  assert(text.indexOf('await offloadReleaseImages(stage)')<text.indexOf('await offloadValidatedAssets(stage)'));
  assert(text.includes('releaseImageDelivery'));
 }
});
