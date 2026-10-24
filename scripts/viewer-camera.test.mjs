import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {neighbourhoodFrame} from '../public/viewer-camera.js';
const districts = JSON.parse(readFileSync(new URL('../public/data/districts.json',import.meta.url)));
test('default neighbourhood camera keeps the visible ground inside every study crop at wide and phone widths',()=>{
 for(const d of districts.filter(d=>d.id!=='citywide'))for(const aspect of [.48,1,1.78,2.4]){
  const frame=neighbourhoodFrame(THREE,d,aspect),camera=new THREE.PerspectiveCamera(35,aspect,1,160000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),-frame.target.y),ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),camera);assert.ok(ray.ray.intersectPlane(ground,point));assert.ok(point.x>d.bounds[0]&&point.x<d.bounds[2]&&point.z>d.bounds[1]&&point.z<d.bounds[3],`${d.id} ${aspect}: viewport must not show the rectangular cut edge`);}
  assert.ok(Math.abs(frame.position.x-frame.target.x)<1e-8,'north stays upright');
 }
});
test('rotated area transitions and portrait resize preserve bearing and tilt while keeping ground edges outside the frame',()=>{
 for(const elevation of [20,35,65,80])for(const bearing of [-165,45,130]){
  const e=THREE.MathUtils.degToRad(elevation),b=THREE.MathUtils.degToRad(bearing),direction=new THREE.Vector3(Math.sin(b)*Math.cos(e),Math.sin(e),Math.cos(b)*Math.cos(e));
  for(const id of ['streetsville','malton','east-credit-creditview'])for(const aspect of [1.78,.48]){
   const d=districts.find(d=>d.id===id),frame=neighbourhoodFrame(THREE,d,aspect,35,direction),actual=frame.position.clone().sub(frame.target).normalize();assert.ok(actual.distanceTo(direction)<1e-10,`${id}: map direction must survive the area change and resize`);
   const camera=new THREE.PerspectiveCamera(35,aspect,1,160000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);const ground=new THREE.Plane(new THREE.Vector3(0,1,0),-frame.target.y),ray=new THREE.Raycaster(),point=new THREE.Vector3();
   for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),camera);assert.ok(ray.ray.intersectPlane(ground,point));assert.ok(point.x>d.bounds[0]&&point.x<d.bounds[2]&&point.z>d.bounds[1]&&point.z<d.bounds[3],`${id} ${elevation} ${bearing} ${aspect}: rotated frame must not reveal cut edges`);}
  }
 }
});

test('the initial neighbourhood view looks forward from a high point instead of steeply down',()=>{
 const d=districts.find(d=>d.id==='east-credit-creditview'),frame=neighbourhoodFrame(THREE,d,1.78),offset=frame.position.clone().sub(frame.target);
 const elevation=THREE.MathUtils.radToDeg(Math.atan2(offset.y,Math.hypot(offset.x,offset.z)));
 assert.ok(elevation>=35&&elevation<=40,'initial view should sit in the reviewed 35 to 40 degree high-oblique range');
 assert.ok(Math.hypot(offset.x,offset.z)>offset.y,'the camera has more forward distance than height');
});
