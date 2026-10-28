const clean = (value,baseURL=location.href) => { const url=new URL(value,baseURL);url.search='';url.hash='';return url.href; };
const pixelURLs = row => [row.preview.url,row.responsive.url,row.displayMaster.url,row.download.url];

// Historical aliases always retain their own pixels and provenance. A current
// Citywide edition only adds new pixel URLs and selects the gallery's logical key.
export function indexMedia(catalog,baseURL=location.href) {
  const index=new Map();
  for(const row of catalog.images){
    for(const url of [...row.aliases,...pixelURLs(row)])index.set(clean(url,baseURL),row);
  }
  if(catalog.currentCitywide){
    for(const url of pixelURLs(catalog.currentCitywide)){
      const key=clean(url,baseURL);
      if(index.has(key)&&index.get(key)!==catalog.currentCitywide)throw new Error('Current Citywide pixels must use new URLs.');
      index.set(key,catalog.currentCitywide);
    }
  }
  return index;
}

export function integrateCurrentCitywide(catalog,row,baseURL=location.href) {
  if(row?.kind!=='wide'||row.file!=='citywide-future.png'||!Array.isArray(row.aliases)||row.aliases.length)throw new Error('Expected one current Citywide view without historical aliases.');
  if(!row.renderInfo||row.renderInfo.sourceDatesMixed!==true||row.renderInfo.sourceModelDate!==null||row.renderInfo.state==='retained-earlier'||typeof row.sourceAttribution?.openStreetMap!=='boolean')throw new Error('Current Citywide source dates and attribution are required.');
  for(const key of ['preview','responsive','displayMaster','download']){
    const asset=row[key];
    if(!asset||typeof asset.url!=='string'||!asset.url||!Number.isInteger(asset.width)||asset.width<=0||!Number.isInteger(asset.height)||asset.height<=0||!Number.isInteger(asset.bytes)||asset.bytes<=0||!/^[a-f0-9]{64}$/.test(asset.sha256))throw new Error('Incomplete current Citywide image asset.');
    const url=new URL(asset.url,baseURL);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid current Citywide image URL.');
  }
  if(row.download.width!==row.displayMaster.width||row.download.height!==row.displayMaster.height||row.preview.width>=row.responsive.width||row.responsive.width>row.displayMaster.width)throw new Error('Current Citywide image dimensions do not match.');
  for(const key of ['preview','responsive'])if(row[key].sourceSHA256!==row.displayMaster.sha256||row[key].height!==Math.round(row.displayMaster.height*row[key].width/row.displayMaster.width))throw new Error('Current Citywide preview does not match its display master.');
  const current={...catalog,currentCitywide:structuredClone(row)};
  indexMedia(current,baseURL); // Reject collisions before any current view changes.
  return current;
}

export function refreshCatalogPictures(pictures,catalog) {
  for(const row of catalog.images.filter(row=>row.kind==='wide')){
    const original=pictures.images[row.file];if(!original)continue;
    pictures.images[row.file]={...original,url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,display:row.preview,displayMaster:row.displayMaster,download:row.download,sourceAttribution:row.sourceAttribution};
  }
  const row=catalog.currentCitywide;
  if(row&&pictures.images[row.file]){
    // Start from the new record so old presentation/camera/source metadata cannot
    // describe the new pixels. Its nativeOriginal, when supplied, is the new raw
    // render; previous editions remain in the unchanged historical catalogue.
    pictures.images[row.file]={...structuredClone(row),url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,width:row.download.width,height:row.download.height,format:row.download.format,display:row.preview};
  }
  return pictures;
}
async function optionalCurrentManifest(fetcher,timeoutMs) {
  const controller=new AbortController();let timer;
  try{
    return await Promise.race([
      fetcher('data/citywide-media-20261028.json',{cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null),
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
  const [catalog,current]=await Promise.all([historicalRequest,optionalCurrentManifest(fetcher,currentTimeoutMs)]);
  // An unavailable or invalid new edition must leave the historical gallery usable.
  if(current?.schema!=='future-mississauga-current-citywide-media/v1')return catalog;
  try{return integrateCurrentCitywide(catalog,current.image,baseURL);}catch{return catalog;}
}
export const mediaCatalog=loadMediaCatalog();
const catalogIndex = mediaCatalog.then(catalog=>indexMedia(catalog));
export async function resolveMedia(url){return (await catalogIndex).get(clean(url));}
export async function refreshPictureAssets(pictures){return refreshCatalogPictures(pictures,await mediaCatalog);}
export async function installResponsiveImages(){
  const index=await catalogIndex;
  const apply=image=>{
    if(image.closest('dialog'))return;
    const row=index.get(clean(image.getAttribute('src')||''));if(!row)return;
    if(image.dataset.responsiveMedia===row.preview.url)return;
    image.dataset.responsiveMedia=row.preview.url;
    image.src=row.preview.url;
    image.srcset=`${row.preview.url} ${row.preview.width}w, ${row.responsive.url} ${row.responsive.width}w, ${row.displayMaster.url} ${row.displayMaster.width}w`;
    image.sizes=image.closest('.social-grid')?'(max-width: 640px) calc(100vw - 44px), (max-width: 1000px) calc((100vw - 80px)/2), calc((100vw - 120px)/3)':image.closest('.gallery-grid,.render-pair')?'(max-width: 600px) calc(100vw - 44px), calc((100vw - 120px)/2)':'calc(100vw - 80px)';
    const card=image.closest('.social-grid article');
    if(card){card.dataset.displayUrl=row.displayMaster.url;card.dataset.displayWidth=row.displayMaster.width;card.dataset.displayHeight=row.displayMaster.height;}
  };
  const scan=root=>{if(root instanceof HTMLImageElement)apply(root);root.querySelectorAll?.('img').forEach(apply);};
  scan(document);
  document.querySelectorAll('a[href]').forEach(anchor=>{
    const row=index.get(clean(anchor.href));if(!row)return;
    if(anchor.hasAttribute('download')||anchor.classList.contains('save')||anchor.querySelector('img'))anchor.href=row.download.url;
  });
  new MutationObserver(records=>{
    for(const record of records){if(record.type==='attributes')apply(record.target);else record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node);});}
  }).observe(document.querySelector('main')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
}
