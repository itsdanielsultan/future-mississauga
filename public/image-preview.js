// A shared image viewer. Downloads remain separate, explicit links.
export const shortResolution = width => Math.round(width / 1000) + 'K PNG';
export function shortDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '';
  return new Intl.DateTimeFormat('en-CA', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}

let nextId = 0;
export function createImagePreview({views = false} = {}) {
  const id = 'picturePreview' + ++nextId;
  const dialog = document.createElement('dialog');
  dialog.className = 'media-preview';
  dialog.setAttribute('aria-labelledby', id+'Title');
  dialog.innerHTML = `<div class="media-preview__shell">
    <header class="media-preview__header"><div><h2 id="${id}Title"></h2><p class="media-preview__meta"></p></div>
    <label class="media-preview__view" ${views?'':'hidden'}>View <select aria-label="Picture view"></select></label>
    <button type="button" class="media-preview__close" aria-label="Close picture">×</button></header>
    <div class="media-preview__stage" aria-busy="true"><img alt=""><p class="media-preview__status" role="status" hidden></p></div>
    <div class="media-preview__details"><p class="media-preview__description"></p>
    <footer class="media-preview__footer"><a class="media-preview__download" download>Download PNG</a><a class="media-preview__explore" hidden>Explore in 3D</a><span class="media-preview__credits"><a class="media-preview__osm" href="https://www.openstreetmap.org/copyright" hidden>OpenStreetMap</a><a href="sources.html">Sources &amp; credits</a></span></footer>
    <details class="media-preview__notes" hidden><summary>About this image</summary><p></p></details></div></div>`;
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
    const items=[...dialog.querySelectorAll('button,select,a[href],summary')].filter(x=>!x.disabled&&x.getClientRects().length);
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
  });
  select.onchange=()=>onView?.(select.value);
  function show(info, trigger) {
    const token=++request;
    if(trigger)opener=trigger;
    dialog.querySelector('h2').textContent=info.title||'Picture';
    const meta=dialog.querySelector('.media-preview__meta');meta.textContent=info.meta||'';meta.hidden=!info.meta;
    const description=dialog.querySelector('.media-preview__description');description.textContent=info.description||'';description.hidden=!info.description;
    const notes=dialog.querySelector('.media-preview__notes');notes.hidden=!info.notes;notes.open=false;notes.querySelector('p').textContent=info.notes||'';
    const download=dialog.querySelector('[download]');download.href=info.download;download.download=new URL(info.download,location.href).pathname.split('/').pop();
    const format=download.download.split('.').pop().toUpperCase();download.textContent=['PNG','JPG','JPEG','SVG','AVIF','WEBP'].includes(format)?'Download '+format:'Download image';
    const explore=dialog.querySelector('.media-preview__explore');explore.hidden=!info.explore;if(info.explore)explore.href=info.explore;
    dialog.querySelector('.media-preview__osm').hidden=!info.osm;
    dialog.classList.toggle('media-preview--portrait',info.height>info.width);
    dialog.style.setProperty('--media-aspect',String((info.width||1200)/(info.height||750))); 
    image.alt=info.alt||info.title||'Picture';image.width=info.width||1200;image.height=info.height||750;
    image.removeAttribute('srcset');image.hidden=false;image.src=info.preview||info.src;
    stage.setAttribute('aria-busy','true');status.textContent='Loading full-resolution image…';status.hidden=false;
    const native=new Image();
    native.onload=()=>{if(token!==request)return;image.src=info.src;image.hidden=false;status.hidden=true;stage.setAttribute('aria-busy','false');};
    native.onerror=()=>{if(token!==request)return;status.textContent='The full-resolution image could not load. Please try the download.';stage.setAttribute('aria-busy','false');};
    native.src=info.src;
    if(!dialog.open)dialog.showModal();
    document.documentElement.classList.add('picture-preview-open');
  }
  return {dialog,show,setViews(items,value,callback){select.replaceChildren(...items.map(x=>{const o=document.createElement('option');o.value=x.value;o.textContent=x.label;return o;}));select.value=value;onView=callback;select.closest('label').hidden=items.length<2;}};
}

let generic;
export function installImagePreviews(resolve = async image => ({src:image.currentSrc||image.src,download:image.currentSrc||image.src})) {
  document.addEventListener('click',async event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const trigger=event.target.closest('a,button');
    const image=event.target.closest('main img')||trigger?.querySelector('main img, img');
    if(!image?.closest('main'))return;
    if(!image||image.closest('dialog,.picture-compare,.social-grid,[data-open],.site-brand'))return;
    const anchor=image.closest('a');
    event.preventDefault();event.stopPropagation();
    generic ||= createImagePreview();
    const info=await resolve(image,anchor);
    const section=image.closest('article,section');
    const heading=section?.querySelector('h2,h3')?.textContent?.trim();
    const title=image.dataset.previewTitle||anchor?.dataset.previewTitle||heading||(image.alt.length<=70?image.alt:'Image preview');
    generic.show({title:title||'Picture',alt:image.alt,width:image.naturalWidth,height:image.naturalHeight,preview:image.currentSrc||image.src,...info},anchor||image.closest('button')||image);
  });
  const enhance=()=>document.querySelectorAll('main img').forEach(image=>{
    if(image.closest('dialog,.picture-compare,.social-grid,[data-open],.site-brand'))return;
    const anchor=image.closest('a');
    if(anchor){anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-label','Preview '+(image.alt||'picture'));}
    else if(!image.closest('button')){const button=document.createElement('button');button.type='button';button.className='image-preview-trigger';button.setAttribute('aria-label','Preview '+(image.alt||'picture'));button.setAttribute('aria-haspopup','dialog');image.replaceWith(button);button.append(image);}
  });
  enhance();
}
