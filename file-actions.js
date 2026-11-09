import {assetURL} from './asset-delivery.js?v=20261109-delivery1';
import {deliveryPaths} from './asset-delivery-map.js?v=20261109-delivery1';
const icon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>';
const deliveredImages=new Set(Object.keys(deliveryPaths).filter(path=>/\.(png|jpe?g|webp|avif|svg)$/i.test(path)).map(path=>assetURL(path)));
export function isDeliveredImageURL(value,baseURL=globalThis.location?.href||'https://futuremississauga.com/'){
 try{return deliveredImages.has(new URL(value,baseURL).href);}catch{return false;}
}
export const isDirectDownload=anchor=>anchor?.matches('[data-download],.save,.download-icon,.file-download,.media-preview__download')||!!anchor?.querySelector('svg');
// Cross-origin download attributes are ignored by browsers. Save only exact
// pinned image destinations as local blobs, after verifying the content hash.
export async function saveManagedImage(value,{fetcher=fetch,doc=document,urlAPI=URL,defer=setTimeout}={}){
 const url=assetURL(value),parsed=new URL(url);
 if(!isDeliveredImageURL(url)||!parsed.pathname.endsWith('.png'))throw new Error('Unregistered image download');
 const expected=parsed.pathname.split('/')[2];
 if(!/^[a-f0-9]{64}$/.test(expected))throw new Error('Image content hash missing');
 const response=await fetcher(url,{mode:'cors',credentials:'omit',redirect:'error'});
 if(!response.ok)throw new Error('Image download failed');
 const bytes=await response.arrayBuffer();
 const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
 if(actual!==expected)throw new Error('Image download bytes did not match');
 const blobURL=urlAPI.createObjectURL(new Blob([bytes],{type:'image/png'}));
 const download=doc.createElement('a');download.href=blobURL;download.download=parsed.pathname.split('/').pop();download.hidden=true;
 try{doc.body.append(download);download.click();}
 finally{download.remove();defer(()=>urlAPI.revokeObjectURL(blobURL),30000);}
}
const downloadOwner=Symbol.for('future-mississauga.managed-image-downloads');
export function installManagedImageDownloads(root=document){
 const doc=root.ownerDocument||root;if(!doc.addEventListener||doc[downloadOwner])return;
 doc[downloadOwner]=true;const pending=new WeakSet(),messages=new WeakMap();
 doc.addEventListener('click',async event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const anchor=event.target.closest('a[href]');
  if(!anchor||(!anchor.hasAttribute('download')&&!anchor.hasAttribute('data-download')))return;
  const url=assetURL(anchor.href);if(!isDeliveredImageURL(url)||!new URL(url).pathname.endsWith('.png'))return;
  event.preventDefault();if(pending.has(anchor))return;
  pending.add(anchor);messages.get(anchor)?.remove();anchor.setAttribute('aria-busy','true');
  try{await saveManagedImage(url,{doc});}
  catch{
   const message=doc.createElement('span');message.className='file-download-status';message.setAttribute('role','status');
   message.textContent='The image could not be downloaded. Try again, or open the download link in a new tab to save it.';
   anchor.after(message);messages.set(anchor,message);
  }finally{pending.delete(anchor);anchor.removeAttribute('aria-busy');}
 });
}
export function prepareImageLinks(root=document){
 installManagedImageDownloads(root);
 for(const anchor of root.querySelectorAll('main a[href]')){
  const url=new URL(anchor.href,location.href);
  if(!/\.(png|jpe?g|webp|avif|svg)$/i.test(url.pathname)||anchor.querySelector('img')||anchor.closest('dialog')||anchor.hasAttribute('data-file-action'))continue;
  if(url.origin!==location.origin&&!(url.hostname==='github.com'&&url.pathname.startsWith('/itsdanielsultan/future-mississauga/releases/'))&&!isDeliveredImageURL(url.href))continue;
  anchor.href=assetURL(anchor.href);
  anchor.dataset.fileAction='';
  if(isDirectDownload(anchor)){anchor.dataset.download='';continue;}
  const label=anchor.textContent.trim(),section=anchor.closest('section,article');
  const title=anchor.dataset.previewTitle||anchor.closest('figure')?.querySelector('figcaption b,figcaption strong')?.textContent?.trim()||section?.querySelector('h2,h3')?.textContent?.trim()||label.replace(/^(?:Download\s*)+/i,'').replace(/[↓↧]/g,'').replace(/\b(?:PNG|JPG|JPEG|WEBP|AVIF|SVG)\b/gi,'').trim();
  const format=url.pathname.split('.').pop().toUpperCase();
  const downloadLabel=['Download',title,/neighbourhood/i.test(label)?'neighbourhood':/exterior/i.test(label)?'exterior':'',format].filter(Boolean).join(' ');
  if(/^Download\b/i.test(label)){
   anchor.classList.add('file-download');anchor.dataset.download='';anchor.setAttribute('aria-label',downloadLabel);anchor.title=downloadLabel;anchor.innerHTML=icon;continue;
  }
  anchor.removeAttribute('download');anchor.setAttribute('aria-haspopup','dialog');
  if(label==='Exterior PNG')anchor.textContent='Exterior view';
  if(label==='Neighbourhood PNG')anchor.textContent='Neighbourhood view';
  const pair=document.createElement('span');pair.className='file-action-pair';anchor.replaceWith(pair);pair.append(anchor);
  const download=document.createElement('a');download.href=anchor.href;download.download=url.pathname.split('/').pop();download.dataset.download='';download.className='file-download';download.setAttribute('aria-label',downloadLabel);download.title=downloadLabel;download.innerHTML=icon;pair.append(download);
 }
}
