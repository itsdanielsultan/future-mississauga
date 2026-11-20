// Media Chrome progressively enhances the native video controls.
try {
 // The controller must be defined before an external control bar associates with it.
 await import('./vendor/media-chrome-4.19.2/media-controller.js');
 await Promise.all(['media-control-bar','media-play-button','media-time-range','media-time-display','media-loading-indicator'].map(name=>import(`./vendor/media-chrome-4.19.2/${name}.js`)));
 const player=document.querySelector('#skylinePlayer'),video=document.querySelector('#skylineVideo'),film=document.querySelector('#skylineFilm');
 if(player&&video&&film){
  player.dataset.enhanced='';film.dataset.enhanced='';video.controls=false;
  document.querySelector('#replayFilm').addEventListener('click',()=>{video.currentTime=0;video.play().catch(()=>{});});
  const label=()=>player.querySelector('.film-big-play').setAttribute('aria-label',video.ended?'Replay skyline film':video.paused?'Play skyline film':'Pause skyline film');
  ['play','pause','ended'].forEach(event=>video.addEventListener(event,label));label();
  const expand=document.querySelector('#expandFilm');let inerted=[],previousOverflow='',returnFocus=null,pending=false,fallbackTimer;
  const expanded=()=>film.classList.contains('is-theater')||document.fullscreenElement===film;
  const update=()=>{expand.setAttribute('aria-expanded',String(expanded()));expand.setAttribute('aria-label',expanded()?'Exit expanded video':'Expand video');};
  const leaveTheater=()=>{
   if(!film.classList.contains('is-theater'))return;
   film.classList.remove('is-theater');film.removeAttribute('role');film.removeAttribute('aria-modal');film.removeAttribute('aria-label');
   inerted.forEach(([node,wasInert])=>node.inert=wasInert);inerted=[];document.body.style.overflow=previousOverflow;
  };
  const enterTheater=()=>{
   if(document.fullscreenElement===film||film.classList.contains('is-theater')){update();return;}
   previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';film.classList.add('is-theater');film.setAttribute('role','dialog');film.setAttribute('aria-modal','true');film.setAttribute('aria-label','Expanded skyline film. Press Escape to close.');
   let node=film;while(node.parentElement&&node!==document.body){for(const sibling of node.parentElement.children){if(sibling!==node&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){inerted.push([sibling,sibling.inert]);sibling.inert=true;}}node=node.parentElement;}
   update();expand.focus({preventScroll:true});
  };
  const exit=async()=>{
   clearTimeout(fallbackTimer);pending=false;
   if(document.fullscreenElement===film)await document.exitFullscreen().catch(()=>{});
   leaveTheater();update();returnFocus?.focus({preventScroll:true});
  };
  expand.addEventListener('click',()=>{
   if(expanded()){exit();return;}if(pending)return;
   pending=true;returnFocus=document.activeElement;
   // Some embedded browsers reject or silently ignore the fullscreen request.
   // A full-window view remains available without a dead fullscreen button.
   fallbackTimer=setTimeout(()=>{pending=false;enterTheater();},700);
   try{
    if(!film.requestFullscreen)throw new Error('Fullscreen unavailable');
    Promise.resolve(film.requestFullscreen()).then(()=>{pending=false;clearTimeout(fallbackTimer);if(document.fullscreenElement===film){leaveTheater();update();}else enterTheater();}).catch(()=>{pending=false;clearTimeout(fallbackTimer);enterTheater();});
   }catch{pending=false;clearTimeout(fallbackTimer);enterTheater();}
  });
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===film){clearTimeout(fallbackTimer);pending=false;leaveTheater();}update();});
  film.addEventListener('keydown',e=>{
   if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopPropagation();expand.click();return;}
   if(e.key==='Escape'&&expanded()){e.preventDefault();e.stopPropagation();exit();return;}
   if(e.key!=='Tab'||!film.classList.contains('is-theater'))return;
   const stops=[...film.querySelectorAll('button,[tabindex="0"],a[href]')].filter(el=>el.getClientRects().length&&!el.hasAttribute('disabled'));
   const first=stops[0],last=stops.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  },true);
 }
} catch(error) {
 console.warn('Custom video controls unavailable; native playback controls remain available.',error);
}
