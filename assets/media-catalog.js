import {DOWNTOWN_CURRENT_MANIFEST_SHA256,DOWNTOWN_CURRENT_PARSED_SHA256,DOWNTOWN_CURRENT_IDENTITIES,DOWNTOWN_CURRENT_COMPARISON} from './downtown-current-media-policy.js?v=20261113-downtown1';
import {MEADOWVALE_MANIFEST_SHA256,MEADOWVALE_IDENTITIES} from './meadowvale-media-policy.js?v=20261113-coverage1';
import {EAST_CREDIT_MANIFEST_SHA256,EAST_CREDIT_IDENTITIES} from './east-credit-media-policy.js?v=20261113-coverage1';
import {COVERAGE_MANIFEST_SHA256,COVERAGE_IDENTITIES} from './coverage-media-policy.js?v=20261113-coverage1';
import {assetURL} from './asset-delivery.js?v=20261113-delivery2';
import {normalizeCleanMedia,matchedComparisonBinding} from './clean-media.js?v=20261113-design2';
import {matchedFairviewBinding} from './fairview-media.js?v=20261102-fairview1';
const clean = (value,baseURL=location.href) => { const url=new URL(value,baseURL);url.search='';url.hash='';return url.href; };
const pixelURLs = row => [...new Set([row.preview.url,row.responsive.url,row.displayMaster.url,row.download.url,...(row.responsivePreviews||[]).map(asset=>asset.url)])];

// Historical aliases always retain their own pixels and provenance. A current
// Citywide edition only adds new pixel URLs and selects the gallery's logical key.
export function indexMedia(catalog,baseURL=location.href) {
  const index=new Map();
  for(const row of catalog.images){
    for(const url of [...row.aliases,...pixelURLs(row)])index.set(clean(url,baseURL),row);
  }
  for(const row of [catalog.currentCitywide,...(catalog.currentPictures||[]),...(catalog.currentNeighbourhoods||[])].filter(Boolean)){
    for(const url of pixelURLs(row)){
      const key=clean(url,baseURL);
      if(index.has(key)&&index.get(key)!==row)throw new Error('Current image pixels must use new URLs.');
      index.set(key,row);
    }
  }
  // A posting revision owns only its old download URL. Its shared scene URLs
  // continue to resolve to the current record, with the same scene metadata.
  for(const row of catalog.previousDownloadEditions||[]){
    const key=clean(row.download.url,baseURL);
    if(index.has(key)&&index.get(key)!==row)throw new Error('Previous download URL must retain its original record.');
    index.set(key,row);
  }
  // Delivery aliases point to the same record; source URLs and provenance stay
  // unchanged. Only destinations from the pinned delivery map become aliases.
  const records=[...catalog.images,catalog.currentCitywide,...(catalog.currentPictures||[]),...(catalog.currentNeighbourhoods||[])].filter(Boolean).map(row=>({row,urls:[...row.aliases,...pixelURLs(row)]}));
  records.push(...(catalog.previousDownloadEditions||[]).map(row=>({row,urls:[row.download.url]})));
  for(const {row,urls} of records){
    for(const url of urls){
      const delivered=clean(assetURL(url),baseURL),original=clean(url,baseURL);
      if(delivered===original)continue;
      if(index.has(delivered)&&index.get(delivered)!==row)throw new Error('Delivered image pixels must retain one source identity.');
      index.set(delivered,row);
    }
  }
  return index;
}

function validateCurrentPixels(row,baseURL) {
  if(!row.renderInfo||row.renderInfo.sourceDatesMixed!==true||row.renderInfo.sourceModelDate!==null||row.renderInfo.state==='retained-earlier'||typeof row.sourceAttribution?.openStreetMap!=='boolean')throw new Error('Current Citywide source dates and attribution are required.');
  for(const key of ['preview','responsive','displayMaster','download']){
    const asset=row[key];
    if(!asset||typeof asset.url!=='string'||!asset.url||!Number.isInteger(asset.width)||asset.width<=0||!Number.isInteger(asset.height)||asset.height<=0||!Number.isInteger(asset.bytes)||asset.bytes<=0||!/^[a-f0-9]{64}$/.test(asset.sha256))throw new Error('Incomplete current Citywide image asset.');
    const url=new URL(asset.url,baseURL);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid current Citywide image URL.');
  }
  if(row.download.width!==row.displayMaster.width||row.download.height!==row.displayMaster.height||row.preview.width>=row.responsive.width||row.responsive.width>row.displayMaster.width)throw new Error('Current Citywide image dimensions do not match.');
  for(const key of ['preview','responsive'])if(row[key].sourceSHA256!==row.displayMaster.sha256||row[key].height!==Math.round(row.displayMaster.height*row[key].width/row.displayMaster.width))throw new Error('Current Citywide preview does not match its display master.');
}
export function integrateCurrentCitywide(catalog,row,baseURL=location.href) {
  if(row?.kind!=='wide'||row.file!=='citywide-future.png'||!Array.isArray(row.aliases)||row.aliases.length)throw new Error('Expected one current Citywide view without historical aliases.');
  validateCurrentPixels(row,baseURL);
  const current={...catalog,currentCitywide:structuredClone(row)};
  indexMedia(current,baseURL); // Reject collisions before any current view changes.
  return current;
}

export function integrateCurrentPictures(catalog,rows,baseURL=location.href) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('Current picture edition is empty.');
  if(rows.some(row=>row?.schema==='future-mississauga-current-native-media/v2'))return integrateCleanRows(catalog,rows,baseURL,false);
  const keys=new Set();
  for(const row of rows){
    if(!['wide','portraits'].includes(row?.kind)||!/^downtown-[a-z-]+\.png$/.test(row.file)||!Array.isArray(row.aliases)||row.aliases.length)throw new Error('Expected current Downtown views without historical aliases.');
    const key=row.kind+'/'+row.file;if(keys.has(key))throw new Error('Duplicate current picture view.');keys.add(key);
    validateCurrentPixels(row,baseURL);
  }
  const current={...catalog,currentPictures:structuredClone(rows)};
  indexMedia(current,baseURL);
  return current;
}

function sameMetadata(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameMetadata(a[key],b[key]));
}
function postingSceneMetadata(row){
  const {download,cleanPresentation,renderInfo,...rest}=row;
  const {role,sceneBounds,footerBounds,sideMarginsPx,sceneOverlay,...sceneProof}=cleanPresentation;
  const proofs={...renderInfo.sourceProofSHA256s};delete proofs.postingLayout;
  return {...rest,cleanPresentation:sceneProof,renderInfo:{...renderInfo,sourceProofSHA256s:proofs}};
}

// This is deliberately unbound: publication must supply a separately accepted
// posting batch. It cannot introduce a new scene or change source attribution.
export function integratePostingDownloads(catalog,entries,baseURL=location.href){
  if(!Array.isArray(entries)||!entries.length)throw new Error('Posting download edition is empty.');
  const before=indexMedia(catalog,baseURL),replacements=new Map(),newURLs=new Set(),previous=[];
  for(const entry of entries){
    const row=normalizeCleanMedia(entry,baseURL);
    if(row.kind!=='portraits'||row.cleanPresentation.role!=='nativeSceneOnExpandedWhiteCanvas')throw new Error('Posting download requires the expanded portrait contract.');
    if(!/^[a-f0-9]{64}$/.test(entry.provenance?.postingLayout?.sha256||''))throw new Error('Posting layout proof hash is required.');
    if(replacements.has(row.identity))throw new Error('Duplicate posting identity.');
    const matches=(catalog.currentPictures||[]).filter(current=>current.identity===row.identity);
    if(matches.length!==1||matches[0].kind!=='portraits'||!matches[0].cleanPresentation)throw new Error('Posting identity must match exactly one current clean portrait.');
    const original=matches[0],next={...original,...row};
    if(!sameMetadata(postingSceneMetadata(next),postingSceneMetadata(original)))throw new Error('Posting download cannot change scene assets, captions, dates or source metadata.');
    for(const url of [row.download.url,assetURL(row.download.url)]){
      const key=clean(url,baseURL);
      if(before.has(key)||newURLs.has(key))throw new Error('Posting download must use a new URL.');
    }
    for(const url of [row.download.url,assetURL(row.download.url)])newURLs.add(clean(url,baseURL));
    replacements.set(row.identity,next);previous.push(original);
  }
  const next={...catalog,currentPictures:catalog.currentPictures.map(row=>replacements.get(row.identity)||row),previousDownloadEditions:[...(catalog.previousDownloadEditions||[]),...previous]};
  indexMedia(next,baseURL);return next;
}

function integrateCleanRows(catalog,entries,baseURL,neighbourhood,coverage=false){
  if(!Array.isArray(entries)||!entries.length)throw new Error('Current clean edition is empty.');
  const rows=entries.map(entry=>normalizeCleanMedia(entry,baseURL,{neighbourhood,coverage})),keys=new Set();
  for(const row of rows){if(keys.has(row.identity))throw new Error('Duplicate current clean view.');keys.add(row.identity);}
  // First validate new pixel URLs against every old alias and current edition.
  // Then archive superseded current records with their original identities.
  const before=indexMedia(catalog,baseURL),newURLs=new Set();
  for(const row of rows)for(const url of pixelURLs(row)){
    const key=clean(url,baseURL);
    if(before.has(key)||newURLs.has(key))throw new Error('Current image pixels must use new URLs.');
    newURLs.add(key);
  }
  const previous=[catalog.currentCitywide,...(catalog.currentPictures||[]),...(catalog.currentNeighbourhoods||[])].filter(Boolean);
  const replaced=previous.filter(row=>keys.has(row.identity||row.kind+'/'+row.file));
  const next={...catalog,images:[...catalog.images,...replaced],previousCurrentPictures:[...(catalog.previousCurrentPictures||[]),...replaced]};
  if(neighbourhood)next.currentNeighbourhoods=[...(catalog.currentNeighbourhoods||[]).filter(row=>!keys.has(row.identity)),...rows];
  else{
    const citywide=rows.find(row=>row.kind==='wide'&&row.file==='citywide-future.png');
    if(citywide)next.currentCitywide=citywide;
    next.currentPictures=[...(catalog.currentPictures||[]).filter(row=>!keys.has(row.identity||row.kind+'/'+row.file)),...rows.filter(row=>row!==citywide)];
  }
  indexMedia(next,baseURL);return next;
}
export function integrateCurrentNeighbourhoods(catalog,entries,baseURL=location.href,{proof,proofSHA256}={}){
  // Build a detached candidate first. Neither member becomes current unless the
  // dedicated Existing/Existing pilot proof binds both exact clean records.
  const candidate=integrateCleanRows(catalog,entries,baseURL,true);
  const rows=candidate.currentNeighbourhoods,comparisonProof=matchedFairviewBinding(rows,proof,proofSHA256);
  return {...candidate,currentNeighbourhoods:rows.map(row=>({...row,comparisonProof}))};
}

export function refreshCatalogPictures(pictures,catalog) {
  // Reset only current-clean selections when recomputing the catalogue. This
  // preserves the prior matched comparison family when a single pilot is new.
  for(const [file,row]of Object.entries(pictures.images))if(row.cleanPresentation){if(pictures.comparisonImages?.[file])pictures.images[file]=pictures.comparisonImages[file];else if(row.coverageAddition)delete pictures.images[file];}
  for(const row of catalog.images.filter(row=>row.kind==='wide')){
    const original=pictures.images[row.file];if(!original)continue;
    pictures.images[row.file]={...original,url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,display:row.preview,displayMaster:row.displayMaster,download:row.download,sourceAttribution:row.sourceAttribution};
  }
  const current=[...(catalog.previousCurrentPictures||[]).filter(row=>row.kind==='wide'),catalog.currentCitywide,...(catalog.currentPictures||[]).filter(row=>row.kind==='wide')].filter(Boolean);
  const ordered=[...current.filter(row=>!row.cleanPresentation),...current.filter(row=>row.cleanPresentation)];let savedComparison=false;
  for(const row of ordered){
    if(!pictures.images[row.file]&&!row.coverageAddition)continue;
    if(row.cleanPresentation&&!savedComparison){pictures.comparisonImages=structuredClone(pictures.images);savedComparison=true;}
    // Start from the new record so old presentation/camera/source metadata cannot
    // describe the new pixels. Its nativeOriginal, when supplied, is the new raw
    // render; previous editions remain in the unchanged historical catalogue.
    pictures.images[row.file]={...structuredClone(row),url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,width:row.displayMaster.width,height:row.displayMaster.height,format:row.download.format,display:row.preview};
  }
  return pictures;
}
async function optionalCurrentManifest(fetcher,path,timeoutMs,decode=response=>response.json()) {
  const controller=new AbortController();let timer;
  try{
    return await Promise.race([
      fetcher(path,{cache:'no-store',signal:controller.signal}).then(response=>response.ok?decode(response):null),
      new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(null);},Math.min(5000,Math.max(1,timeoutMs)));})
    ]);
  }catch{return null;}
  finally{clearTimeout(timer);}
}

export function integrateCoveragePictures(catalog,entries,baseURL=location.href){
 if(!Array.isArray(entries)||entries.length!==COVERAGE_IDENTITIES.length||entries.some(row=>!COVERAGE_IDENTITIES.includes(row.identity))||new Set(entries.map(row=>row.identity)).size!==COVERAGE_IDENTITIES.length)throw new Error('Coverage requires the exact six accepted new identities.');
 return integrateCleanRows(catalog,entries,baseURL,false,true);
}

export function integrateEastCreditPictures(catalog,entries,baseURL=location.href){
 if(!Array.isArray(entries)||entries.length!==EAST_CREDIT_IDENTITIES.length||entries.some(row=>!EAST_CREDIT_IDENTITIES.includes(row.identity))||new Set(entries.map(row=>row.identity)).size!==EAST_CREDIT_IDENTITIES.length)throw new Error('East Credit requires its exact accepted pair.');
 return integrateCleanRows(catalog,entries,baseURL,false,true);
}

export function integrateMeadowvalePictures(catalog,entries,baseURL=location.href){
 if(!Array.isArray(entries)||entries.length!==MEADOWVALE_IDENTITIES.length||entries.some(row=>!MEADOWVALE_IDENTITIES.includes(row.identity))||new Set(entries.map(row=>row.identity)).size!==MEADOWVALE_IDENTITIES.length)throw new Error('Meadowvale requires its exact accepted pair.');
 return integrateCleanRows(catalog,entries,baseURL,false,true);
}

// The accepted Downtown edition is indivisible: a valid new picture set and its
// exact matched camera proof must both pass before any current view changes.
const digestText=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function integrateDowntownCurrentPictures(catalog,manifest,baseURL=location.href,{proof,proofSHA256}={}){
 if(await digestText(JSON.stringify(manifest))!==DOWNTOWN_CURRENT_PARSED_SHA256)throw new Error('Downtown must retain its complete accepted metadata.');
 if(manifest.images.length!==DOWNTOWN_CURRENT_IDENTITIES.length||!sameMetadata(manifest.images.map(row=>row.identity),DOWNTOWN_CURRENT_IDENTITIES)||!sameMetadata(manifest.comparisonProofs,[DOWNTOWN_CURRENT_COMPARISON]))throw new Error('Downtown requires the exact fourteen views and matched proof.');
 if(proofSHA256!==DOWNTOWN_CURRENT_COMPARISON.sha256||proof?.proofID!==DOWNTOWN_CURRENT_COMPARISON.proofID)throw new Error('Downtown comparison proof differs.');
 const candidate=integrateCurrentPictures(catalog,manifest.images,baseURL),binding=matchedComparisonBinding(candidate.currentPictures,proof,proofSHA256),members=new Set(proof.members.map(row=>row.identity));
 return {...candidate,currentPictures:candidate.currentPictures.map(row=>members.has(row.identity)?{...row,comparisonProof:binding}:row)};
}

// Intake manifests remain immutable after review. Their historical preparation
// state is separate from delivery: only a complete verified release map activates
// these additions on the public site. The build checks the remote byte evidence.
export function hasPublishedImageDelivery(manifest,resolve=assetURL){
 if(!Array.isArray(manifest?.images)||!manifest.images.length)return false;
 return manifest.images.every(row=>{
  const assets=[row.displayMaster,row.download,...(row.responsivePreviews||[])];
  return assets.length===6&&assets.every(asset=>asset?.url&&resolve(asset.url)!==asset.url&&/^https:\/\/github\.com\/itsdanielsultan\/future-mississauga\/releases\/download\/neighbourhood-images-2026-11-13-[a-z0-9-]+\/[A-Za-z0-9-]+\.(png|jpg|avif)$/.test(resolve(asset.url)));
 });
}

export async function loadMediaCatalog(fetcher=fetch,{baseURL=location.href,currentTimeoutMs=2500}={}) {
  const historicalRequest=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetcher('data/labelled-image-assets.json',{cache:'no-store'});
        if(response.ok){const catalog=await response.json();if(Array.isArray(catalog?.images))return catalog;}
      }catch{}
    }
    return {images:[]};
  })();
  const downtownCurrentRequest=optionalCurrentManifest(fetcher,'data/downtown-current-media-20261113.json',currentTimeoutMs,async response=>{const text=await response.text();return await digestText(text)===DOWNTOWN_CURRENT_MANIFEST_SHA256?JSON.parse(text):null;});
  const coverageRequest=optionalCurrentManifest(fetcher,'data/coverage-media-20261113.json',currentTimeoutMs,async response=>{
 const text=await response.text(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return digest===COVERAGE_MANIFEST_SHA256?JSON.parse(text):null;
 });
 const meadowvaleRequest=optionalCurrentManifest(fetcher,'data/meadowvale-media-20261113.json',currentTimeoutMs,async response=>{
 const text=await response.text(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return digest===MEADOWVALE_MANIFEST_SHA256?JSON.parse(text):null;
 });
 const eastCreditRequest=optionalCurrentManifest(fetcher,'data/east-credit-media-20261113.json',currentTimeoutMs,async response=>{
 const text=await response.text(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return digest===EAST_CREDIT_MANIFEST_SHA256?JSON.parse(text):null;
 });
 const [catalog,current,downtown,native,neighbourhood,revision]=await Promise.all([historicalRequest,optionalCurrentManifest(fetcher,'data/citywide-media-20261101.json',currentTimeoutMs),optionalCurrentManifest(fetcher,'data/downtown-media-20261101.json',currentTimeoutMs),optionalCurrentManifest(fetcher,'data/native-media-20261102.json',currentTimeoutMs),optionalCurrentManifest(fetcher,'data/neighbourhood-media-20261102.json',currentTimeoutMs),optionalCurrentManifest(fetcher,'data/presentation-media-20261109.json',currentTimeoutMs)]);
  // Fetch this independent proof alongside the picture-proof work. It never
  // shares the generic Existing/Future comparison validator or its allowlist.
  const fairviewProof=(async()=>{
    if(neighbourhood?.schema!=='future-mississauga-neighbourhood-media/v2'||neighbourhood.id!=='fairview'||neighbourhood.state!=='READY_FOR_PUBLICATION'||neighbourhood.publication!==true||!Array.isArray(neighbourhood.images)||neighbourhood.images.length!==2||!Array.isArray(neighbourhood.comparisonProofs)||neighbourhood.comparisonProofs.length!==1)return null;
    if(neighbourhood.images.map(row=>row?.identity).join('|')!=='neighbourhood/fairview/before|neighbourhood/fairview/after')return null;
    const reference=neighbourhood.comparisonProofs[0];
    if(!/^data\/matched-pairs\/[a-z0-9-]+\.json$/.test(reference?.url)||!/^[a-f0-9]{64}$/.test(reference.sha256))return null;
    const proof=await optionalCurrentManifest(fetcher,reference.url,currentTimeoutMs,async response=>{
      const text=await response.text(),bytes=new TextEncoder().encode(text);
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      return digest===reference.sha256?JSON.parse(text):null;
    });
    return proof?.proofID===reference.proofID?{proof,proofSHA256:reference.sha256}:null;
  })();
  // An unavailable or invalid new edition must leave the historical gallery usable.
  let result=catalog;
  if(current?.schema==='future-mississauga-current-citywide-media/v1')try{
    let history=result;
    for(const edition of current.previousEditions||[]){
      const verified=integrateCurrentCitywide(history,edition,baseURL).currentCitywide;
      history={...history,images:[...history.images,verified]};
    }
    result=integrateCurrentCitywide(history,current.image,baseURL);
  }catch{}
  if(downtown?.schema==='future-mississauga-current-picture-media/v1')try{
    result=integrateCurrentPictures(result,downtown.images,baseURL);
  }catch{}
  if(native?.schema==='future-mississauga-native-media-catalog/v2')try{
    result=integrateCurrentPictures(result,native.images,baseURL);
  }catch{}
  if(revision?.schema==='future-mississauga-native-media-catalog/v2')try{
    result=integrateCurrentPictures(result,revision.images,baseURL);
  }catch{}
  for(const reference of [...(Array.isArray(native?.comparisonProofs)?native.comparisonProofs:[]),...(Array.isArray(revision?.comparisonProofs)?revision.comparisonProofs:[])]){
    if(!/^data\/matched-pairs\/[a-z0-9-]+\.json$/.test(reference?.url)||!/^[a-f0-9]{64}$/.test(reference.sha256))continue;
    const proof=await optionalCurrentManifest(fetcher,reference.url,currentTimeoutMs,async response=>{
      const text=await response.text(),bytes=new TextEncoder().encode(text);
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      return digest===reference.sha256?JSON.parse(text):null;
    });
    try{
      if(proof?.proofID!==reference.proofID)continue;
      const binding=matchedComparisonBinding(result.currentPictures||[],proof,reference.sha256),identities=new Set(proof.members.map(member=>member.identity));
      result={...result,currentPictures:result.currentPictures.map(row=>identities.has(row.identity)?{...row,comparisonProof:binding}:row)};
    }catch{} // Unavailable, stale or mismatched proof keeps the older slider pair.
  }
  const downtownCurrent=await downtownCurrentRequest;
  if(downtownCurrent&&(hasPublishedImageDelivery(downtownCurrent)||['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname))){
    const reference=DOWNTOWN_CURRENT_COMPARISON;
    const proof=await optionalCurrentManifest(fetcher,reference.url,currentTimeoutMs,async response=>{const text=await response.text();return await digestText(text)===reference.sha256?JSON.parse(text):null;});
    try{result=await integrateDowntownCurrentPictures(result,downtownCurrent,baseURL,{proof,proofSHA256:reference.sha256});}catch{} // Keep all earlier views and the earlier matched pair together.
  }
  const coverage=await coverageRequest;
  if(coverage?.schema==='future-mississauga-coverage-media/v1'&&coverage.sourceCaptureHistoryPreserved===true&&(hasPublishedImageDelivery(coverage)||['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname)))try{result=integrateCoveragePictures(result,coverage.images,baseURL);}catch{}
  const eastCredit=await eastCreditRequest;
  if(eastCredit?.schema==='future-mississauga-east-credit-media/v1'&&eastCredit.sourceCaptureHistoryPreserved===true&&(hasPublishedImageDelivery(eastCredit)||['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname)))try{result=integrateEastCreditPictures(result,eastCredit.images,baseURL);}catch{}
  const meadowvale=await meadowvaleRequest;
  if(meadowvale?.schema==='future-mississauga-meadowvale-media/v1'&&meadowvale.sourceCaptureHistoryPreserved===true&&(hasPublishedImageDelivery(meadowvale)||['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname)))try{result=integrateMeadowvalePictures(result,meadowvale.images,baseURL);}catch{}
  const verifiedFairview=await fairviewProof;
  if(verifiedFairview)try{
    result=integrateCurrentNeighbourhoods(result,neighbourhood.images,baseURL,verifiedFairview);
  }catch{} // Retain the complete earlier pair if either image or proof fails.
  return result;
}
export const mediaCatalog=loadMediaCatalog();
const catalogIndex = mediaCatalog.then(catalog=>indexMedia(catalog));
export async function resolveMedia(url){return (await catalogIndex).get(clean(url));}
export async function refreshPictureAssets(pictures){return refreshCatalogPictures(pictures,await mediaCatalog);}
export async function installResponsiveImages({onCleanImage}={}){
  const index=await catalogIndex;
  const apply=image=>{
    if(image.closest('dialog'))return;
    const row=index.get(clean(image.getAttribute('src')||''));if(!row)return;
    const paired=Boolean(image.closest('.picture-compare')&&row.cleanPresentation),displayURL=paired?row.responsive.url:row.preview.url;
    if(image.dataset.responsiveMedia===displayURL)return;
    image.dataset.responsiveMedia=displayURL;
    // Reset any density cached from the preceding responsive candidate, even when its URL is unchanged.
    if(paired){image.removeAttribute('sizes');image.srcset=assetURL(displayURL)+' 1x';image.src=assetURL(displayURL);}
    else{
      image.src=assetURL(displayURL);
      image.srcset=`${assetURL(row.preview.url)} ${row.preview.width}w, ${assetURL(row.responsive.url)} ${row.responsive.width}w`;
      image.sizes=image.closest('.social-grid')?'(max-width: 640px) calc(100vw - 44px), (max-width: 1000px) calc((100vw - 80px)/2), calc((100vw - 120px)/3)':image.closest('.gallery-grid,.render-pair')?'(max-width: 600px) calc(100vw - 44px), calc((100vw - 120px)/2)':'calc(100vw - 80px)';
    }
    const card=image.closest('.social-grid article');
    if(card){card.dataset.displayUrl=row.displayMaster.url;card.dataset.displayWidth=row.displayMaster.width;card.dataset.displayHeight=row.displayMaster.height;}
    // Also notify when a comparison returns to a historical view so a previous
    // clean-edition credit cannot remain attached to different pixels.
    onCleanImage?.(image,row);
  };
  const scan=root=>{if(root instanceof HTMLImageElement)apply(root);root.querySelectorAll?.('img').forEach(apply);};
  scan(document);
  document.querySelectorAll('a[href]').forEach(anchor=>{
    const row=index.get(clean(anchor.href));if(!row)return;
    if(anchor.hasAttribute('download')||anchor.classList.contains('save'))anchor.href=assetURL(row.download.url);
    else if(anchor.querySelector('img'))anchor.href=assetURL(row.displayMaster.url);
  });
  new MutationObserver(records=>{
    for(const record of records){if(record.type==='attributes')apply(record.target);else record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node);});}
  }).observe(document.querySelector('main')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
}
