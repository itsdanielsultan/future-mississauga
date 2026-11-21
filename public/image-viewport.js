// Image inspection uses the original pixels. Zoom only changes the viewing window.
export function imageViewportGeometry(width,height,spaceWidth,spaceHeight,scale=1,x=0,y=0){
 const fit=Math.min(Math.max(1,spaceWidth)/Math.max(1,width),Math.max(1,spaceHeight)/Math.max(1,height));
 const fittedWidth=width*fit,fittedHeight=height*fit,maxScale=Math.max(2,1/fit);
 const zoom=Math.min(maxScale,Math.max(1,scale));
 const limitX=Math.max(0,(fittedWidth*zoom-spaceWidth)/2),limitY=Math.max(0,(fittedHeight*zoom-spaceHeight)/2);
 return {width:fittedWidth,height:fittedHeight,scale:zoom,maxScale,x:limitX?Math.max(-limitX,Math.min(limitX,x)):0,y:limitY?Math.max(-limitY,Math.min(limitY,y)):0,pixelScale:fit*zoom};
}

export function bindImageViewport({stage,image,zoomIn,zoomOut,fitButton,readout,onNavigate}){
 let width=1200,height=750,scale=1,x=0,y=0,geometry=null,pointers=new Map(),gesture=null;
 let swipeStart=null;
 let lastWheelTime=-Infinity, horizontalTravel=0, swiped=false;
 const available=()=>({width:Math.max(1,stage.clientWidth-24),height:Math.max(1,stage.clientHeight-24)});
 function render(){
  const space=available();geometry=imageViewportGeometry(width,height,space.width,space.height,scale,x,y);
  ({scale,x,y}=geometry);image.style.width=geometry.width+'px';image.style.height=geometry.height+'px';
  image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  stage.classList.toggle('is-zoomed',scale>1.001);zoomOut.disabled=scale<=1.001;zoomIn.disabled=scale>=geometry.maxScale-.001;
  fitButton.setAttribute('aria-pressed',String(scale<=1.001));
  readout.textContent=Math.round(geometry.pixelScale*100)+'%';
  stage.setAttribute('aria-label',scale>1.001?'Image detail. Drag or use arrow keys to pan. Use plus and minus to zoom, or zero to fit.':'Image preview. Use plus to inspect details, or the zoom controls.');
 }
 function zoom(next,anchor={x:0,y:0}){
  const old=scale;scale=Math.max(1,Math.min(geometry?.maxScale||8,next));
  x=anchor.x-(anchor.x-x)*scale/old;y=anchor.y-(anchor.y-y)*scale/old;render();
 }
 const reset=()=>{scale=1;x=0;y=0;render();};
 zoomIn.addEventListener('click',()=>zoom(scale*1.5));zoomOut.addEventListener('click',()=>zoom(scale/1.5));fitButton.addEventListener('click',reset);
 const local=e=>{const rect=stage.getBoundingClientRect();return {x:e.clientX-rect.left-rect.width/2,y:e.clientY-rect.top-rect.height/2};};
 const pinch=()=>{const [a,b]=[...pointers.values()];return {distance:Math.hypot(b.x-a.x,b.y-a.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
 function startGesture(){
  if(pointers.size===2){const p=pinch();gesture={...p,scale,xOffset:x,yOffset:y};}
  else if(pointers.size===1){const p=[...pointers.values()][0];gesture={...p,xOffset:x,yOffset:y};}
  else gesture=null;
 }
 stage.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;stage.focus({preventScroll:true});pointers.set(e.pointerId,local(e));
  swipeStart = e.pointerType === 'touch' && pointers.size === 1 && scale <= 1.001 ? local(e) : null;
  stage.setPointerCapture(e.pointerId);startGesture();
 });
 stage.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,local(e));
  if(pointers.size===2&&gesture?.distance){
   const p=pinch();scale=Math.max(1,Math.min(geometry.maxScale,gesture.scale*p.distance/Math.max(1,gesture.distance)));
   x=p.x-(gesture.x-gesture.xOffset)*scale/gesture.scale;y=p.y-(gesture.y-gesture.yOffset)*scale/gesture.scale;render();
  }else if(pointers.size===1&&scale>1&&gesture){const p=local(e);x=gesture.xOffset+p.x-gesture.x;y=gesture.yOffset+p.y-gesture.y;render();}
 });
 const finish=e=>{
  const start=swipeStart;swipeStart=null;
  let direction=0;
  if(e.type==='pointerup' && start && pointers.has(e.pointerId) && pointers.size===1 && scale<=1.001){
   const end=local(e),dx=end.x-start.x,dy=end.y-start.y;
   if(Math.abs(dx)>=Math.max(44,Math.min(76,stage.clientWidth*.12)) && Math.abs(dx)>1.5*Math.abs(dy))direction=dx<0?1:-1;
  }
  pointers.delete(e.pointerId);if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);startGesture();if(direction)onNavigate?.(direction);};
 stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',finish);stage.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);startGesture();});
 stage.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.timeStamp-lastWheelTime>170){horizontalTravel=0;swiped=false;}
  lastWheelTime=e.timeStamp;
  // A trackpad swipe delivers many wheel events, including a decaying tail.
  // Keep one picture per gesture, even after its neighbour has finished loading.
  if(swiped&&!e.ctrlKey)return;
  const units=e.deltaMode===1?16:e.deltaMode===2?stage.clientWidth:1;
  if(!e.ctrlKey&&Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.4){
   if(scale>1.001){x-=e.deltaX*units;render();return;}
   horizontalTravel+=e.deltaX*units;
   if(Math.abs(horizontalTravel)>=48){
    swiped=true;
    onNavigate?.(Math.sign(horizontalTravel));
   }
   return;
  }
  horizontalTravel=0;
  zoom(scale*Math.exp(-Math.max(-120,Math.min(120,e.deltaY*units))*.004),local(e));
 },{passive:false});
 stage.addEventListener('dblclick',e=>{e.preventDefault();scale>1.001?reset():zoom(Math.min(2.5,geometry.maxScale),local(e));});
 stage.addEventListener('keydown',e=>{
  if(e.target!==stage)return;
  if(['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
  if(e.key==='+'||e.key==='=')zoom(scale*1.5);else if(e.key==='-')zoom(scale/1.5);else if(e.key==='0'||e.key==='Home')reset();
  else if(scale<=1.001 && (e.key==='ArrowLeft'||e.key==='ArrowRight'))onNavigate?.(e.key==='ArrowRight'?1:-1);
  else if(scale>1){const step=e.shiftKey?100:40;if(e.key==='ArrowLeft')x+=step;if(e.key==='ArrowRight')x-=step;if(e.key==='ArrowUp')y+=step;if(e.key==='ArrowDown')y-=step;render();}
 });
 if('ResizeObserver' in globalThis)new ResizeObserver(render).observe(stage);
 return {setImage(info,{resetView=true}={}){width=info.width||1200;height=info.height||750;pointers.clear();gesture=null;swipeStart=null;if(resetView){scale=1;x=0;y=0;}render();},reset,refresh:render};
}
