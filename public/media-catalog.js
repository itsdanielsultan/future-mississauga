const clean = value => { const url=new URL(value,location.href);url.search='';url.hash='';return url.href; };
export const mediaCatalog = (async()=>{
  for(let attempt=0;attempt<2;attempt++){
    try{const response=await fetch('data/labelled-image-assets.json',{cache:'no-store'});if(response.ok)return await response.json();}catch{}
  }
  // Existing images and explicit downloads remain usable during a network failure.
  return {images:[]};
})();
const catalogIndex = mediaCatalog.then(catalog=>{
  const index=new Map();
  for(const row of catalog.images){
    for(const url of [...row.aliases,row.preview.url,row.responsive.url,row.displayMaster.url,row.download.url])index.set(clean(url),row);
  }
  return index;
});
export async function resolveMedia(url){return (await catalogIndex).get(clean(url));}
export async function refreshPictureAssets(pictures){
  const catalog=await mediaCatalog;
  for(const row of catalog.images.filter(row=>row.kind==='wide')){
    const original=pictures.images[row.file];if(!original)continue;
    pictures.images[row.file]={...original,url:row.download.url,sha256:row.download.sha256,bytes:row.download.bytes,display:row.preview,displayMaster:row.displayMaster,download:row.download,sourceAttribution:row.sourceAttribution};
  }
  return pictures;
}
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
