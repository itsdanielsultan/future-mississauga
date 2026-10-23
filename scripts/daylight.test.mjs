import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createDaylight} from '../public/daylight.js';

test('close-up shadows retain nearby ground and building roof after a long camera move',()=>{
 const scene=new THREE.Scene(),renderer={setClearColor(){},shadowMap:{}};
 const daylight=createDaylight(THREE,scene,renderer);
 const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3(-754,18,4391);
 camera.position.copy(target).add(new THREE.Vector3(60,60,60));
 daylight.update(target,camera,2500);
 const closeWidth=daylight.sun.shadow.camera.right-daylight.sun.shadow.camera.left;
 assert.ok(closeWidth<500,'the close-up should not reuse a district-sized shadow map');
 for(const offset of [[0,-10,0],[0,40,0],[25,0,25],[-25,0,-25]]){
  scene.updateMatrixWorld(true);daylight.sun.shadow.updateMatrices(daylight.sun);
  const point=target.clone().add(new THREE.Vector3(...offset)).project(daylight.sun.shadow.camera);
  assert.ok([point.x,point.y,point.z].every(v=>v>=-1&&v<=1),'local ground/roof must remain inside shadow projection');
 }
 const nextTarget=new THREE.Vector3(4800,80,-3200);camera.position.copy(nextTarget).add(new THREE.Vector3(4000,5000,4000));
 daylight.update(nextTarget,camera,6000);
 assert.deepEqual(daylight.sun.target.position.toArray(),nextTarget.toArray());
 assert.ok(daylight.sun.shadow.camera.right>1000,'wide views regain wide shadow coverage');
 assert.equal(renderer.shadowMap.type,THREE.PCFShadowMap);
 assert.equal(daylight.sun.shadow.mapSize.width,4096);
});
