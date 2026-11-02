// Media lineage and actual local preview bytes are checked here. The publisher supplies
// separately fetched public PNG hashes; a local build never invents remote verification.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeCleanMedia,imageAttribution,mediaScenarioLabel} from '../public/clean-media.js';
const load=async(site,name)=>JSON.parse(await readFile(join(site,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const target='f72cbaaa6760b0f2b64de449f189d80bb80731c2';
const assetKey=a=>a.kind+'/'+a.file;
const sourceClear=new Set(['wide/erin-mills-future.png','wide/streetsville-future.png','wide/meadowvale-future.png','wide/dixie-applewood-future.png','wide/erindale-future.png','wide/clarkson-existing.png','portraits/erin-mills-future.png','portraits/streetsville-future.png','portraits/clarkson-existing.png']);
function avifSize(bytes){
 assert.equal(bytes.toString('ascii',4,8),'ftyp');
 assert(bytes.subarray(8,40).includes(Buffer.from('avif')),'AVIF brand is missing');
 const sizes=[];
 function boxes(start,end){
  for(let p=start;p+8<=end;){
   let n=bytes.readUInt32BE(p),head=8;const name=bytes.toString('ascii',p+4,p+8);
   if(n===1){n=Number(bytes.readBigUInt64BE(p+8));head=16;}
   if(n===0)n=end-p;assert(n>=head&&p+n<=end,'Malformed AVIF box');
   if(name==='ispe'){assert(n>=20);sizes.push([bytes.readUInt32BE(p+12),bytes.readUInt32BE(p+16)]);}
   if(['meta','iprp','ipco'].includes(name))boxes(p+head+(name==='meta'?4:0),p+n);
   p+=n;
  }
 }
 boxes(0,bytes.length);assert(sizes.length,'AVIF spatial extent missing');
 assert(sizes.every(s=>s.join(',')===sizes[0].join(',')),'Unexpected AVIF image extents');return sizes[0];
}
function publicProof(proof,a){
 assert(proof?.publicHTTPVerified&&proof.published,'Missing fetched public asset proof: '+assetKey(a));
 for(const key of ['bytes','sha256','width','height'])assert.equal(proof[key],a[key],assetKey(a)+' '+key);
 assert.equal(proof.url,a.url);assert.equal(proof.githubDigest,'sha256:'+a.sha256);
}
function jpegSize(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8);let p=2;
 while(p<bytes.length){assert.equal(bytes[p++],0xff);while(bytes[p]===0xff)p++;const marker=bytes[p++];if(marker===0xd9||marker===0xda)break;const n=bytes.readUInt16BE(p);assert(n>=2&&p+n<=bytes.length);if([0xc0,0xc1,0xc2].includes(marker))return[bytes.readUInt16BE(p+5),bytes.readUInt16BE(p+3)];p+=n;}
 throw new Error('JPEG image dimensions missing');
}
async function preview(site,p,source){
 assert.equal(p.format,'image/avif');assert.equal(p.sourceSHA256,source.sha256);
 assert(p.url.startsWith('gallery/refined-previews/'));assert(!p.url.includes('..'));
 const bytes=await readFile(join(site,p.url));assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);
 assert.deepEqual(avifSize(bytes),[p.width,p.height]);
 assert.equal(p.height,Math.round(source.height*p.width/source.width));
 return bytes.length;
}
function lineage(row,old,e){
 const native=old.nativeOriginal??old;
 assert.deepEqual(row.nativeOriginal,native,'Historical native record changed: '+e.file);
 assert.equal(e.originalNativeSourceSHA256,native.sha256);assert.equal(e.originalNativeURL,native.url);
 assert.deepEqual(e.originalRenderInfo,native.renderInfo);
 assert.deepEqual(row.renderInfo,e.renderInfo);assert.deepEqual(row.sourceAttribution,e.sourceAttribution);
 assert.equal(typeof e.sourceAttribution.openStreetMap,'boolean');
 assert.equal(e.sourceAttribution.openStreetMap,!sourceClear.has(assetKey(e)),'Frozen source attribution classification changed');
 for(const k of ['width','height'])assert.equal(row[k],native[k],'Native dimensions changed');
 assert.equal(row.presentationInfo.newGeometryOrMaterials,false);assert.equal(row.presentationInfo.cameraChanged,e.newNativeRender);
 assert.equal(row.presentationInfo.creator,'Daniel Sultan');assert.equal(row.presentationInfo.statusKey[2].label,'Proposed / approved');
 assert.equal(row.presentationInfo.north.worldNorthModelXYZ.join(','),'0,0,-1');
 assert(Math.abs(Math.hypot(...row.presentationInfo.north.screenUnitRightDown)-1)<1e-9);
 assert.equal(row.presentationInfo.nativeSourceSHA256,e.nativeSourceSHA256);
 for(const k of ['sourceModelCommit','sourceEdition','sourceModelDate','sourceManifestSHA256','sourcePolicySHA256']){
  if(native.renderInfo[k]!==undefined)assert.equal(e.renderInfo[k],native.renderInfo[k],e.file+' original '+k);
 }
 if(e.newNativeRender){
  assert.equal(e.renderInfo.state,'camera-reframed');assert.equal(e.nativeSourceAsset,null);
  assert.notEqual(e.nativeSourceSHA256,e.originalNativeSourceSHA256);
  assert.equal(e.renderInfo.originalNativeRenderDate,native.renderInfo.renderDate);
  assert.equal(e.renderInfo.renderDateTimezone,'America/Toronto');assert(!Number.isNaN(Date.parse(e.renderInfo.renderTimestampUTC)));
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.renderInfo.renderTimestampUTC));
  assert.equal(e.renderInfo.renderDate,date);
 }else{
  assert.equal(e.renderInfo.renderDate,native.renderInfo.renderDate);assert.equal(e.nativeSourceSHA256,e.originalNativeSourceSHA256);assert.equal(e.nativeSourceAsset,null);
 }
 assert.equal(e.displayMaster.nativeSourceSHA256,e.nativeSourceSHA256);assert.equal(e.download.nativeSourceSHA256,e.nativeSourceSHA256);
 if(e.sourceAttribution.openStreetMap)assert.notEqual(e.displayMaster.sha256,e.download.sha256);
 else assert.equal(e.displayMaster.sha256,e.download.sha256);
}
const escapeHTML=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function validateNativeSocialCard(articles,row){
 const matching=articles.filter(card=>card.includes('data-display-url="'+escapeHTML(row.displayMaster.url)+'"'));
 assert.equal(matching.length,1,'Exactly one current Social card required: '+assetKey(row));
 const card=matching[0],links=card.match(/<a\b[^>]*>/g)??[];
 const preview=links.filter(link=>/class="image-link"/.test(link)),download=links.filter(link=>/class="save"/.test(link));
 assert.equal(preview.length,1);assert.equal(download.length,1);
 assert(preview[0].includes('href="'+escapeHTML(row.displayMaster.url)+'"'));
 assert(preview[0].includes('aria-haspopup="dialog"'));assert(!/\sdownload(?:\s|=|>)/.test(preview[0]),'Image click must preview, not download');
 assert(download[0].includes('href="'+escapeHTML(row.download.url)+'"'));assert(/\sdownload(?:\s|=|>)/.test(download[0]),'Explicit download action required');
 for(const [name,value] of Object.entries({'data-osm':row.caption.openStreetMap,'data-display-width':row.displayMaster.width,'data-display-height':row.displayMaster.height}))assert(card.includes(name+'="'+value+'"'),assetKey(row)+' '+name);
 const images=card.match(/<img\b[^>]*>/g)??[];assert.equal(images.length,1);
 for(const [name,value] of Object.entries({src:row.preview.url,width:row.preview.width,height:row.preview.height}))assert(images[0].includes(name+'="'+escapeHTML(value)+'"'),assetKey(row)+' image '+name);
 assert(card.includes('<h2>'+escapeHTML(row.title)+'</h2>'));assert(card.includes('>'+escapeHTML(mediaScenarioLabel(row))+'</span>'));
 const credit=imageAttribution(row);assert(card.includes(escapeHTML(credit.cityCredit)));
 assert.equal(card.includes('href="https://www.openstreetmap.org/copyright"'),credit.openStreetMap);
 assert.equal(card.includes('© OpenStreetMap contributors'),credit.openStreetMap);
 for(const text of credit.requiredModelCredits)assert(card.includes(escapeHTML(text)),assetKey(row)+' required model credit');
 assert(card.includes('href="'+escapeHTML(credit.sourcesURL)+'"'));
 return card;
}
export async function validateNativeSharePreviews(site,pages,row){
 const source=row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200);assert(source,'Native share JPEG source missing');
 for(const page of pages){
  const og=page.match(/<meta property="og:image" content="([^"]+)"/),twitter=page.match(/<meta name="twitter:image" content="([^"]+)"/);
  assert(og&&twitter,'Current share metadata required');assert.equal(og[1],twitter[1]);
  const local='gallery/native-share-20261102/downtown-future-'+source.sha256.slice(0,12)+'.jpg';
  assert.equal(og[1],'https://futuremississauga.com/'+local);
  const bytes=await readFile(join(site,local));assert.equal(bytes.length,source.bytes);assert.equal(sha(bytes),source.sha256);assert.deepEqual(jpegSize(bytes),[source.width,source.height]);
 }
}
export async function validateRefinedPictureStructure(site){
 const pictures=await load(site,'data/picture-assets.json');
 assert.equal(pictures.refinedMediaVersion,1);
 const social=await load(site,'data/social-pictures.json'),manifest=await load(site,'data/refined-media-manifest.json');
 const before=await load(site,'data/history/picture-assets-before-refined-2026-10-23.json'),oldSocial=await load(site,'data/history/social-pictures-before-refined-2026-10-23.json');
 assert.equal(manifest.schema,'future-mississauga-refined-public-media/v1');assert.equal(manifest.targetCommit,target);
 assert.equal(manifest.assets.length,105);assert.equal(new Set(manifest.assets.map(assetKey)).size,manifest.assets.length);
 const byAsset=new Map(manifest.assets.map(a=>[assetKey(a),a]));
 for(const a of manifest.assets){assert.equal(a.targetCommit,target);assert.equal(a.releaseTag,'pictures-refined-'+a.kind+'-2026-10-23');assert.equal(a.url,'https://github.com/itsdanielsultan/future-mississauga/releases/download/'+a.releaseTag+'/'+a.file);}
 assert.equal(manifest.entries.length,57);assert.equal(new Set(manifest.entries.map(assetKey)).size,57);
 assert.equal(Object.keys(pictures.images).length,33);assert.equal(social.images.length,24);
 assert.deepEqual(Object.keys(pictures.images),Object.keys(before.images));assert.deepEqual(social.images.map(r=>r.file),oldSocial.images.map(r=>r.file));
 assert.equal(pictures.presentationDerivativeCount,33);assert.equal(social.presentationDerivativeCount,24);assert(social.nativePortraitRendering);
 const page=await readFile(join(site,'social.html'),'utf8');const articles=page.match(/<article\b[\s\S]*?<\/article>/g)??[];assert.equal(articles.length,24);
 const current=await load(site,'data/native-media-20261102.json');
 assert.equal(current.schema,'future-mississauga-native-media-catalog/v2');
 assert((current.state==='LOCAL_STAGED_ONLY'&&current.publication===false)||(current.state==='READY_FOR_PUBLICATION'&&current.publication===true),'Native catalogue state mismatch');
 assert.deepEqual(current.images.map(row=>row.identity).sort(),manifest.entries.map(assetKey).sort(),'Current native identities must exactly cover the historical 57 logical views');
 const currentRows=current.images.map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/'));
 const currentPortraits=new Map(currentRows.filter(row=>row.kind==='portraits').map(row=>[row.file,row]));
 let totalPreviewBytes=0,newFrames=0;
 for(const e of manifest.entries){
  const row=e.kind==='wide'?pictures.images[e.file]:social.images.find(r=>r.file===e.file);
  const old=e.kind==='wide'?before.images[e.file]:oldSocial.images.find(r=>r.file===e.file);assert(row&&old);
  lineage(row,old,e);if(e.newNativeRender)newFrames++;
  assert.equal(row.url,e.download.url);assert.equal(row.sha256,e.download.sha256);assert.equal(row.bytes,e.download.bytes);assert.deepEqual(row.displayMaster,e.displayMaster);
  for(const a of [e.download,e.displayMaster,e.nativeSourceAsset].filter(Boolean))assert.deepEqual(byAsset.get(assetKey(a)),a);
  totalPreviewBytes+=await preview(site,e.preview,e.displayMaster);
  if(e.kind==='wide'){assert.deepEqual(row.display,e.preview);assert.equal(e.preview.width,1200);}
  else{
   assert.equal(row.width,3240);assert.equal(row.height,4050);assert.equal(e.preview.width,810);
   assert.equal(row.preview,e.preview.url);assert.equal(row.previewSHA256,e.preview.sha256);assert.equal(row.previewBytes,e.preview.bytes);
   assert.equal(row.previewWidth,e.preview.width);assert.equal(row.previewHeight,e.preview.height);
   const latest=currentPortraits.get(e.file);assert(latest,'Current native portrait missing: '+e.file);
   validateNativeSocialCard(articles,latest);
   for(const p of [latest.preview,latest.responsive]){
    assert(p.url.startsWith('gallery/native-20261102/')&&!p.url.includes('..'));
    const bytes=await readFile(join(site,p.url));assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);assert.deepEqual(avifSize(bytes),[p.width,p.height]);
   }
  }
 }
 assert.equal(newFrames,31);assert.equal(totalPreviewBytes,manifest.previewTotalBytes);assert(totalPreviewBytes<=6500000);
 const ix=await load(site,'downloads/Picture-index.json'),sources=await load(site,'data/presentation-sources.json');
 assert.equal(ix.images.length,57);assert.equal(ix.presentationDerivativeCount,57);assert.equal(sources.images.length,57);
 for(const r of ix.images){const row=r.kind==='wide'?pictures.images[r.file]:social.images.find(p=>p.file===r.file);assert.equal(r.sha256,row.sha256);assert.deepEqual(r.nativeOriginal,row.nativeOriginal);assert.deepEqual(r.renderInfo,row.renderInfo);}
 for(const r of sources.images){const e=manifest.entries.find(p=>p.kind===r.kind&&p.file===r.file);assert.equal(r.sourceAttribution.openStreetMap,e.sourceAttribution.openStreetMap);assert(r.sourceAttribution.creditLines.length>=3);assert(!r.sourceAttribution.creditLines.join(' ').includes('OpenStreetMap contributors'));}
 const share=manifest.sharePreview,bytes=await readFile(join(site,share.url));assert.equal(share.format,'image/jpeg');assert.equal(bytes.length,share.bytes);assert.equal(sha(bytes),share.sha256);assert.deepEqual(jpegSize(bytes),[1200,750]);
 const home=await readFile(join(site,'index.html'),'utf8');const currentShare=await load(site,'data/share-preview-20261101.json');
 const oldShare=await readFile(join(site,currentShare.url));assert.equal(oldShare.length,currentShare.bytes);assert.equal(sha(oldShare),currentShare.sha256);assert.deepEqual(jpegSize(oldShare),[currentShare.width,currentShare.height]);
 await validateNativeSharePreviews(site,[home,page],currentRows.find(row=>row.identity==='wide/downtown-future.png'));
 assert(!/\/Users\/|\/private\/|file:\/\/|\/home\/|\/var\/|\/tmp\//.test(JSON.stringify([manifest,sources,ix])),'Private paths leaked');
 return {publicationEvidence:'NOT_CHECKED_BY_LOCAL_STRUCTURE_PREFLIGHT',entries:Object.entries(pictures.images),originalImageVerification:{nativeMasterURLsPreserved:true,presentationDerivatives:33,separatePublicHashProofRequired:true,remoteBytesFetchedByThisStaticCheck:false},portraitGallery:{nativePortraitRecords:24,presentationDerivatives:24,localAVIFPreviews:24,dimensionsVerified:true,separatePublicHashProofRequired:true},displayPreviewSummary:{totalWide:33,totalPortraits:24,format:'AVIF',bytes:totalPreviewBytes},presentation:{images:57,publicAssets:manifest.assets.length,nativeCameraRefinements:newFrames,originalSourceDatesPreserved:true,nativeMasterURLsPreserved:true}};
}
export async function validatePictureMedia(site){
 const pictures=await load(site,'data/picture-assets.json');
 if(pictures.refinedMediaVersion!==1){const legacy=await import('./validate-picture-media-legacy.mjs');return legacy.validatePictureMedia(site);}
 const result=await validateRefinedPictureStructure(site),manifest=await load(site,'data/refined-media-manifest.json');
 const proof=await load(site,'data/refined-media-release-integrity.json');
 assert.equal(proof.schema,'future-mississauga-refined-public-byte-proof/v1');assert.equal(proof.targetCommit,target);assert(proof.checkedAt);
 assert.equal(proof.publicHashesVerified,manifest.assets.length);assert.equal(proof.assets.length,manifest.assets.length);
 assert.equal(new Set(proof.assets.map(assetKey)).size,proof.assets.length);
 for(const a of manifest.assets)publicProof(proof.assets.find(p=>assetKey(p)===assetKey(a)),a);
 return {...result,publicationEvidence:'PUBLISHER_PUBLIC_BYTE_PROOF_VERIFIED'};
}
