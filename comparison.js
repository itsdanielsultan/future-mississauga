export function bindComparison({panel,handle,input,onChange,initial=50,min=0,max=100}) {
 let value=initial,active=null;
 const set=n=>{value=Math.max(min,Math.min(max,n));input.value=String(value);handle.style.left=value+'%';handle.setAttribute('aria-valuenow',String(Math.round(value)));handle.setAttribute('aria-valuetext',Math.round(value)+' percent existing context');onChange(value);};
 const move=e=>{const r=panel.getBoundingClientRect();set((e.clientX-r.left)/r.width*100);};
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();active=e.pointerId;handle.setPointerCapture(e.pointerId);move(e);});
 handle.addEventListener('pointermove',e=>{if(active===e.pointerId)move(e);});
 const finish=e=>{if(active!==e.pointerId)return;active=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',()=>active=null);
 handle.addEventListener('keydown',e=>{const step=e.shiftKey?10:1;const next={ArrowLeft:value-step,ArrowDown:value-step,ArrowRight:value+step,ArrowUp:value+step,Home:min,End:max}[e.key];if(next!==undefined){e.preventDefault();set(next);}});
 input.addEventListener('input',()=>set(Number(input.value)));set(initial);return {set};
}
