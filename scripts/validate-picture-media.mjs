import {DOWNTOWN_CURRENT_MANIFEST_SHA256} from '../public/downtown-current-media-policy.js';
import {MEADOWVALE_MANIFEST_SHA256,MEADOWVALE_IDENTITIES} from '../public/meadowvale-media-policy.js';
// Media lineage and actual local preview bytes are checked here. The publisher supplies
// separately fetched public PNG hashes; a local build never invents remote verification.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeCleanMedia,imageAttribution,mediaScenarioLabel} from '../public/clean-media.js';
import {EAST_CREDIT_MANIFEST_SHA256,EAST_CREDIT_IDENTITIES} from '../public/east-credit-media-policy.js';
import {COVERAGE_MANIFEST_SHA256,COVERAGE_IDENTITIES} from '../public/coverage-media-policy.js';
import {plateCaption} from '../public/edition-pictures.js';
import {portraitViewTitle} from '../public/gallery-catalogue.js';
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
export function validateNativeSocialCard(articles,row,{headingLevel=2,sourceLink}={}){
 const matching=articles.filter(card=>card.includes('data-display-url="'+escapeHTML(row.displayMaster.url)+'"'));
 assert.equal(matching.length,1,'Exactly one current Social card required: '+assetKey(row));
 const card=matching[0],links=card.match(/<a\b[^>]*>/g)??[];
 const hasClass=(link,name)=>(link.match(/\bclass="([^"]*)"/)?.[1]||'').split(/\s+/).includes(name);
 const preview=links.filter(link=>hasClass(link,'image-link')),download=links.filter(link=>hasClass(link,'save'));
 assert.equal(preview.length,1);assert.equal(download.length,1);
 assert(preview[0].includes('href="'+escapeHTML(row.displayMaster.url)+'"'));
 assert(preview[0].includes('aria-haspopup="dialog"'));assert(!/\sdownload(?:\s|=|>)/.test(preview[0]),'Image click must preview, not download');
 assert(download[0].includes('href="'+escapeHTML(row.download.url)+'"'));assert(/\sdownload(?:\s|=|>)/.test(download[0]),'Explicit download action required');
 for(const [name,value] of Object.entries({'data-osm':row.caption.openStreetMap,'data-display-width':row.displayMaster.width,'data-display-height':row.displayMaster.height}))assert(card.includes(name+'="'+value+'"'),assetKey(row)+' '+name);
 const images=card.match(/<img\b[^>]*>/g)??[];assert.equal(images.length,1);
 for(const [name,value] of Object.entries({src:row.preview.url,width:row.preview.width,height:row.preview.height}))assert(images[0].includes(name+'="'+escapeHTML(value)+'"'),assetKey(row)+' image '+name);
 const viewTitle=row.coverageAddition?row.caption.subtitle||'Wide aerial':portraitViewTitle(row.file);
 assert(card.includes('data-area-title="'+escapeHTML(row.title)+'"'),'Exact Social area identity required: '+assetKey(row));
 assert(card.includes('<span class="media-caption__area">'+escapeHTML(row.coverageAddition?viewTitle:row.title)+'</span>'),'Visible Social area required: '+assetKey(row));
 assert(card.includes('data-view-title="'+escapeHTML(viewTitle)+'"'),'Exact Social view identity required: '+assetKey(row));
 assert(card.includes('<h'+headingLevel+'>'+escapeHTML(row.coverageAddition?row.title:viewTitle)+'</h'+headingLevel+'>'),'Distinct Social view heading required: '+assetKey(row));
 assert(card.includes('>'+escapeHTML(mediaScenarioLabel(row))+'</span>'));
 const credit=imageAttribution(row);assert(card.includes(escapeHTML(credit.cityCredit)));
 assert.equal(card.includes('href="https://www.openstreetmap.org/copyright"'),credit.openStreetMap);
 assert.equal(card.includes('© OpenStreetMap'),credit.openStreetMap);
 for(const text of credit.requiredModelCredits)assert(card.includes(escapeHTML(text)),assetKey(row)+' required model credit');
 assert(card.includes('href="'+escapeHTML(sourceLink || credit.sourcesURL)+'"'));
 return card;
}
export async function validateNativeSharePreviews(site,pages,row,{edition='native-20261102'}={}){
 assert(['native-20261102','revision-20261109'].includes(edition),'Unknown share edition');
 assert.equal(row.identity,'wide/downtown-future.png','Share image must use the declared Downtown view');
 const source=row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200);assert(source,'Native share JPEG source missing');
 assert.equal(source.sourceSHA256,row.displayMaster.sha256,'Share JPEG must derive from this exact clean scene');
 assert.equal(source.height,Math.round(row.displayMaster.height*source.width/row.displayMaster.width),'Share JPEG aspect ratio must match its clean scene');
 const local=edition==='revision-20261109'
  ?'gallery/revision-20261109/downtown-future-1200-'+source.sha256.slice(0,12)+'.jpg'
  :'gallery/native-share-20261102/downtown-future-'+source.sha256.slice(0,12)+'.jpg';
 if(edition==='revision-20261109')assert.equal(source.url,local,'Presentation share must use its exact local JPEG');
 for(const page of pages){
  const og=page.match(/<meta property="og:image" content="([^"]+)"/),twitter=page.match(/<meta name="twitter:image" content="([^"]+)"/);
  assert(og&&twitter,'Current share metadata required');assert.equal(og[1],twitter[1]);
  assert.equal(og[1],'https://futuremississauga.com/'+local);
  for(const [key,value]of Object.entries({width:source.width,height:source.height,type:source.format})){
   const tag=page.match(new RegExp('<meta property="og:image:'+key+'" content="([^"]+)"'));
   if(tag)assert.equal(tag[1],String(value),'Share metadata '+key+' must match the actual JPEG');
  }
 }
const bytes=await readFile(join(site,local));assert.equal(bytes.length,source.bytes);assert.equal(sha(bytes),source.sha256);assert.deepEqual(jpegSize(bytes),[source.width,source.height]);
}
export async function validateEditionShare(site, name, html, record) {
 assert.equal(record.url, 'gallery/edition-20261120/share/' + name + '.jpg');
 const absolute = 'https://futuremississauga.com/' + record.url;
 for (const [attribute, key, value] of [
  ['property','og:image',absolute], ['name','twitter:image',absolute],
  ['property','og:image:width',record.width], ['property','og:image:height',record.height],
  ['property','og:image:type','image/jpeg'],
 ]) {
  const tags = [...html.matchAll(new RegExp('<meta '+attribute+'="'+key+'" content="([^"]+)"','g'))];
  assert.equal(tags.length, 1, name+' share metadata '+key);
  assert.equal(tags[0][1], String(value), name+' share metadata '+key);
 }
 const source = await readFile(join(site,record.source));
 assert.equal(sha(source), record.sourceSHA256, name+' share artwork changed');
 const jpeg = await readFile(join(site,record.url));
 assert.equal(sha(jpeg), record.sha256, name+' share image bytes changed');
 assert.deepEqual(jpegSize(jpeg), [record.width,record.height]);
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
 const page=await readFile(join(site,'social.html'),'utf8');const articles=page.match(/<article\b[\s\S]*?<\/article>/g)??[];const coverageText=await readFile(join(site,'data/coverage-media-20261113.json'),'utf8');assert.equal(sha(coverageText),COVERAGE_MANIFEST_SHA256,'Coverage catalogue must keep its independent accepted pin');
 const coverage=JSON.parse(coverageText);assert.deepEqual(coverage.images.map(row=>row.identity).sort(),[...COVERAGE_IDENTITIES].sort());
 const eastCreditText=await readFile(join(site,'data/east-credit-media-20261113.json'),'utf8');assert.equal(sha(eastCreditText),EAST_CREDIT_MANIFEST_SHA256,'East Credit must keep its separate accepted pin');
 const eastCredit=JSON.parse(eastCreditText);assert.deepEqual(eastCredit.images.map(row=>row.identity).sort(),[...EAST_CREDIT_IDENTITIES].sort());
 const meadowvaleText=await readFile(join(site,'data/meadowvale-media-20261113.json'),'utf8');assert.equal(sha(meadowvaleText),MEADOWVALE_MANIFEST_SHA256,'Meadowvale must keep its separate accepted pin');
 const meadowvale=JSON.parse(meadowvaleText);assert.deepEqual(meadowvale.images.map(row=>row.identity).sort(),[...MEADOWVALE_IDENTITIES].sort());
 const coveragePortraits=[...coverage.images,...eastCredit.images,...meadowvale.images].map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/',{coverage:true})).filter(row=>row.kind==='portraits');
 const plateEdition = await load(site,'data/city-plates-20261120.json');
 const portraits = new Map(plateEdition.plates.filter(p => p.id.startsWith('portraits/')).map(p => [p.id,p]));
 async function validatePortrait(row) {
   const id = 'portraits/' + row.file;
   const plate = portraits.get(id);
   assert(plate, 'Missing published portrait edition: ' + id);
   assert(plate.displayMaster?.url && plate.download?.url, 'Incomplete portrait edition: ' + id);
   const master=plate.signedMaster || plate.displayMaster;
   const small=plate.signedThumbnail || {url:plate.thumbnail,width:512};
   const large=plate.signedPreview || {url:plate.webImage,width:plate.width,height:plate.height};
   const verified=[plate.displayMaster,plate.download,plate.signedMaster,plate.signedThumbnail,plate.signedPreview].filter(Boolean);
   for (const item of verified) {
     assert(/^gallery\/edition-20261120\/(originals|signed)\/[\w-]+\.(?:png|webp)$/.test(item.url), id+' local published artwork');
     const bytes=await readFile(join(site,item.url));
     assert.equal(bytes.length,item.bytes,id+' byte size');
     assert.equal(sha(bytes),item.sha256,id+' published bytes');
     if (item===plate.download && plate.signedMaster) {
       assert(bytes.includes(Buffer.from('Daniel Sultan / Future Mississauga')),id+' signed PNG author');
       for (const credit of plate.attribution.requiredModelCredits) assert(bytes.includes(Buffer.from(credit)),id+' embedded model credit');
     }
   }
   const matches=articles.filter(card=>card.includes('data-plate="'+id+'"'));
   assert.equal(matches.length,1,id+' must appear once');
   const card=matches[0];
   const area=row.title, view=row.coverageAddition?row.caption.subtitle||'Wide aerial':portraitViewTitle(row.file);
   const caption=plateCaption(area,view,row.caption.scenario);
   for (const [name,value] of Object.entries({'data-display-url':master.url,'data-display-width':master.width,
      'data-display-height':master.height,'data-area-title':area,'data-view-title':view,'data-osm':row.caption.openStreetMap})) {
     assert(card.includes(name+'="'+escapeHTML(value)+'"'),id+' '+name);
   }
   assert(card.includes('<h3>'+escapeHTML(caption.title)+'</h3>'),id+' visible subject');
   assert(card.includes('<span class="media-caption__scenario">'+escapeHTML(caption.detail)+'</span>'),id+' visible scenario');
   const image=card.match(/<img\b[^>]+>/)[0];
   assert(image.includes('src="'+small.url+'"') && image.includes('srcset="'+small.url+' '+small.width+'w, '+large.url+' '+large.width+'w"'),id+' responsive candidates');
   assert(image.includes('width="'+large.width+'"') && image.includes('height="'+large.height+'"'),id+' natural ratio');
   const links=card.match(/<a\b[^>]+>/g);
   const preview=links.find(link=>link.includes('class="image-link"')), download=links.find(link=>link.includes('class="save ui-button"'));
   assert(preview?.includes('href="'+master.url+'"') && preview.includes('aria-haspopup="dialog"') && !/\sdownload(?:\s|=|>)/.test(preview),id+' opens credited artwork');
   assert(download?.includes('href="'+plate.download.url+'"') && /\sdownload(?:\s|=|>)/.test(download),id+' downloads credited original');
   const credit=imageAttribution(row);
   assert.equal(plate.attribution.openStreetMap,Boolean(credit.openStreetMap),id+' mapping credit');
   assert.deepEqual(plate.attribution.requiredModelCredits,row.caption.requiredModelCredits,id+' model credits');
 }
 assert.equal(articles.length,24+coveragePortraits.length);
 for(const row of coveragePortraits) await validatePortrait(row);
 const current=await load(site,'data/native-media-20261102.json');
 assert.equal(current.schema,'future-mississauga-native-media-catalog/v2');
 assert((current.state==='LOCAL_STAGED_ONLY'&&current.publication===false)||(current.state==='READY_FOR_PUBLICATION'&&current.publication===true),'Native catalogue state mismatch');
 assert.deepEqual(current.images.map(row=>row.identity).sort(),manifest.entries.map(assetKey).sort(),'Current native identities must exactly cover the historical 57 logical views');
 const currentRows=current.images.map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/'));
 const currentPortraits=new Map(currentRows.filter(row=>row.kind==='portraits').map(row=>[row.file,row]));
 const refreshedRaw=await readFile(join(site,'data/downtown-current-media-20261113.json'),'utf8');assert.equal(sha(refreshedRaw),DOWNTOWN_CURRENT_MANIFEST_SHA256);
 const refreshedPortraits=new Map(JSON.parse(refreshedRaw).images.map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/')).filter(row=>row.kind==='portraits').map(row=>[row.file,row]));
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
   await validatePortrait(refreshedPortraits.get(e.file)||latest);
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
 const currentShare=await load(site,'data/share-preview-20261101.json');
 const oldShare=await readFile(join(site,currentShare.url));assert.equal(oldShare.length,currentShare.bytes);assert.equal(sha(oldShare),currentShare.sha256);assert.deepEqual(jpegSize(oldShare),[currentShare.width,currentShare.height]);
 const revision=await load(site,'data/presentation-media-20261109.json');
 assert.equal(revision.schema,'future-mississauga-native-media-catalog/v2');
 assert.equal(revision.images.length,5);assert.equal(new Set(revision.images.map(row=>row.identity)).size,5);
 const revisionRows=revision.images.map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/'));
 for(const row of revisionRows)assert(currentRows.some(old=>old.identity===row.identity),'Presentation overlay must preserve a registered native identity');
 // The frozen native JPEGs remain independently verified. Public pages share their current section art.
 await validateNativeSharePreviews(site,[],revisionRows.find(row=>row.identity==='wide/downtown-future.png'),{edition:'revision-20261109'});
 await validateNativeSharePreviews(site,[],currentRows.find(row=>row.identity==='wide/downtown-future.png'));
 const editionShares=await load(site,'data/edition-shares.json');
 for(const [name,record] of Object.entries(editionShares)) {
  await validateEditionShare(site,name,await readFile(join(site,name+'.html'),'utf8'),record);
 }
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
