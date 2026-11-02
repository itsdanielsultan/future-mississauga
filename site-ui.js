const header=document.querySelector('.site-header');
if(header){
 const toggle=header.querySelector('.site-menu-toggle'),nav=header.querySelector('.site-nav');
 header.dataset.menuReady='';
 const setOpen=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.toggleAttribute('data-open',open);};
 toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setOpen(false);toggle.focus();}});
 nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
 const current=location.pathname.split('/').pop()||'index.html';
 const destinations={
  'index.html':'./#pictures','social.html':'./#pictures',
  'explore.html':'explore.html',
  'model.html':'model.html','review-renders.html':'model.html','reference-updates.html':'model.html','accuracy-review.html':'model.html',
  'updates.html':'updates.html','sources.html':'sources.html'
 };
 for(const link of nav.querySelectorAll('a')){
  if(link.getAttribute('href')===destinations[current])link.setAttribute('aria-current',current==='social.html'||['review-renders.html','reference-updates.html','accuracy-review.html'].includes(current)?'location':'page');
  else link.removeAttribute('aria-current');
 }
}
