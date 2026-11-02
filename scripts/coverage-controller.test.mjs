import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {neighbourhoodFrame,defaultViewDirection} from '../public/viewer-camera.js';
import {createCoverageController,constrainCoverageFrame,footprintCovered} from '../public/coverage-controller.js';
import {chooseNeighbourDistricts} from '../public/neighbour-context.js';
const districts=JSON.parse(readFileSync(new URL('../public/data/districts.json',import.meta.url)));
const district=id=>districts.find(d=>d.id===id);
function setup(d,aspect=1.6){
  const f=neighbourhoodFrame(THREE,d,aspect),camera=new THREE.PerspectiveCamera(35,aspect,1,160000);
  camera.position.copy(f.position);camera.lookAt(f.target);camera.updateMatrixWorld(true);
  const controls={target:f.target.clone(),minDistance:60};
  const controller=createCoverageController({THREE,camera,controls});controller.setCoverage({district:d});controller.constrain();
  return {camera,controls,controller};
}
function rays(camera,target,ground){
  camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-ground),ray=new THREE.Raycaster();
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
    ray.setFromCamera(new THREE.Vector2(x,y),camera);const p=ray.ray.intersectPlane(plane,new THREE.Vector3());
    assert.ok(p,'every visible ground ray points toward the ground');return [p.x,p.z];
  });
}
function check(s,d){
  const nominal=d.sourceCropCenter?.[1]??d.center[1],lower=Math.min(nominal,d.geometryBounds?.[0]?.[1]??nominal);
  for(const ground of [lower,(lower+nominal)/2,nominal])assert.ok(footprintCovered(rays(s.camera,s.controls.target,ground),s.controller.coverage),'actual rendered ground stays within loaded coverage at every source elevation reference');
}
const bearing=(e,b)=>new THREE.Vector3(Math.sin(b)*Math.cos(e),Math.sin(e),Math.cos(b)*Math.cos(e));

test('one zoom-out reproduces the old crop edge, and is constrained at desktop and phone widths',()=>{
  for(const id of ['streetsville','malton'])for(const aspect of [1.6,.62]){
    const d=district(id),s=setup(d,aspect),direction=s.camera.position.clone().sub(s.controls.target).normalize();
    s.camera.position.sub(s.controls.target).multiplyScalar(1.25).add(s.controls.target);
    assert.equal(footprintCovered(rays(s.camera,s.controls.target,d.center[1]),[d.bounds]),false);
    assert.equal(s.controller.constrain(),true);check(s,d);
    assert.ok(s.camera.position.clone().sub(s.controls.target).normalize().distanceTo(direction)<1e-9);
  }
});

test('Downtown repeated zoom-out keeps its anchor instead of moving to a larger neighbouring crop',()=>{
  for(const aspect of [.62,1.6]){
    const d=district('downtown'),s=setup(d,aspect),loaded=chooseNeighbourDistricts(d,districts);
    s.controller.setCoverage({district:d,rectangles:loaded.map(d=>d.bounds),ground:Math.min(d.geometryBounds[0][1],...loaded.map(d=>d.geometryBounds?.[0]?.[1]??d.center[1])),ceiling:Math.max(d.center[1],...loaded.map(d=>d.sourceCropCenter?.[1]??d.center[1]))});
    s.controller.constrain();const anchor=s.controls.target.clone(),direction=s.camera.position.clone().sub(anchor).normalize();
    for(let i=0;i<12;i++){
      s.camera.position.sub(s.controls.target).multiplyScalar(1.25).add(s.controls.target);s.controller.constrain();check(s,d);
      assert.ok(s.controls.target.distanceTo(anchor)<1e-8,'zoom target must not relocate to another source crop');
      assert.ok(s.camera.position.clone().sub(anchor).normalize().distanceTo(direction)<1e-8);
    }
  }
});

test('repeated zoom and pan requests stop at coverage without exposing a crop edge',()=>{
  for(const id of ['streetsville','malton'])for(const aspect of [1.6,.62]){
    const d=district(id),s=setup(d,aspect);
    for(let i=0;i<30;i++){
      s.camera.position.sub(s.controls.target).multiplyScalar(1.25).add(s.controls.target);s.controller.constrain();check(s,d);
      const offset=new THREE.Vector3((i%2?1:-1)*d.radius*.32,0,d.radius*.18);
      s.camera.position.add(offset);s.controls.target.add(offset);s.controller.constrain();check(s,d);
    }
  }
});

test('rotation and north changes preserve requested bearing and tilt while enforcing coverage',()=>{
  for(const aspect of [.62,1.6]){
    const d=district('streetsville'),s=setup(d,aspect);
    for(const elevation of [20,38,65,80])for(let degrees=0;degrees<360;degrees+=30){
      const direction=bearing(THREE.MathUtils.degToRad(elevation),THREE.MathUtils.degToRad(degrees));
      s.camera.position.copy(s.controls.target).addScaledVector(direction,2400);s.controller.constrain();check(s,d);
      assert.ok(s.camera.position.clone().sub(s.controls.target).normalize().distanceTo(direction)<1e-8,'constraint must not replace the requested view angle');
    }
  }
});

test('project framing and subsequent phone or wide resize use the same constraint',()=>{
  const d=district('malton'),s=setup(d),direction=defaultViewDirection(THREE);
  const target=new THREE.Vector3(d.bounds[0]+80,d.center[1]+120,d.bounds[1]+100);
  const frame=s.controller.constrainFrame({target,position:target.clone().addScaledVector(direction,2000)});
  s.controls.target.copy(frame.target);s.camera.position.copy(frame.position);s.controller.constrain();check(s,d);
  for(const aspect of [.48,2.4,.62,1.78]){s.camera.aspect=aspect;s.controller.constrain();check(s,d);}
  assert.ok(s.camera.position.clone().sub(s.controls.target).normalize().distanceTo(direction)<1e-8);
});

test('the full footprint may cross a seam only when both detailed crops have loaded',()=>{
  const active={id:'fixture',bounds:[0,0,1000,1000],center:[500,0,500]},other=[900,0,2000,1000];
  const wide={...active,bounds:[0,0,2000,1000]},frame=neighbourhoodFrame(THREE,wide,1.6);
  const s=setup(active);s.controller.setCoverage({district:active,rectangles:[other]});
  s.controls.target.copy(frame.target);s.camera.position.copy(frame.position);
  assert.equal(s.controller.constrain(),false);check(s,active);
  assert.equal(footprintCovered(rays(s.camera,s.controls.target,0),[active.bounds]),false);
  s.controller.setCoverage({district:active});assert.equal(s.controller.constrain(),true);check(s,active);
});

test('corner coverage does not hide an unloaded gap or concave notch in the centre',()=>{
  const square=[[0,0],[10,0],[10,10],[0,10]];
  const withHole=[[0,0,3,10],[7,0,10,10],[0,0,10,3],[0,7,10,10]];
  assert.equal(square.every(([x,z])=>withHole.some(b=>x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3])),true);
  assert.equal(footprintCovered(square,withHole),false);
  assert.equal(footprintCovered(square,[[0,0,5,10],[5,0,10,10]]),true);
  assert.equal(footprintCovered(square,[[0,0,5,10],[5,4,10,10]]),false);
});

test('small pan and zoom input remains continuous at a rectangular coverage limit',()=>{
  const d=district('streetsville'),s=setup(d);
  for(let i=0;i<120;i++){
    const before=s.camera.position.clone(),targetBefore=s.controls.target.clone(),delta=new THREE.Vector3(25,0,0);
    s.camera.position.add(delta);s.controls.target.add(delta);s.controller.constrain();check(s,d);
    assert.ok(s.camera.position.distanceTo(before)<25.001,'pan clamps continuously instead of jumping to centre');
    assert.ok(s.controls.target.distanceTo(targetBefore)<25.001);
  }
  for(let i=0;i<40;i++){
    const before=s.camera.position.distanceTo(s.controls.target);
    s.camera.position.sub(s.controls.target).multiplyScalar(1.01).add(s.controls.target);s.controller.constrain();check(s,d);
    const after=s.camera.position.distanceTo(s.controls.target);
    assert.ok(after<=before*1.01001 && after>=before*.99999,'zoom approaches a stable limit');
  }
});

test('idle constraint is stable and never rewrites projection or OrbitControls settings',()=>{
  const d=district('malton'),s=setup(d),projection=s.camera.projectionMatrix.clone();
  const target=s.controls.target.clone(),position=s.camera.position.clone();
  for(let i=0;i<10;i++)assert.equal(s.controller.constrain(),false);
  assert.deepEqual(s.camera.position,position);assert.deepEqual(s.controls.target,target);
  assert.deepEqual(s.camera.projectionMatrix,projection);assert.equal(s.controls.minDistance,60);
  assert.ok(Math.abs(s.camera.position.clone().sub(target).normalize().y-Math.sin(38*Math.PI/180))<1e-8);
});

test('full-city overview and clearing do not invent a rectangular city boundary',()=>{
  const s=setup(district('streetsville'));s.controller.setCoverage({district:district('citywide')});
  const target=s.controls.target.clone(),position=s.camera.position.clone();position.multiplyScalar(20);s.camera.position.copy(position);
  assert.equal(s.controller.constrain(),false);assert.deepEqual(s.camera.position,position);assert.deepEqual(s.controls.target,target);
  s.controller.clear();assert.deepEqual(s.controller.coverage,[]);
});

test('invalid or repeated neighbour bounds cannot invent extra coverage',()=>{
  const d=district('malton'),s=setup(d);
  s.controller.setCoverage({district:d,rectangles:[d.bounds,[NaN,0,3,4],[0,0,-1,5],null]});
  assert.deepEqual(s.controller.coverage,[d.bounds]);
});

test('a disconnected loaded district cannot permit travel through an unloaded gap',()=>{
  const d={id:'source',bounds:[0,0,1000,1000],center:[500,0,500]},s=setup(d);
  s.controller.setCoverage({district:d,rectangles:[[1000.01,0,2000,1000]]});
  assert.deepEqual(s.controller.coverage,[d.bounds]);
  s.controller.setCoverage({district:d,rectangles:[[1000.01,0,2000,1000],[900,0,1100,1000]]});
  assert.equal(s.controller.coverage.length,3,'a committed bridging crop makes the union continuous');
});

test('very high project targets still have a finite fallback within available source coverage',()=>{
  const b=[0,0,1000,1000],target=new THREE.Vector3(990,900,990),direction=defaultViewDirection(THREE);
  const result=constrainCoverageFrame(THREE,{target,position:target.clone().addScaledVector(direction,4000)},{rectangles:[b],ground:0,aspect:1.6});
  const camera=new THREE.PerspectiveCamera(35,1.6,1,160000);camera.position.copy(result.position);
  assert.ok(footprintCovered(rays(camera,result.target,0),[b]));
  assert.ok(result.position.toArray().every(Number.isFinite));
  assert.ok(result.position.clone().sub(result.target).normalize().distanceTo(direction)<1e-8);
});

test('actual OrbitControls zoom, pan and rotation with damping share the same pre-render limit',async()=>{
  // Resolve the browser import-map name for Node without changing vendor code.
  const controlsSource=readFileSync(new URL('../public/vendor/addons/controls/OrbitControls.js',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../public/vendor/three.module.js',import.meta.url).href}'`);
  const {OrbitControls}=await import('data:text/javascript;base64,'+Buffer.from(controlsSource).toString('base64'));
  for(const aspect of [.62,1.6]){
    const d=district('malton'),s=setup(d,aspect),controls=new OrbitControls(s.camera,null);
    controls.domElement={clientWidth:800*aspect,clientHeight:800};controls.target.copy(s.controls.target);
    controls.enableDamping=true;controls.dampingFactor=.08;controls.screenSpacePanning=false;
    controls.minDistance=60;controls.maxPolarAngle=Math.PI*.39;controls.minPolarAngle=Math.PI/18;
    const controller=createCoverageController({THREE,camera:s.camera,controls});controller.setCoverage({district:d});
    controls.addEventListener('change',()=>controller.constrain());
    const scene={camera:s.camera,controls,controller};
    for(let step=0;step<18;step++){
      controls.dollyOut(.8);check(scene,d);
      controls.pan(100,-40);check(scene,d);
      controls.rotateLeft(.17);check(scene,d);
      for(let frame=0;frame<8;frame++){controls.update();controller.constrain();check(scene,d);}
    }
    for(let frame=0;frame<180;frame++){controls.update();controller.constrain();}
    check(scene,d);assert.equal(controller.constrain(),false);
  }
});

test('the actual area overview action preserves neighbourhood angle and retains full-city overview',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const body=app.slice(app.indexOf('function fitStudyArea('),app.indexOf('\n\nfunction reset('));
  for(const id of ['streetsville','malton','citywide']){
    const current=district(id),frame=neighbourhoodFrame(THREE,current,1.6),camera=new THREE.PerspectiveCamera(35,1.6,1,160000),calls=[];
    camera.position.copy(frame.position);const controls={target:frame.target.clone(),cursor:new THREE.Vector3(),update(){camera.lookAt(this.target);}};
    const sandbox={THREE,current,camera,controls,markers:[],markerFocusVersion:0,mode:'future',reset:direction=>calls.push(direction),cancelCameraFlight(){},settleControls(){},applyVisibility(){},invalidate(){}};
    vm.createContext(sandbox);vm.runInContext(body+'\nfitStudyArea();',sandbox);
    if(id==='citywide'){
      assert.equal(calls.length,0);assert.equal(sandbox.homeFraming,'study');assert.equal(controls.maxTargetRadius,Infinity);
      assert.ok(camera.position.distanceTo(controls.target)>current.radius);
    }else{assert.equal(calls.length,1);assert.ok(calls[0].distanceTo(defaultViewDirection(THREE))<1e-9);}
  }
});
