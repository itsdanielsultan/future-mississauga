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

test('shadow bias follows map resolution without a large close-up separation',async()=>{
 const {daylightShadowFrame,daylightShadowBias}=await import('../public/daylight.js');
 for(const distance of [60,150,1000,10000]){
  const frame=daylightShadowFrame({x:0,y:50,z:0},distance,6000),bias=daylightShadowBias(frame);
  assert.ok(bias.bias<0&&Number.isFinite(bias.bias));
  const displacement=-bias.bias*(frame.far-frame.near);
  assert.ok(displacement>=.04&&displacement<.4,'depth bias stays below forty centimetres even at city scale');
  assert.ok(bias.normalBias>=.18&&bias.normalBias<=.8,'normal bias remains sub-metre');
  if(distance<=150)assert.ok(bias.normalBias<.2,'close-up ground contacts should not float');
 }
});

test('thin mapped park surfaces keep their shape and receive tree shadows without self-shadow bands',async()=>{
 const {prepareMappedSurface}=await import('../public/surface-rendering.js');
 const geometry=new THREE.PlaneGeometry(100,60);geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshStandardMaterial({color:0x799960,vertexColors:true});
 for(const kind of ['Mapped playing field','Mapped sport surface','Mapped playground']){
  const mesh=new THREE.Mesh(geometry,material);mesh.userData={kind,sourceIds:[1234]};mesh.position.set(-3000,92,1400);mesh.castShadow=true;
  const before={position:mesh.position.toArray(),vertices:Array.from(geometry.attributes.position.array),colour:material.color.getHex(),metadata:JSON.stringify(mesh.userData)};
  assert.equal(prepareMappedSurface(mesh),true);
  assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,true);
  assert.deepEqual(mesh.position.toArray(),before.position);assert.deepEqual(Array.from(geometry.attributes.position.array),before.vertices);assert.equal(material.color.getHex(),before.colour);assert.equal(JSON.stringify(mesh.userData),before.metadata);
 }
 const building=new THREE.Mesh(new THREE.BoxGeometry(10,40,10),material);building.castShadow=true;building.receiveShadow=true;building.userData={kind:'Existing building'};
 assert.equal(prepareMappedSurface(building),false);assert.equal(building.castShadow,true);assert.equal(building.receiveShadow,true);
});
