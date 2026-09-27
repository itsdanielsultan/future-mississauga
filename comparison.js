export function bindComparison({panel,handle,input,onChange,initial=50,min=0,max=100,clickToJump=false}) {
 let value=initial,active=null;
 const set=n=>{value=Math.max(min,Math.min(max,n));input.value=String(value);handle.style.left=value+'%';handle.setAttribute('aria-valuenow',String(Math.round(value)));handle.setAttribute('aria-valuetext',Math.round(value)+' percent existing context');onChange(value);};
 const move=e=>{const r=panel.getBoundingClientRect();if(r.width)set((e.clientX-r.left)/r.width*100);};
 if(!handle.querySelector('svg'))handle.insertAdjacentHTML('beforeend','<svg class="compare-handle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M3 12h18"/></svg>');
 const target=clickToJump?panel:handle;
 target.addEventListener('pointerdown',e=>{if(e.button!==0||active!==null||handle.hidden)return;e.preventDefault();e.stopPropagation();active=e.pointerId;target.setPointerCapture(e.pointerId);handle.focus({preventScroll:true});move(e);});
 target.addEventListener('pointermove',e=>{if(active===e.pointerId){e.preventDefault();move(e);}});
 const finish=e=>{if(active!==e.pointerId)return;active=null;if(target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);};
 target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);target.addEventListener('lostpointercapture',()=>active=null);
 if(clickToJump)panel.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
 handle.addEventListener('keydown',e=>{const step=e.shiftKey?10:1;const next={ArrowLeft:value-step,ArrowDown:value-step,ArrowRight:value+step,ArrowUp:value+step,Home:min,End:max}[e.key];if(next!==undefined){e.preventDefault();set(next);}});
 input.addEventListener('input',()=>set(Number(input.value)));set(initial);return {set};
}
