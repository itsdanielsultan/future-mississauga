import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {fitPerspectiveBox} from '../public/model-preview-framing.js';
test('wide low facade fills more of the preview while every corner fits desktop and phone',()=>{
 const size=[156.3740234375,10.830802917480469,139.93115234375],direction=[1,.18,.2];
 for(const aspect of [2.1,1.4,1,.55]){
  const distance=fitPerspectiveBox(size,direction,35,aspect),camera=new THREE.PerspectiveCamera(35,aspect,.1,50000);
  camera.position.copy(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const points=[];for(const x of [-size[0]/2,size[0]/2])for(const y of [-size[1]/2,size[1]/2])for(const z of [-size[2]/2,size[2]/2])points.push(new THREE.Vector3(x,y,z).project(camera));
  assert(points.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1));assert(Math.max(...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))>.7);
  const oldDistance=Math.hypot(...size)/2/Math.sin(Math.min(35*Math.PI/180,2*Math.atan(Math.tan(35*Math.PI/360)*aspect))/2)*1.08;
  assert(distance<oldDistance*.97,'Box fit reduces spherical padding at every viewport');
  if(aspect>=1.4)assert(distance<oldDistance*.75,'Wide viewers gain at least a quarter of their previous framing distance');
 }
});
test('invalid preview framing fails explicitly',()=>{for(const args of [[[1,2,3],[0,0,0],35,1],[[1,2,3],[1,0,1],35,0],[[1,-2,3],[1,0,1],35,1]])assert.throws(()=>fitPerspectiveBox(...args));});
