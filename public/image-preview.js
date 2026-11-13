import {assetURL} from './asset-delivery.js?v=20261109-delivery1';
import {isDirectDownload,prepareImageLinks,isDeliveredImageURL,installManagedImageDownloads} from './file-actions.js?v=20261112-ui1';
import {cityMapLinkForSection} from './image-provenance.js?v=20261101-gallery1';
import {mediaPreviewInfo,imageAttribution,mediaScenarioLabel} from './clean-media.js?v=20261109-feedback1';
export {shortResolution,shortDate} from './image-provenance.js?v=20261101-gallery1';
// A shared image viewer. Downloads remain separate, explicit links.

export function renderImageAttribution(container,attribution={},doc=document){
 const nodes=[];
 const addText=value=>{if(!value)return;const span=doc.createElement('span');span.textContent=value;nodes.push(span);};
 addText(attribution.cityCredit);
 if(attribution.openStreetMap){const link=doc.createElement('a');link.href='https://www.openstreetmap.org/copyright';link.textContent='© OpenStreetMap';nodes.push(link);}
 for(const credit of attribution.requiredModelCredits||[])addText(credit);
 const sources=doc.createElement('a');sources.textContent='Sources';
 let url;try{url=new URL(attribution.sourcesURL||'sources.html',location.href);}catch{}
 sources.href=url&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'sources.html';nodes.push(sources);
 container.replaceChildren(...nodes);
}

// Reuse the existing caption region. Only accepted clean-v2 pixels take this path;
// historical cards retain their original text and all dedicated downloads survive.
const comparisonMedia=new WeakMap();
export function presentationCaption(info,doc=document){
 const nodes=[],presentation=info.presentation;
 if(info.creator){const byline=doc.createElement('span');byline.className='media-caption__creator';byline.textContent='by '+info.creator;nodes.push(byline);}
 if(presentation){
  const key=doc.createElement('span');key.className='media-caption__key';key.setAttribute('aria-label','Massing colours; detailed facades retain their materials');
  const label=doc.createElement('span');label.className='media-caption__key-label';label.textContent='Massing colours · Detailed finishes retained';key.append(label);
  for(const item of presentation.legend){const label=doc.createElement('span'),swatch=doc.createElement('i');swatch.style.backgroundColor=item.color;swatch.setAttribute('aria-hidden','true');label.append(swatch,doc.createTextNode(item.label));key.append(label);}
  const north=doc.createElement('span');north.className='media-caption__north';north.setAttribute('aria-label','North');
  const arrow=doc.createElement('span');arrow.textContent='↑';arrow.style.transform=`rotate(${presentation.northDegrees}deg)`;arrow.setAttribute('aria-hidden','true');north.append(arrow,doc.createTextNode('N'));key.append(north);nodes.push(key);
 }
 return nodes;
}
function updateComparisonCaption(panel,image,row){
 let state=comparisonMedia.get(panel);
 if(!state){state={images:new Map(),caption:null};comparisonMedia.set(panel,state);}
 state.images.set(image,row);
 const clean=[...state.images.values()].filter(value=>value.cleanPresentation);
 if(!clean.length){state.caption?.remove();state.caption=null;return;}
 const current=clean.at(-1),rows=[...state.images.values()].filter(value=>value.area===current.area);
 const credits=rows.map(imageAttribution),attribution={...imageAttribution(current),openStreetMap:credits.some(value=>value.openStreetMap),requiredModelCredits:[...new Set(credits.flatMap(value=>value.requiredModelCredits))]};
 if(!state.caption){state.caption=document.createElement('div');state.caption.className='media-caption media-caption--comparison';panel.after(state.caption);}
 const title=document.createElement('strong');title.textContent=current.area;
 const source=document.createElement('span');source.className='media-caption__credits';renderImageAttribution(source,attribution);
 const info=mediaPreviewInfo(current),presentations=rows.filter(value=>value.cleanPresentation&&value.presentation).map(value=>value.presentation);
 if(presentations.length){
  // Both scenarios share one key, irrespective of image loading order. The
  // existing scene alone cannot describe the future member's lifecycle colours.
  const reference=presentations[0],legend=new Map();
  for(const presentation of presentations)for(const item of presentation.legend)legend.set(item.label+'|'+item.color,item);
  info.presentation={...reference,legend:[...legend.values()]};
 }
 // The slider already labels both scenarios. Its shared credit stays outside
 // both clipping layers and appears once at either end of the slider.
 state.caption.replaceChildren(title,...presentationCaption(info),source);
}
export function updateCleanImageCaption(image,row){
 const comparison=image.closest('.picture-compare');
 if(comparison){updateComparisonCaption(comparison,image,row);return;}
 if(!row.cleanPresentation)return;
 const info=mediaPreviewInfo(row),storyCopy=image.closest('.update-story')?.querySelector('.update-story-copy');
 if(storyCopy){
  // The dated story already has its own title and narrative. Keep the two-column
  // image/copy structure intact and add only its required source line.
  let credits=storyCopy.querySelector('.media-caption__credits');
  if(!credits){credits=document.createElement('span');credits.className='media-caption__credits';storyCopy.append(credits);}
  renderImageAttribution(credits,info.attribution);return;
 }
 const card=image.closest('.picture-card,.social-grid article'),figure=image.closest('figure');
 let copy=card?.querySelector('.card-caption > div,.card-copy')||figure?.querySelector('figcaption');
 if(!copy){copy=document.createElement('div');copy.className='media-caption';(image.closest('a,button,picture')||image).after(copy);}
 const title=copy.querySelector('h2,h3,strong,b')||document.createElement('strong');title.textContent=info.title;
 const scenario=document.createElement('span');scenario.className='media-caption__scenario';scenario.textContent=mediaScenarioLabel(row);
 const credits=document.createElement('span');credits.className='media-caption__credits';renderImageAttribution(credits,info.attribution);
 const downloads=[...copy.querySelectorAll('a[download],.save,[data-download]')];
 copy.classList.add('media-caption');copy.replaceChildren(title,...presentationCaption(info),scenario,credits,...downloads);
}

const previewCounter = Symbol.for('future-mississauga.preview-counter');
export function previewTitle(info,{views=false}={}){
 const title=info.title||'Picture';
 return !views&&info.scenario==='construction'?title+' · Dated construction':title;
}
export function createImagePreview({views = false} = {}) {
  installManagedImageDownloads();
  globalThis[previewCounter] = (globalThis[previewCounter] || 0) + 1;
  const id = 'picturePreview-' + globalThis[previewCounter];
  const dialog = document.createElement('dialog');
  dialog.className = 'media-preview';
  dialog.setAttribute('aria-labelledby', id+'Title');
  dialog.innerHTML = `<div class="media-preview__shell">
    <header class="media-preview__header"><div><h2 id="${id}Title"></h2><p class="media-preview__meta"></p></div>
    <label class="media-preview__view" ${views?'':'hidden'}>View <select class="ui-select" aria-label="Picture view"></select></label>
    <button type="button" class="media-preview__close ui-button" aria-label="Close picture" data-variant="ghost" data-size="icon"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
    <div class="media-preview__stage" aria-busy="true"><img alt=""><p class="media-preview__status" role="status" hidden></p></div>
    <footer class="media-preview__footer"><div class="media-preview__identity"></div><a class="media-preview__download ui-button" download data-variant="primary">Download PNG</a><a class="media-preview__explore" hidden>View in city map</a><span class="media-preview__credits"><a class="media-preview__osm" href="https://www.openstreetmap.org/copyright" hidden>OpenStreetMap</a><a href="sources.html">Sources &amp; credits</a></span></footer>
    </div>`;
  document.body.append(dialog);
  const image=dialog.querySelector('img'), stage=dialog.querySelector('.media-preview__stage'), status=dialog.querySelector('[role="status"]'), select=dialog.querySelector('select');
  let opener=null, request=0, backdropDown=false, onView=null;
  const inside=e=>{const r=dialog.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;};
  dialog.querySelector('button').onclick=()=>dialog.close();
  dialog.addEventListener('pointerdown',e=>backdropDown=e.target===dialog&&!inside(e));
  dialog.addEventListener('click',e=>{if(backdropDown&&e.target===dialog&&!inside(e))dialog.close();backdropDown=false;});
  dialog.addEventListener('close',()=>{request++;document.documentElement.classList.remove('picture-preview-open');opener?.focus({preventScroll:true});});
  dialog.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const items=[...dialog.querySelectorAll('button,select,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
  });
  select.onchange=()=>onView?.(select.value);
  function show(info, trigger) {
    const token=++request;
    if(trigger)opener=trigger;
    dialog.querySelector('h2').textContent=previewTitle(info,{views});
    const meta=dialog.querySelector('.media-preview__meta');meta.textContent=info.meta||'';meta.hidden=!info.meta;
    const download=dialog.querySelector('[download]');download.href=assetURL(info.download);download.download=new URL(info.download,location.href).pathname.split('/').pop();
    const format=download.download.split('.').pop().toUpperCase();download.textContent=['PNG','JPG','JPEG','SVG','AVIF','WEBP'].includes(format)?'Download '+format:'Download image';
    const explore=dialog.querySelector('.media-preview__explore');explore.hidden=!info.explore;if(info.explore)explore.href=info.explore;
    renderImageAttribution(dialog.querySelector('.media-preview__credits'),info.attribution||{openStreetMap:info.osm});
    const identity=dialog.querySelector('.media-preview__identity'),area=document.createElement('strong');area.textContent=info.title||'Future Mississauga';identity.replaceChildren(area,...presentationCaption(info));
    dialog.classList.toggle('media-preview--portrait',info.height>info.width);
    dialog.style.setProperty('--media-aspect',String((info.width||1200)/(info.height||750))); 
    image.alt=info.alt||info.title||'Picture';image.width=info.width||1200;image.height=info.height||750;
    image.removeAttribute('srcset');image.hidden=false;image.src=assetURL(info.preview||info.src);
    stage.setAttribute('aria-busy','true');status.textContent='Loading full-resolution image…';status.hidden=false;
    const native=new Image();
    native.onload=()=>{if(token!==request)return;image.src=assetURL(info.src);image.hidden=false;status.hidden=true;stage.setAttribute('aria-busy','false');};
    native.onerror=()=>{if(token!==request)return;status.textContent='The full-resolution image could not load. Please try the download.';stage.setAttribute('aria-busy','false');};
    native.src=assetURL(info.src);
    if(!dialog.open)dialog.showModal();
    document.documentElement.classList.add('picture-preview-open');
  }
  return {dialog,show,setViews(items,value,callback){select.replaceChildren(...items.map(x=>{const o=document.createElement('option');o.value=x.value;o.textContent=x.label;return o;}));select.value=value;onView=callback;select.closest('label').hidden=items.length<2;}};
}

// Show the known file immediately; optional metadata can refine the same open view.
export function createResolvedPreview(preview) {
  let pending = 0;
  preview.dialog.addEventListener('close', () => pending++);
  return async (fallback, resolve, trigger) => {
    const token = ++pending;
    preview.show(fallback, trigger);
    try {
      const info = await resolve();
      if (token === pending && preview.dialog.open && info) preview.show({...fallback, ...info});
    } catch {
      // The exact linked image and its download remain usable without metadata.
    }
  };
}

// A declared credited PNG stays available while optional catalogue data loads.
// It is only a fallback; validated catalogue metadata remains authoritative.
export function previewDownloadURL(anchor, fallback, baseURL = location.href) {
  const declared=anchor?.dataset?.previewDownload;
  if(!declared)return fallback;
  try {
    const base=new URL(baseURL),url=new URL(declared,base);
    const local=url.origin===base.origin;
    const hosted=url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&/^\/itsdanielsultan\/future-mississauga\/releases\/download\/[^/]+\/[^/]+\.png$/i.test(url.pathname);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!url.pathname.toLowerCase().endsWith('.png')||(!local&&!hosted&&!isDeliveredImageURL(url.href)))return fallback;
    return url.href;
  } catch {return fallback;}
}

let generic, openGeneric;
export function installImagePreviews(resolve = async (image,anchor) => {
  const src=image?.currentSrc||image?.src||anchor.href;
  return {src,download:previewDownloadURL(anchor,src)};
}) {
  document.addEventListener('click',async event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const trigger=event.target.closest('a,button'),anchor=trigger?.matches('a')?trigger:null;
    if(isDirectDownload(anchor))return;
    const clickedImage=event.target.closest('main img')||trigger?.querySelector('img');
    const fileLink=anchor&&/\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(anchor.href);
    if(!clickedImage&&!fileLink)return;
    if(!(clickedImage||anchor)?.closest('main'))return;
    if((clickedImage||anchor).closest('dialog,.picture-compare,.social-grid,[data-open],.site-brand'))return;
    event.preventDefault();event.stopPropagation();
    const section=(clickedImage||anchor).closest('article,section');
    const image=clickedImage||[...section?.querySelectorAll('img')||[]].find(img=>new URL(img.src).pathname===new URL(anchor.href).pathname);
    if (!generic) { generic=createImagePreview(); openGeneric=createResolvedPreview(generic); }
    const heading=section?.querySelector('h2,h3')?.textContent?.trim();
    const title=image?.dataset.previewTitle||anchor?.dataset.previewTitle||heading||(image?.alt?.length<=70?image.alt:'Image preview');
    const src=fileLink?anchor.href:image?.currentSrc||image?.src;
    openGeneric({title:title||'Picture',alt:image?.alt||title,src,download:previewDownloadURL(anchor,src),width:image?.naturalWidth||1200,height:image?.naturalHeight||800,preview:image?.currentSrc||image?.src,explore:cityMapLinkForSection(section,location.href)},()=>resolve(image,anchor),anchor||image?.closest('button')||image);

  });
  const enhance=()=>document.querySelectorAll('main img').forEach(image=>{
    if(image.closest('dialog,.picture-compare,.social-grid,[data-open],.site-brand'))return;
    const anchor=image.closest('a');
    if(anchor){anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-label','Preview '+(image.alt||'picture'));}
    else if(!image.closest('button')){const button=document.createElement('button');button.type='button';button.className='image-preview-trigger';button.setAttribute('aria-label','Preview '+(image.alt||'picture'));button.setAttribute('aria-haspopup','dialog');image.replaceWith(button);button.append(image);}
  });
  prepareImageLinks();
  enhance();
}
