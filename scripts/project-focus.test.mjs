import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {createCoverageController,groundFootprint,footprintCovered}=await import('../public/coverage-controller.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url));
const districts=JSON.parse(read('data/districts.json')),project=JSON.parse(read('data/projects.json')).find(p=>p.id==='harborn-50-60');
const asset=JSON.parse(read('data/refinement-models.json')).assets.find(a=>a.projectId===project.id),bytes=gunzipSync(read(asset.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'0e5224cfbe2598d3eab0094599e5e225e874e260ff3d8a4cf5a03cf085d30d25');
globalThis.self??=globalThis;globalThis.createImageBitmap??=async()=>({width:16,height:8,close(){}});
const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,meshes=[];
model.traverse(m=>{if(m.isMesh){m.userData.localReview=asset.localReview;meshes.push(m);}});model.updateMatrixWorld(true);
const sourceAttributes=meshes.map(m=>Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,a])=>[k,Array.from(a.array??a.data.array)])));
const actual=new THREE.Box3().setFromObject(model),centre=actual.getCenter(new THREE.Vector3()),size=actual.getSize(new THREE.Vector3());
const app=read('app.js').toString(),source=app.slice(app.indexOf('function frameProject(p,meshes){'),app.indexOf('async function focusProject(p)'));
function harness(width,height,panelWidth=360){
 const camera=new THREE.PerspectiveCamera(35,width/height,1,160000),controls={target:new THREE.Vector3(-2210.4702576575787,86.89330291748047,2095.7304506311566),minDistance:100};
 camera.position.set(-2210.4702576575787,372.3301178355683,2461.0729134054077);
 const direction=camera.position.clone().sub(controls.target).normalize(),related=districts.filter(d=>['cooksville','erindale','downtown','port-credit','dixie-applewood'].includes(d.id)),coverage=createCoverageController({THREE,camera,controls});
 const ground=Math.min(...related.map(d=>d.geometryBounds[0][1])),ceiling=Math.max(...related.map(d=>d.center[1]));coverage.setCoverage({district:related.find(d=>d.id==='cooksville'),rectangles:related.map(d=>d.bounds),ground,ceiling});
 const state={THREE,model,context:null,meshes,p:{...project,position:[9999,9999,9999]},camera,controls,cameraCoverage:coverage,canvas:{getBoundingClientRect:()=>({width,height})},$:()=>({hidden:false,getBoundingClientRect:()=>({width:panelWidth})}),getComputedStyle:()=>({position:width>700?'absolute':'static'})};
 const frame=runInNewContext(source+';frameProject(p,meshes)',state);camera.position.copy(frame.position);controls.target.copy(frame.target);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
 return {camera,controls,coverage,frame,direction,ground,ceiling};
}
test('Harborn focus uses the loaded model and stays in its central bounds on desktop and phone',()=>{
 assert.equal(meshes.length,207);assert.equal(asset.localReview,true);
 for(const [width,height]of [[1910,838],[390,650]]){
  const {camera,controls,frame,direction}=harness(width,height);
  if(width>700)assert(camera.position.distanceTo(controls.target)<330,'loaded detailed asset must not inherit generic minimum framing distance');
  for(const axis of ['x','y','z'])assert(Math.abs(controls.target[axis]-centre[axis])<=size[axis]*.200001,'orbit anchor must stay with the actual project, not padding or registry position');
  assert(camera.position.clone().sub(controls.target).normalize().distanceTo(direction)<1e-9);
  for(const x of [actual.min.x,actual.max.x])for(const y of [actual.min.y,actual.max.y])for(const z of [actual.min.z,actual.max.z]){
   const p=new THREE.Vector3(x,y,z).project(camera),px=(p.x+1)*width/2,py=(1-p.y)*height/2;
   assert(px>=frame.viewport.left&&px<=frame.viewport.right&&py>=frame.viewport.top&&py<=frame.viewport.bottom,'complete model fits the unobscured viewport');
  }
  const projected=centre.clone().project(camera);if(width>700)assert(projected.x<0,'right-side panel offset puts the project left of canvas centre');
 }
 meshes.forEach((m,i)=>{for(const [name,a]of Object.entries(m.geometry.attributes))assert.deepEqual(Array.from(a.array??a.data.array),sourceAttributes[i][name]);});
});
test('zooming a low project keeps its anchor below the district ceiling without exposing unloaded ground',()=>{
 const s=harness(1910,838);s.coverage.constrain();const anchor=s.controls.target.clone();assert(anchor.y<s.ceiling);
 for(const factor of [1.3,1.3,1.3,.8,.8,.8,.8]){
  s.camera.position.sub(anchor).multiplyScalar(factor).add(anchor);s.coverage.constrain();
  assert(s.controls.target.distanceTo(anchor)<1e-8,'zoom must retain the building anchor');
  for(const y of [s.ground,s.ceiling])assert(footprintCovered(groundFootprint(THREE,s.camera.position,s.controls.target,{aspect:s.camera.aspect,fov:s.camera.fov,ground:y}),s.coverage.coverage));
  assert(s.camera.position.y>s.ceiling);
 }
});
test('a new constrained low-rise frame preserves its requested elevation rather than raising it to surrounding hills',()=>{
 const s=harness(1910,838),target=centre.clone(),position=target.clone().addScaledVector(s.direction,2200);
 const frame=s.coverage.constrainFrame({target,position});assert.equal(frame.target.y,target.y);assert(frame.position.y>s.ceiling);
 for(const y of [s.ground,s.ceiling])assert(footprintCovered(groundFootprint(THREE,frame.position,frame.target,{aspect:s.camera.aspect,fov:s.camera.fov,ground:y}),s.coverage.coverage));
});

test('focus applies the loaded study asset’s close-zoom policy without changing the project record',()=>{
 const source=app.match(/controls\.minDistance=p\.localReview\|\|meshes\.some\(mesh=>mesh\.userData\.localReview\)\?20:100;/)[0],controls={};
 runInNewContext(source,{p:project,meshes,controls});assert.equal(controls.minDistance,20);assert.equal(project.localReview,undefined);
 runInNewContext(source,{p:{},meshes:[],controls});assert.equal(controls.minDistance,100);
});
