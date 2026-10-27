import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const frame=app.slice(app.indexOf('function frameProject(p,meshes){'),app.indexOf('async function focusProject(p)'));
const resize=app.slice(app.indexOf('function resize(){'),app.indexOf('new ResizeObserver(resize)'));
function harness(){
 const model=new THREE.Group(),meshes=[-40,40].map(x=>{const m=new THREE.Mesh(new THREE.BoxGeometry(35,200,35));m.position.set(x,100,0);model.add(m);return m;});
 const camera=new THREE.PerspectiveCamera(35,1280/800,1,160000);camera.position.set(240,360,500);
 const target=new THREE.Vector3(0,100,0),controls={target,cursor:new THREE.Vector3(),update(){camera.lookAt(target);camera.updateMatrixWorld(true);}};controls.update();
 const wrap={clientWidth:1280,clientHeight:800},selection={hidden:false,getBoundingClientRect:()=>({width:350})};let size=new THREE.Vector2(1280,800);
 const state={THREE,model,context:null,camera,controls,wrap,framedProject:{id:'pair',localReview:true},current:{id:'downtown'},window:{atlasReady:'downtown'},innerHeight:800,homeFraming:null,
  canvas:{getBoundingClientRect:()=>({width:wrap.clientWidth,height:wrap.clientHeight})},$:()=>selection,
  getComputedStyle:()=>({position:wrap.clientWidth>700?'absolute':'static'}),projectMeshes:()=>meshes,
  document:{documentElement:{style:{setProperty(){}}}},getDrawingPolicy:()=>({pixelRatio:1}),cancelCameraFlight(){},invalidate(){},
  renderer:{getSize:vector=>vector.copy(size),getPixelRatio:()=>1,setPixelRatio(){},setSize:(w,h)=>size.set(w,h)}};
 runInNewContext(frame+'\n'+resize+'\nconst fitted=frameProject(framedProject,projectMeshes());controls.target.copy(fitted.target);camera.position.copy(fitted.position);controls.update();',state);
 return {state,meshes};
}
test('focused towers refit when the desktop selection panel moves beneath the phone map',()=>{
 const {state,meshes}=harness();state.wrap.clientWidth=390;state.wrap.clientHeight=650;runInNewContext('resize()',state);
 for(const mesh of meshes){const box=new THREE.Box3().setFromObject(mesh);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new THREE.Vector3(x,y,z).project(state.camera),px=(p.x+1)*195,py=(1-p.y)*325;
  assert(px>=18&&px<=372&&py>=94&&py<=612,'both complete buildings fit in the phone viewport');
 }}
});
test('resizing after deliberate camera navigation preserves the chosen camera position',()=>{
 const {state}=harness(),before=state.camera.position.clone();state.framedProject=null;state.wrap.clientWidth=390;state.wrap.clientHeight=650;runInNewContext('resize()',state);assert.deepEqual(state.camera.position.toArray(),before.toArray());
});
test('typing a new search cancels deferred URL focus before building details finish loading',()=>{
 const start=app.indexOf("modelSearchInput.addEventListener('input',"),end=app.indexOf("modelSearchInput.addEventListener('focus',",start);
 let onInput;const state={modelSearchInput:{addEventListener:(_,fn)=>onInput=fn},focusRequest:4,framedProject:{id:'old'},cancelCameraFlight(){},showModelSearch(){}};
 runInNewContext(app.slice(start,end),state);const pendingInitialRequest=state.focusRequest;onInput();assert.notEqual(state.focusRequest,pendingInitialRequest);assert.equal(state.framedProject,null);
});
