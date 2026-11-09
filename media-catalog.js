import {assetURL} from './asset-delivery.js?v=20261109-delivery1';
import {normalizeCleanMedia,matchedComparisonBinding} from './clean-media.js?v=20261109-feedback1';
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
  // Delivery aliases point to the same record; source URLs and provenance stay
  // unchanged. Only destinations from the pinned delivery map become aliases.
  for(const row of [...catalog.images,catalog.currentCitywide,...(catalog.currentPictures||[]),...(catalog.currentNeighbourhoods||[])].filter(Boolean)){
    for(const url of [...row.aliases,...pixelURLs(row)]){
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

function integrateCleanRows(catalog,entries,baseURL,neighbourhood){
  if(!Array.isArray(entries)||!entries.length)throw new Error('Current clean edition is empty.');
  const rows=entries.map(entry=>normalizeCleanMedia(entry,baseURL,{neighbourhood})),keys=new Set();
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
  for(const [file,row]of Object.entries(pictures.images))if(row.cleanPresentation&&pictures.comparisonImages?.[file])pictures.images[file]=pictures.comparisonImages[file];
  for(const row of catalog.images.filter(row=>row.kind==='wide')){
    const original=pictures.images[row.file];if(!original)continue;
    pictures.images[row.file]={...original,url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,display:row.preview,displayMaster:row.displayMaster,download:row.download,sourceAttribution:row.sourceAttribution};
  }
  const current=[...(catalog.previousCurrentPictures||[]).filter(row=>row.kind==='wide'),catalog.currentCitywide,...(catalog.currentPictures||[]).filter(row=>row.kind==='wide')].filter(Boolean);
  const ordered=[...current.filter(row=>!row.cleanPresentation),...current.filter(row=>row.cleanPresentation)];let savedComparison=false;
  for(const row of ordered){
    if(!pictures.images[row.file])continue;
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
    if(paired){image.removeAttribute('sizes');image.srcset=displayURL+' 1x';image.src=displayURL;}
    else{
      image.src=displayURL;
      image.srcset=`${row.preview.url} ${row.preview.width}w, ${row.responsive.url} ${row.responsive.width}w`;
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
