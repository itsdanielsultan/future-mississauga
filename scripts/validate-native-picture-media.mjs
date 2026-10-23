// DRAFT build-time validator only. Root copies into isolated scripts/ on apply.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const repo='https://github.com/itsdanielsultan/future-mississauga/releases/download/';
const retainedWide=new Set(['citywide-future.png','clarkson-future.png','clarkson-skyline-future.png','clarkson-portrait-future.png']);
const retainedPortraits=new Set(['clarkson-future.png','clarkson-portrait-future.png']);
const load=async(site,name)=>JSON.parse(await readFile(join(site,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function sameBaselineRecord(actual,baseline,name){
  // All previous fields, including the complete nested display record, survive.
  for(const[k,v]of Object.entries(baseline))assert.deepEqual(actual[k],v,'Retained field changed: '+name+':'+k);
  assert.equal(actual.renderInfo.state,'retained-earlier');
  assert.equal(actual.renderInfo.renderDate,name==='citywide-future.png'?'2026-10-04':'2026-09-29');
  assert.equal(actual.renderInfo.edition,'Visual Polish 2026-09-26');
  assert(actual.renderInfo.label.startsWith('Earlier render · '));
}
function verifyProof(proof,image,url,newlyVerified){
  assert(proof?.publicHTTPVerified,'Missing independent public byte evidence');
  for(const k of['bytes','sha256','width','height'])assert.equal(proof[k],image[k],'Proof differs:'+k);
  assert.equal(proof.url||proof.browser_download_url,url);
  assert.equal(proof.githubDigest||proof.providerDigest,'sha256:'+image.sha256);
  assert.equal(proof.newlyVerified,newlyVerified);
  assert(proof.verificationDate,'Individual verification date is required');
}
async function checkPreview(site,image,name){
  const p=image.display;assert(p);
  assert.equal(p.url,`gallery/previews/${image.sha256.slice(0,16)}/${name}`);
  assert.equal(p.sourceSHA256,image.sha256);assert.equal(p.scale,.5);
  assert.equal(p.width,image.width/2);assert.equal(p.height,image.height/2);
  const path=join(site,p.url);assert.equal((await stat(path)).size,p.bytes);
  const b=await readFile(path);assert.equal(sha(b),p.sha256);
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16),p.width);assert.equal(b.readUInt32BE(20),p.height);
}
export async function validatePictureMedia(site){
  const pictures=await load(site,'data/picture-assets.json');
  const social=await load(site,'data/social-pictures.json');
  const previous=await load(site,'data/history/picture-assets-before-partial-refresh.json');
  const oldSocial=await load(site,'data/history/social-pictures-before-partial-refresh.json');
  const wi=await load(site,'data/original-image-release-integrity.json');
  const si=await load(site,'data/portrait-release-integrity.json');
  const oldWI=await load(site,'data/history/original-image-release-integrity-before-partial-refresh.json');
  const oldSI=await load(site,'data/history/portrait-release-integrity-before-partial-refresh.json');
  const entries=Object.entries(pictures.images||{});assert.equal(entries.length,33);
  assert.deepEqual(entries.map(([n])=>n),Object.keys(previous.images));
  assert.equal(pictures.mixedRenderDates,true);assert.equal(pictures.renderDate,null);
  assert.equal(wi.publicHashesVerified,33);assert.equal(wi.newPublicHashesVerified,29);assert.equal(wi.retainedHistoricalPublicHashesVerified,4);
  assert.equal(new Set(wi.assets.map(a=>a.file)).size,33);
  let refreshedWide=0,retainedWideCount=0;
  for(const[name,picture]of entries){
    assert.match(picture.sha256,/^[a-f0-9]{64}$/);
    const proof=wi.assets.find(a=>a.file===name&&a.group==='gallery');
    if(retainedWide.has(name)){
      const baseline=previous.images[name];sameBaselineRecord(picture,baseline,name);
      const oldProof=oldWI.assets.find(a=>a.file===name&&a.group==='gallery');
      for(const k of['bytes','sha256','width','height'])assert.equal(proof[k],oldProof[k]);
      verifyProof(proof,picture,baseline.url,false);retainedWideCount++;
    }else{
      assert.equal(picture.width,6144);assert([2240,3840].includes(picture.height));
      assert.equal(picture.url,repo+wi.tag+'/'+name);assert.equal(picture.renderInfo.state,'refreshed');
      assert.equal(picture.renderInfo.edition,pictures.refreshedEdition);
      assert.match(picture.renderInfo.renderDate,/^\d{4}-\d{2}-\d{2}$/);
      verifyProof(proof,picture,picture.url,true);refreshedWide++;
    }
    await checkPreview(site,picture,name);
  }
  assert.equal(refreshedWide,29);assert.equal(retainedWideCount,4);
  assert.equal(social.nativePortraitRendering,true);assert.equal(social.ratio,'4:5');assert.equal(social.images.length,24);
  assert.deepEqual(social.images.map(i=>i.file),oldSocial.images.map(i=>i.file));
  assert.equal(social.mixedRenderDates,true);assert.equal(social.renderDate,null);
  assert.equal(si.publicHashesVerified,48);assert.equal(si.newPublicHashesVerified,44);assert.equal(si.retainedHistoricalPublicHashesVerified,4);
  assert.equal(new Set(si.assets.map(a=>a.file)).size,48);
  const page=await readFile(join(site,'social.html'),'utf8');let refreshedPortraits=0,retainedPortraitCount=0;
  for(const image of social.images){
    assert.equal(image.width,3240);assert.equal(image.height,4050);assert.equal(image.previewWidth,1620);assert.equal(image.previewHeight,2025);
    const masterProof=si.assets.find(a=>a.file===image.file),previewProof=si.assets.find(a=>a.file==='display-'+image.file);
    const keep=retainedPortraits.has(image.file);const baseline=oldSocial.images.find(i=>i.file===image.file);
    if(keep){
      sameBaselineRecord(image,baseline,image.file);
      const oldMaster=oldSI.assets.find(a=>a.file===image.file),oldPreview=oldSI.assets.find(a=>a.file==='display-'+image.file);
      assert.equal(masterProof.sha256,oldMaster.sha256);assert.equal(previewProof.sha256,oldPreview.sha256);
      assert(page.includes(image.renderInfo.label),'Earlier portrait label is not visible');retainedPortraitCount++;
    }else{
      assert.equal(image.url,repo+si.tag+'/'+image.file);assert.equal(image.preview,repo+si.tag+'/display-'+image.file);
      assert.equal(image.renderInfo.state,'refreshed');refreshedPortraits++;
    }
    verifyProof(masterProof,image,image.url,!keep);
    verifyProof(previewProof,{bytes:image.previewBytes,sha256:image.previewSHA256,width:1620,height:2025},image.preview,!keep);
    assert.equal(page.split('href="'+image.url+'"').length-1,2);
    assert(page.includes('src="'+image.preview+'"'));
  }
  assert.equal(refreshedPortraits,22);assert.equal(retainedPortraitCount,2);
  const home=await readFile(join(site,'index.html'),'utf8');assert(home.includes('51 new pictures'));
  assert(home.includes('six earlier Citywide and Clarkson future views'));
  return {entries,originalImageVerification:{localOriginals:0,remoteOriginals:33,newPublicHashesVerified:29,retainedHistoricalProofs:4,separatePublicHashProofRequired:true,remoteBytesFetchedByThisStaticCheck:false},portraitGallery:{nativePortraitRecords:24,newPortraitMasters:22,retainedEarlierPortraits:2,remoteHalfSizePreviews:24,dimensionsVerified:true,remoteDownloadSHA256Recorded:24,remoteDownloadBytesVerifiedByThisStaticCheck:false,separatePublicHashProofRequired:true,mixedRenderDates:true}};
}
