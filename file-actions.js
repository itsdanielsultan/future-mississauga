const icon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>';
export const isDirectDownload=anchor=>anchor?.matches('[data-download],.save,.download-icon,.file-download,.media-preview__download')||!!anchor?.querySelector('svg');
export function prepareImageLinks(root=document){
 for(const anchor of root.querySelectorAll('main a[href]')){
  const url=new URL(anchor.href,location.href);
  if(!/\.(png|jpe?g|webp|avif|svg)$/i.test(url.pathname)||anchor.querySelector('img')||anchor.closest('dialog')||anchor.hasAttribute('data-file-action'))continue;
  if(url.origin!==location.origin&&!(url.hostname==='github.com'&&url.pathname.startsWith('/itsdanielsultan/future-mississauga/releases/')))continue;
  anchor.dataset.fileAction='';
  if(isDirectDownload(anchor)){anchor.dataset.download='';continue;}
  const label=anchor.textContent.trim(),section=anchor.closest('section,article');
  const title=section?.querySelector('h2,h3')?.textContent?.trim()||label;
  const format=url.pathname.split('.').pop().toUpperCase();
  const downloadLabel='Download '+title+' '+(/neighbourhood/i.test(label)?'neighbourhood ':/exterior/i.test(label)?'exterior ':'')+format;
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
