const header=document.querySelector('.site-header');
if(header){
 const toggle=header.querySelector('.site-menu-toggle'),nav=header.querySelector('.site-nav');
 header.dataset.menuReady='';
 const setOpen=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.toggleAttribute('data-open',open);};
 toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
 header.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setOpen(false);toggle.focus();}});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
 const current=location.pathname.split('/').pop();
 if(current&&current!=='index.html')nav.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===current)a.setAttribute('aria-current','page');});
}
