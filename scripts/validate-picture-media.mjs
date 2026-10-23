// Build-time media checks; public byte downloads are proved separately by the publisher.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const load=async(site,name)=>JSON.parse(await readFile(join(site,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const repo='https://github.com/itsdanielsultan/future-mississauga/releases/download/';
function verify(proof,row,url){
 assert(proof?.publicHTTPVerified&&proof.published,'Missing actual public proof');
 for(const key of ['bytes','sha256','width','height'])assert.equal(proof[key],row[key]);
 assert.equal(proof.url,url);assert.equal(proof.githubDigest,'sha256:'+row.sha256);
}
async function preview(site,row,file){
 const p=row.display;assert.equal(p.url,`gallery/previews/${row.sha256.slice(0,16)}/${file}`);
 assert.equal(p.sourceSHA256,row.sha256);const scale=row.presentationInfo ? .45 : .5;assert.equal(p.width,Math.round(row.width*scale));assert.equal(p.height,Math.round(row.height*scale));assert.equal(p.scale,scale);
 const bytes=await readFile(join(site,p.url));assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),p.width);assert.equal(bytes.readUInt32BE(20),p.height);
}
function presentation(row,baseline){
 assert.deepEqual(row.nativeOriginal,baseline);assert.deepEqual(row.renderInfo,baseline.renderInfo);
 assert.equal(row.presentationInfo.date,'2026-10-22');assert.equal(row.presentationInfo.newGeometryOrMaterials,false);
 assert.equal(row.presentationInfo.creator,'Daniel Sultan');assert.equal(row.presentationInfo.statusKey[2].label,'Proposed / approved');
 assert.equal(row.presentationInfo.north.worldNorthModelXYZ.join(','),'0,0,-1');
 const v=row.presentationInfo.north.screenUnitRightDown;assert(Math.abs(Math.hypot(...v)-1)<1e-9);
}
export async function validatePictureMedia(site){
 const pictures=await load(site,'data/picture-assets.json'),social=await load(site,'data/social-pictures.json');
 if(!pictures.presentationDerivativeCount){const native=await import('./validate-native-picture-media.mjs');return native.validatePictureMedia(site);}
 const before=await load(site,'data/history/picture-assets-before-presentation-2026-10-22.json');
 const oldSocial=await load(site,'data/history/social-pictures-before-presentation-2026-10-22.json');
 const wide=await load(site,'data/presentation-wide-release-integrity.json'),portraits=await load(site,'data/presentation-portraits-release-integrity.json');
 for(const p of[wide,portraits]){assert.equal(p.schema,'future-mississauga-presentation-public-byte-proof/v1');assert(p.checkedAt);assert.equal(p.targetCommit,'8d6d8c92cb565d4a495fdf6b1a4a1a3c24c5b2b6');assert.equal(p.publicHashesVerified,p.assets.length);}
 assert.equal(wide.assets.length,29);assert.equal(portraits.assets.length,44);assert.equal(pictures.originalPixels,false);
 const entries=Object.entries(pictures.images);assert.equal(entries.length,33);assert.deepEqual(Object.keys(pictures.images),Object.keys(before.images));
 let wc=0,wr=0,pc=0,pr=0;
 for(const[file,row]of entries){
  if(row.presentationInfo){presentation(row,before.images[file]);assert.equal(row.url,repo+wide.tag+'/'+file);const proof=wide.assets.find(a=>a.file===file);verify(proof,row,row.url);assert.equal(proof.nativeSourceSHA256,row.nativeOriginal.sha256);wc++;}
  else{assert.deepEqual(row,before.images[file]);assert.equal(row.renderInfo.state,'retained-earlier');wr++;}
  await preview(site,row,file);
 }
 assert.equal(wc,29);assert.equal(wr,4);assert.equal(social.images.length,24);assert.equal(social.nativePortraitRendering,true);
 assert.deepEqual(social.images.map(r=>r.file),oldSocial.images.map(r=>r.file));
 const page=await readFile(join(site,'social.html'),'utf8');
 for(const row of social.images){
  const old=oldSocial.images.find(r=>r.file===row.file);assert.equal(row.width,3240);assert.equal(row.height,4050);assert.equal(row.previewWidth,1620);assert.equal(row.previewHeight,2025);
  if(row.presentationInfo){presentation(row,old);assert.equal(row.url,repo+portraits.tag+'/'+row.file);assert.equal(row.preview,repo+portraits.tag+'/display-'+row.file);verify(portraits.assets.find(r=>r.file===row.file),row,row.url);verify(portraits.assets.find(r=>r.file==='display-'+row.file),{bytes:row.previewBytes,sha256:row.previewSHA256,width:row.previewWidth,height:row.previewHeight},row.preview);pc++;}
  else{assert.deepEqual(row,old);pr++;}
  assert.equal(page.split('href="'+row.url+'"').length-1,2);assert(page.includes('src="'+row.preview+'"'));
 }
 assert.equal(pc,22);assert.equal(pr,2);
 const ix=await load(site,'downloads/Picture-index.json');assert.equal(ix.images.length,57);assert.equal(ix.presentationDerivativeCount,51);
 for(const r of ix.images){const row=r.kind==='wide'?pictures.images[r.file]:social.images.find(p=>p.file===r.file);assert.equal(r.sha256,row.sha256);assert.deepEqual(r.renderInfo,row.renderInfo);if(r.presentationInfo)assert.deepEqual(r.nativeOriginal,row.nativeOriginal);}
 const sources=await load(site,'data/presentation-sources.json');assert.equal(sources.images.length,51);assert(sources.images.every(r=>r.sourceAttribution.creditLines.length>=3));
 const home=await readFile(join(site,'index.html'),'utf8');assert(home.includes('51 presentation copies'));assert(home.includes('six earlier Citywide and Clarkson future views'));
 return {entries,originalImageVerification:{localOriginals:0,remoteOriginals:4,remotePresentationDerivatives:29,presentationDerivatives:29,retainedHistoricalProofs:4,separatePublicHashProofRequired:true,remoteBytesFetchedByThisStaticCheck:false},portraitGallery:{nativePortraitRecords:24,presentationDerivatives:22,retainedEarlierPortraits:2,remoteHalfSizePreviews:24,dimensionsVerified:true,remoteDownloadSHA256Recorded:24,remoteDownloadBytesVerifiedByThisStaticCheck:false,separatePublicHashProofRequired:true,mixedRenderDates:true},displayPreviewSummary:{totalWide:33,nominal45Percent:29,halfSize:4},presentation:{images:51,publicAssets:73,originalRenderDatesPreserved:true,nativeMasterURLsPreserved:true}};
}
