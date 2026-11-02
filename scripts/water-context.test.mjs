import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {createCityContext,cityContextBudget}=await import('../public/city-context.js');
const districts=JSON.parse(readFileSync(new URL('../public/data/districts.json',import.meta.url)));
const port=districts.find(d=>d.id==='port-credit');
const sourceURL='models/context-parts/citywide-context-01.glb';
const sourcePins={
 [sourceURL]:'3b90bcae4940cc7942c435c2dbe92a6f8fe053da6ac21ddf7d783cf327468cda',
 'models/port-credit-context.glb':'36982577e966f0603ee96adf82298ae1639ed19c90a9727adf9a80bcdc2d53be',
};
async function loadSource(url){const bytes=readFileSync(new URL('../public/'+url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sourcePins[url]);const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
function hits(mesh,[x,z]){return new THREE.Raycaster(new THREE.Vector3(x,1000,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh).map(hit=>hit.point.toArray());}
function controller(load,urls=[sourceURL]){const scene=new THREE.Scene();return {scene,context:createCityContext({THREE,scene,renderer:{},loader:{loadAsync:load},contextURLs:urls,classify:d=>d.Status,overrides:{},styleExisting(){},resourceBudget:cityContextBudget({coarsePointer:true})})};}

test('original city water fills the real Port Credit band gap without adding geometry or water on land',async()=>{
 const wider=await loadSource(sourceURL),detail=await loadSource('models/port-credit-context.glb');
 wider.scene.updateMatrixWorld(true);detail.scene.updateMatrixWorld(true);
 const lake=wider.scene.getObjectByName('LakeOntarioUnified'),near=detail.scene.getObjectByName('LakeOntarioUnified');
 lake.material.side=near.material.side=THREE.DoubleSide;
 for(const point of [[900,4000],[700,4200],[0,5000]]){
  assert(point[0]>port.bounds[0]&&point[0]<port.bounds[2]&&point[1]>port.bounds[1]&&point[1]<port.bounds[3]);
  assert.deepEqual(hits(near,point),[],'The narrow source really lacks this water');
  assert.deepEqual(hits(lake,point),[[point[0],5,point[1]]],'The broader original source already supplies it');
 }
 for(const point of [[0,3000],[-1200,4500],[-2000,3000]])assert.deepEqual(hits(lake,point),[],'Source coastline still excludes dry land');
 const geometry=lake.geometry,vertices=[...geometry.attributes.position.array],index=[...geometry.index.array],transform=lake.matrixWorld.toArray();
 const requests=[],{context}=controller(async url=>{requests.push(url);return url===sourceURL?wider:{scene:new THREE.Group()};});
 context.setDistrict(port);await context.setEnabled(true);
 assert.deepEqual(requests,[sourceURL,'models/citywide.glb'],'No additional asset request');
 assert.equal(lake.geometry,geometry);assert.deepEqual([...geometry.attributes.position.array],vertices);assert.deepEqual([...geometry.index.array],index);assert.deepEqual(lake.matrixWorld.toArray(),transform);
 assert.equal(lake.material.clippingPlanes,null);assert.equal(lake.material.depthTest,true);assert.equal(lake.material.depthWrite,false);assert.equal(lake.renderOrder,-1);assert.equal(lake.material.roughness,.35,'Matches the detailed source water finish');
 // Both sources coincide at the retained native 5m water plane. Drawing the
 // wider source first without depth writes lets detailed water replace it.
 assert.deepEqual(hits(lake,[-700,5000]),hits(near,[-700,5000]));assert.deepEqual(hits(lake,[-700,5000]),[[-700,5,5000]]);assert.equal(near.material.depthWrite,true);assert(lake.renderOrder<near.renderOrder);
 wider.scene.traverse(o=>{if(o.isMesh&&o!==lake)assert.equal(o.material.clippingPlanes.length,4,'Other context keeps its geographic mask')});
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);await context.setEnabled(false);assert.equal(context.ready,false);assert.equal(disposed,0,'Coastal base water remains available with surrounding buildings off');assert.equal(lake.parent.name,'Original lake water');assert.equal(lake.parent.visible,true);context.setDistrict({...port,id:'citywide'});assert.equal(disposed,1,'Citywide already has its own water');
});

test('continuous lake handling is limited to its exact source file and mesh identity',async()=>{
 for(const [url,name] of [['other-water.glb','LakeOntarioUnified'],[sourceURL,'River'],[sourceURL,'terrain']]){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());mesh.name=name;
  const group=new THREE.Group();group.add(mesh);
  const {context}=controller(async path=>({scene:path===url?group:new THREE.Group()}),[url]);
  context.setDistrict(port);await context.setEnabled(true);assert.equal(mesh.material.clippingPlanes.length,4);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.renderOrder,0);await context.setEnabled(false);
 }
});

function lakePackage(){
 const source=new THREE.Group(),lake=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial()),ground=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 lake.name='LakeOntarioUnified';lake.rotation.x=-Math.PI/2;lake.position.y=5;ground.name='terrain';source.add(lake,ground);return {scene:source,lake,ground};
}
test('a cold explicit-off coastal entry loads only the bounded source package and retains only original water',async()=>{
 const calls=[],packages=[];let landDisposed=0;
 const {context,scene}=controller(async url=>{calls.push(url);const pkg=lakePackage();pkg.ground.geometry.addEventListener('dispose',()=>landDisposed++);packages.push(pkg);return pkg;});
 context.setDistrict(port);assert.deepEqual(calls,[],'Default initial load does not duplicate the normal wider request');
 await context.setEnabled(false);assert.deepEqual(calls,[sourceURL]);assert.equal(landDisposed,1);assert.equal(context.enabled,false);assert.equal(context.ready,false);assert.deepEqual(context.detailedBounds,[]);
 const overview=scene.children.find(o=>o.name==='Surrounding city overview'),water=scene.children.find(o=>o.name==='Original lake water');
 assert.equal(overview.visible,false);assert.equal(overview.children.length,0);assert.equal(water.children.length,1);assert.equal(water.children[0],packages[0].lake);assert.equal(water.visible,true);
 await context.setEnabled(false);assert.equal(calls.length,1,'Repeated off does not fetch again');
 context.setDistrict({...port,id:'lakeview'});assert.equal(water.children.length,1,'Adjacent coastal view reuses the same original water');
 context.setDistrict({...port,id:'downtown'});assert.equal(water.children.length,0);assert.equal(water.visible,false);
});
test('off during the source decode adopts only its lake and does not request the rest of the city',async()=>{
 let finish;const calls=[],pkg=lakePackage();let landDisposed=0;pkg.ground.geometry.addEventListener('dispose',()=>landDisposed++);
 const {context,scene}=controller(url=>{calls.push(url);return new Promise(resolve=>{finish=resolve;});},[sourceURL,'unused-context.glb']);
 context.setDistrict(port);const enabled=context.setEnabled(true);await Promise.resolve();const disabled=context.setEnabled(false);finish(pkg);await Promise.all([enabled,disabled]);
 assert.deepEqual(calls,[sourceURL]);assert.equal(landDisposed,1);assert.equal(context.ready,false);assert.equal(context.enabled,false);
 assert.equal(scene.children.find(o=>o.name==='Surrounding city overview').children.length,0);assert.equal(scene.children.find(o=>o.name==='Original lake water').children[0],pkg.lake);
});
test('a late cold water request cannot add water to a newer inland or Citywide selection',async()=>{
 for(const id of ['downtown','citywide']){
  let finish;const pkg=lakePackage();let disposed=0;pkg.lake.geometry.addEventListener('dispose',()=>disposed++);
  const {context,scene}=controller(()=>new Promise(resolve=>{finish=resolve;}));context.setDistrict(port);const task=context.setEnabled(false);context.setDistrict({...port,id});finish(pkg);await task;
  const water=scene.children.find(o=>o.name==='Original lake water');assert.equal(water.children.length,0);assert.equal(water.visible,false);assert.equal(disposed,1);
 }
});
test('re-enabling surrounding city never duplicates or replaces retained base water',async()=>{
 const calls=[],packages=[];
 const {context,scene}=controller(async url=>{calls.push(url);if(url==='models/citywide.glb')return {scene:new THREE.Group()};const pkg=lakePackage();packages.push(pkg);return pkg;});
 context.setDistrict(port);await context.setEnabled(false);const first=packages[0].lake;
 await context.setEnabled(true);assert.equal(context.ready,true);const water=scene.children.find(o=>o.name==='Original lake water');assert.deepEqual(water.children,[first]);assert.equal(packages[1].lake.parent,null);
 await context.setEnabled(false);assert.equal(context.ready,false);assert.deepEqual(water.children,[first]);assert.equal(water.visible,true);assert.equal(scene.children.find(o=>o.name==='Surrounding city overview').children.length,0);
 assert.deepEqual(calls,[sourceURL,sourceURL,'models/citywide.glb']);
});
