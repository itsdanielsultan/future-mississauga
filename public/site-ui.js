const header=document.querySelector('.site-header');
if(header){
 const toggle=header.querySelector('.site-menu-toggle'),nav=header.querySelector('.site-nav');
 header.dataset.menuReady='';
 const setOpen=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.toggleAttribute('data-open',open);};
 toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
 header.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){setOpen(false);toggle.focus();}});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
 const current=location.pathname.split('/').pop(),home=!current||current==='index.html';
 const links=[...nav.querySelectorAll('a')];
 const sections=home?links.flatMap(link=>{
  const url=new URL(link.href),page=url.pathname.split('/').pop();
  const section=url.origin===location.origin&&(!page||page==='index.html')&&url.hash?document.getElementById(url.hash.slice(1)):null;
  return section?[{link,section}]:[];
 }).sort((a,b)=>a.section.offsetTop-b.section.offsetTop):[];
 const updateCurrentLink=()=>{
  // Opening navigation should not change the section the reader was viewing.
  if(home&&toggle.getAttribute('aria-expanded')==='true'&&toggle.getClientRects().length)return;
  let selected=home?links.find(link=>link.getAttribute('href')==='./#pictures'):null;
  if(home){
   // Match the visible sticky header and the page's anchor spacing.
   const boundary=Math.max(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,header.getBoundingClientRect().bottom+16)+1;
   for(const entry of sections){
    if(entry.section.getBoundingClientRect().top<=boundary)selected=entry.link;
   }
   if(window.scrollY>0&&window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2)selected=sections.at(-1)?.link||selected;
  }
  for(const link of links){
   const state=home?(link===selected?'location':null):link.getAttribute('href')===current?'page':current==='reference-updates.html'&&link.getAttribute('href')==='updates.html'?'location':null;
   if(state)link.setAttribute('aria-current',state);
   else link.removeAttribute('aria-current');
  }
 };
 let scheduled=false;
 const scheduleCurrentLink=()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;updateCurrentLink();});
 };
 updateCurrentLink();
 window.addEventListener('hashchange',scheduleCurrentLink);
 if(home){
  window.addEventListener('scroll',scheduleCurrentLink,{passive:true});
  window.addEventListener('resize',scheduleCurrentLink);
  window.addEventListener('load',scheduleCurrentLink);
  window.addEventListener('pageshow',scheduleCurrentLink);
  if('ResizeObserver'in window){
   const observer=new ResizeObserver(scheduleCurrentLink);
   observer.observe(document.querySelector('main')||document.body);
   observer.observe(header);
  }
 }
}
