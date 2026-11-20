import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector2, Vector4, PerspectiveCamera} from '../public/vendor/three.module.js';
import {captureViewerImage} from '../public/viewer-image-export.js';

function harness({limit=4096, drawingLimit=Infinity, rejectLarge=false, loseContext=false,failRestoreRender=false,width=356,height=579,pixelRatio=1.5}={}) {
  const size=new Vector2(width,height), viewport=new Vector4(2,3,350,570), scissor=new Vector4(1,2,177,579);
  const camera=new PerspectiveCamera(35,width/height,1,160000);camera.position.set(300,400,500);camera.lookAt(0,0,0);
  const originalCamera=camera.matrixWorld.clone(), originalProjection=camera.projectionMatrix.clone();
  const native=[Math.floor(width*pixelRatio),Math.floor(height*pixelRatio)],canvas={width:native[0],height:native[1]}, frames=[], copies=[];let ratio=pixelRatio, scissorTest=true, lost=false;
  const gl={MAX_VIEWPORT_DIMS:1,MAX_RENDERBUFFER_SIZE:2,getParameter:key=>key===1?[limit,limit]:limit,isContextLost:()=>lost,
    get drawingBufferWidth(){return Math.floor(canvas.width*Math.min(1,drawingLimit/Math.max(canvas.width,canvas.height)));},
    get drawingBufferHeight(){return Math.floor(canvas.height*Math.min(1,drawingLimit/Math.max(canvas.width,canvas.height)));}};
  const renderer={domElement:canvas,getContext:()=>gl,getSize:out=>out.copy(size),getPixelRatio:()=>ratio,
    getViewport:out=>out.copy(viewport),getScissor:out=>out.copy(scissor),getScissorTest:()=>scissorTest,
    setViewport:value=>viewport.copy(value),setScissor:value=>scissor.copy(value),setScissorTest:value=>{scissorTest=value;},
    setPixelRatio:value=>{ratio=value;},setSize(w,h,style){assert.equal(style,false);size.set(w,h);canvas.width=Math.floor(w*ratio);canvas.height=Math.floor(h*ratio);viewport.set(0,0,w,h);}};
  const render=()=>{frames.push([canvas.width,canvas.height]);if(size.y>height&&rejectLarge)throw new Error('Buffer refused');if(size.y>height&&loseContext)lost=true;if(failRestoreRender&&frames.length>1){viewport.set(0,0,99,99);scissor.set(0,0,50,99);scissorTest=false;throw new Error('Redraw failed');}};
  const createCanvas=()=>({width:0,height:0,getContext:()=>({drawImage(image,...args){copies.push({width:image.width,height:image.height,args});}})});
  const capture=()=>captureViewerImage({renderer,render,createCanvas,Vector2,Vector4});
  const restored=()=>{assert.deepEqual(size.toArray(),[width,height]);assert.equal(ratio,pixelRatio);assert.deepEqual(viewport.toArray(),[2,3,350,570]);assert.deepEqual(scissor.toArray(),[1,2,177,579]);assert.equal(scissorTest,true);assert.deepEqual(camera.matrixWorld,originalCamera);assert.deepEqual(camera.projectionMatrix,originalProjection);assert.deepEqual([canvas.width,canvas.height],native);};
  return {capture,restored,frames,copies};
}

test('phone export renders at 2048px and restores dimensions, ratio, viewport, scissor and camera',()=>{
  const run=harness(), result=run.capture();
  assert.deepEqual([result.canvas.width,result.canvas.height],[1259,2048]);assert.equal(result.reduced,false);
  assert.deepEqual(run.frames,[[1259,2048],[534,868]]);
  assert.deepEqual(run.copies,[{width:1259,height:2048,args:[0,0]}],'native render is copied without scaling');run.restored();
});
test('GPU limit is respected and reported without changing the ordinary rendering policy',()=>{
  const run=harness({limit:1024}), result=run.capture();assert.equal(result.canvas.height,1024);assert.equal(result.reduced,true);run.restored();
});
test('a rejected large buffer falls back to a fresh screen render and restores state',()=>{
  const run=harness({rejectLarge:true}),result=run.capture();assert.deepEqual([result.canvas.width,result.canvas.height],[534,868]);assert.equal(result.reduced,true);assert.equal(run.copies.length,1);run.restored();
});
test('context loss never copies or returns a blank image and still restores dimensions',()=>{
  const run=harness({loseContext:true});assert.throws(run.capture,/Graphics context unavailable/);assert.equal(run.copies.length,0);run.restored();
});

test('silent allocation shortfall falls back instead of stretching the smaller drawing buffer',()=>{
  const run=harness({drawingLimit:1024}),result=run.capture();
  assert.deepEqual([result.canvas.width,result.canvas.height],[534,868]);assert.equal(result.reduced,true);
  assert.deepEqual(run.frames,[[1259,2048],[534,868],[534,868]]);
  assert.deepEqual(run.copies,[{width:534,height:868,args:[0,0]}]);run.restored();
});
test('a shortfall at the native size reports failure without returning an upscaled image',()=>{
  const run=harness({drawingLimit:512});assert.throws(run.capture,/Image buffer size unavailable/);
  assert.equal(run.copies.length,0);run.restored();
});
test('a failed final redraw still restores viewport and scissor state',()=>{
  const run=harness({failRestoreRender:true});assert.throws(run.capture,/Redraw failed/);run.restored();
});

test('desktop export never reduces an existing drawing buffer larger than the phone target',()=>{
 const run=harness({width:1560,height:700,pixelRatio:1.5}),result=run.capture();
 assert.deepEqual([result.canvas.width,result.canvas.height],[2340,1050]);assert.equal(result.reduced,false);
 assert.deepEqual(run.frames,[[2340,1050],[2340,1050]]);run.restored();
});
