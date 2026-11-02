import {restorePreOHNVersions} from './offshore-context-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {register} from 'node:module';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {HARBORN_SCOPE,restoreHarbornRefinements,restoreHarbornVersions,harbornFingerprint} from './harborn-v4-scope.mjs';
import {applyModelVisibility} from '../public/model-visibility.js';
import {createModelAppearance} from '../public/model-appearance.js';
import {refinementInDistrict} from '../public/refinement-loading.js';
import {resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle} from '../public/model-status-materials.js';
import {cutGroundGeometry,createGroundSampler,prepareHarbornTerrain,loadBoundTerrainAsset,geometryPins,sha256} from '../public/harborn-terrain.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url));
const contract=JSON.parse(read('data/harborn-terrain-v4.json'));
const fetcher=async url=>new Response(read(url));
// Node lacks a bitmap decoder. The geometry test preserves all exact GLB bytes
// and parses materials, while image decoding itself is covered by browser QA.
globalThis.self??=globalThis;
globalThis.createImageBitmap??=async()=>({width:16,height:8,close(){}});
const loader=()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const load=(url,binding)=>loadBoundTerrainAsset(loader(),url,x=>x,binding,fetcher);
function meshOf(points,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(points.filter((_,i)=>i%3!==1),2));g.computeVertexNormals();if(indices)g.setIndex(indices);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial());m.updateMatrixWorld(true);return m;}
function planarArea(g){const p=g.attributes.position,ix=g.index;let sum=0;for(let i=0;i<(ix?.count??p.count);i+=3){const v=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);sum+=Math.abs((p.getX(v[1])-p.getX(v[0]))*(p.getZ(v[2])-p.getZ(v[0]))-(p.getZ(v[1])-p.getZ(v[0]))*(p.getX(v[2])-p.getX(v[0])))/2;}return sum;}
test('exact concave lot subtraction preserves attributes, material group and untouched triangles',()=>{
 const m=meshOf([0,0,0,10,10,0,10,20,10,0,10,10,20,0,0,21,0,0,20,0,1],[0,1,2,0,2,3,4,5,6]);m.geometry.addGroup(0,6,2);m.geometry.addGroup(6,3,4);const original=m.geometry,bytes=original.attributes.position.array.slice();const parts=[[[2,2],[8,2],[2,4]],[[8,2],[8,4],[2,4]],[[2,4],[4,4],[2,8]],[[4,4],[4,8],[2,8]]];
 const out=cutGroundGeometry(THREE,m,parts).geometry;assert.equal(planarArea(out),80.5);assert.deepEqual(original.attributes.position.array,bytes);assert.deepEqual(out.attributes.position.array.slice(0,bytes.length),bytes);assert.deepEqual(Array.from(out.index.array.slice(-3)),[4,5,6]);assert.equal(out.groups.at(-1).materialIndex,4);for(let i=7;i<out.attributes.position.count;i++){const p=out.attributes.position;assert(Math.abs(p.getY(i)-p.getX(i)-p.getZ(i))<1e-5);assert.equal(out.attributes.uv.getX(i),p.getX(i));assert.equal(out.attributes.uv.getY(i),p.getZ(i));}assert(!out.index.array.some(i=>i>=out.attributes.position.count));
});
test('dry-ground sampling chooses the visible top surface and bounds disclosed edge interpolation',()=>{
 const low=meshOf([0,1,0,1,1,0,0,1,1],[0,1,2]),high=meshOf([0,2,0,1,2,0,0,2,1],[0,1,2]),entries=[low,high].map((mesh,i)=>({mesh,binding:{url:'ground-'+i,node:{nodeIndex:i}}})),sample=createGroundSampler(THREE,entries,[[[0,0],[1,0],[0,1]]],.35);
 assert.equal(sample(.1,.1).y,2);const edge=sample(-.3,.1);assert.equal(edge.method,'nearest-dry-edge');assert(Math.abs(edge.distanceM-.3)<1e-12);assert.equal(sample(-.351,.1),null);assert.throws(()=>{high.visible=false;createGroundSampler(THREE,entries,[[[0,0],[1,0],[0,1]]],.35);},/hidden/);
});
test('source hash mismatch fails before parsing or accepting a changed native source',async()=>{let parsed=false;await assert.rejects(loadBoundTerrainAsset({parseAsync(){parsed=true;}},'x',x=>x,{bytes:1,sha256:'0'.repeat(64)},async()=>new Response(new Uint8Array([1]))),/bytes changed/);assert.equal(parsed,false);});
for(const district of ['cooksville','citywide'])test('actual '+district+' native ground clips once, protects zero weights and restores across scenarios',async()=>{
 const context=new THREE.Group(),seen=new Set();for(const binding of contract.ground.filter(b=>b.district===district)){if(seen.has(binding.url))continue;seen.add(binding.url);context.add((await load(binding.url,binding)).scene);}const candidate=(await load(contract.candidate.url,contract.candidate)).scene, nodes=[];candidate.traverse(o=>{if(o.isMesh)nodes.push(o);});assert.equal(nodes.length,207);
 const grounds=[];context.traverse(m=>{if(m.isMesh)grounds.push(m);});const sourceGround=new Map(grounds.map(m=>[m,{geometry:m.geometry,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,a])=>[k,a.array.slice()])),index:m.geometry.index.array.slice()}]));
 const original=new Map(nodes.map(m=>[m,{geometry:m.geometry,position:m.geometry.attributes.position.array.slice(),material:m.material}]));const weights=read(contract.weights.url),controller=await prepareHarbornTerrain(THREE,{context,candidate,contract,weights,district});
 for(const row of controller.audit.ground){const binding=contract.ground.find(b=>b.district===district&&b.url===row.source&&b.node.nodeIndex===row.node);assert.deepEqual(row.changedTriangles,binding.triangleIndicesInLot);}
 assert.equal(controller.audit.patches.length,5);assert.equal(controller.audit.ground.length,3);assert(controller.audit.fallbacks.length>0);assert(controller.audit.fallbacks.every(f=>f.distanceM<=.35&&f.method==='nearest-dry-edge'));
 for(const mode of ['future','existing','construction','future']){controller.update(mode,new Set([contract.assetId]));assert.equal(controller.active,mode==='future');for(const [m,before]of original){assert.equal(m.material,before.material);if(mode!=='future')assert.equal(m.geometry,before.geometry);else if(!controller.audit.patches.some(p=>p.name.replaceAll(' ','_')===m.name||p.name===m.name))assert.equal(m.geometry,before.geometry);}}
 const data=new DataView(weights.buffer,weights.byteOffset,weights.byteLength);for(const spec of contract.weights.meshes){const m=nodes.find(m=>m.name===spec.nodeName.replaceAll(' ','_')||m.name===spec.nodeName),before=original.get(m).position;for(let i=0;i<spec.vertexCount;i++){assert.equal(m.geometry.attributes.position.getX(i),before[i*3]);assert.equal(m.geometry.attributes.position.getZ(i),before[i*3+2]);if(data.getFloat32(spec.byteOffset+i*8,true)===0)assert.equal(m.geometry.attributes.position.getY(i),before[i*3+1]);}}
 for(const [m,before]of sourceGround){for(const[k,values]of Object.entries(before.attributes)){assert.deepEqual(before.geometry.attributes[k].array,values);assert.deepEqual(m.geometry.attributes[k].array.slice(0,values.length),values);}const pin=m.userData.terrainSource,changed=new Set(controller.audit.ground.find(r=>r.source===pin.url&&r.node===pin.nodes)?.changedTriangles||[]),after=m.geometry.index.array,triangles=new Set();for(let i=0;i<after.length;i+=3)triangles.add(Array.from(after.slice(i,i+3)).join(','));for(let i=0;i<before.index.length;i+=3)if(!changed.has(i/3))assert(triangles.has(Array.from(before.index.slice(i,i+3)).join(',')));}
 controller.update('future',new Set());assert.equal(controller.active,false);for(const[m,before]of original)assert.equal(m.geometry,before.geometry);controller.dispose();for(const[m,before]of sourceGround)assert.equal(m.geometry,before.geometry);
 if(process.env.HARBORN_AUDIT_DIR)writeFileSync(process.env.HARBORN_AUDIT_DIR+'/'+district+'-terrain-audit.json',JSON.stringify(controller.audit,null,2)+'\n');
});

test('effective clipping masks exclude hidden ground from the height sampler',()=>{
 const a=meshOf([0,1,0,1,1,0,0,1,1],[0,1,2]),b=meshOf([0,5,0,1,5,0,0,5,1],[0,1,2]);b.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-2)];
 const sample=createGroundSampler(THREE,[a,b].map((mesh,i)=>({mesh,binding:{url:'ground'+i,node:{nodeIndex:i}}})),[[[0,0],[1,0],[0,1]]],.35);assert.equal(sample(.1,.1).y,1);
});
test('accepted Harborn metadata is a single exact exception and leaves planning/source facts and every other model unchanged',()=>{
 const data=JSON.parse(read('data/refinement-models.json')),versions=JSON.parse(read('data/model-asset-versions.json'));assert.equal(harbornFingerprint(restoreHarbornRefinements(structuredClone(data))),HARBORN_SCOPE.priorRefinementsFingerprint);assert.equal(harbornFingerprint(restoreHarbornVersions(restorePreOHNVersions(versions))),HARBORN_SCOPE.priorVersionsFingerprint);
 for(const[f,hash]of Object.entries(HARBORN_SCOPE.facts))assert.equal(createHash('sha256').update(read('data/'+f)).digest('hex'),hash,f);const a=data.assets.find(a=>a.id===contract.assetId);assert.deepEqual(a.modes,['future']);assert.equal(a.status,'Proposed');assert.deepEqual(a.replacementFootprintsXZ,HARBORN_SCOPE.oldValues.replacementFootprintsXZ??a.replacementFootprintsXZ);assert.deepEqual(a.viewerDistricts,['citywide','cooksville']);assert(a.preserveMaterials&&a.preserveSourceNormals);assert.equal(contract.privateReviewOnly,false);assert.equal(contract.maxEdgeDistanceM,.35);
 assert.equal(createHash('sha256').update(read(HARBORN_SCOPE.oldValues.url)).digest('hex'),HARBORN_SCOPE.oldValues.sha256);
});
test('actual direct city adapter applies and restores the terrain without visiting a study',async()=>{
 const district='cooksville',context=new THREE.Group(),seen=new Set();for(const binding of contract.ground.filter(b=>b.district===district)){if(seen.has(binding.url))continue;seen.add(binding.url);context.add((await load(binding.url,binding)).scene);}const rawModel=read('models/cooksville.glb'),model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(rawModel.buffer.slice(rawModel.byteOffset,rawModel.byteOffset+rawModel.byteLength),'')).scene;
 const data=JSON.parse(read('data/refinement-models.json')),asset=data.assets.find(a=>a.id===contract.assetId),projects=JSON.parse(read('data/projects.json')),appearance=createModelAppearance(THREE),app=read('app.js').toString();
 const state={THREE,district:JSON.parse(read('data/districts.json')).find(d=>d.id===district),id:district,nextModel:model,nextContext:context,terrainSpec:{contract,weights:read(contract.weights.url)},nextTerrainController:null,prepareHarbornTerrain,refinementData:{assets:[asset]},refinementInDistrict,overrides:JSON.parse(read('data/overrides.json')),projectById:new Map(projects.map(p=>[p.id,p])),groupById:new Map(),groupByMesh:new Map(),appearance,resolveModelLifecycle,displayStatusForLifecycle,inactiveLifecycle,token:1,loadToken:1,window:{},splitSourceOverlaps,loadAsset:url=>load(url,contract.candidate),model,modelMeshes:[],draftToggle:{checked:false},selectedStudyProjectId:null,treeMeshes:[],markers:[],detailMeshes:[],transitGroup:{},markerGroup:{},syncStatusLegend(){},applyModelVisibility,$:id=>({checked:id==='#unknownStatusToggle'})};
 vm.runInNewContext(app.split('\n').filter(s=>s.startsWith('function classify(')||s.startsWith('function lifecycleFor(')).join('\n'),state);const start=app.indexOf('const additionAssets='),end=app.indexOf(' const detail=await loadAsset',start);await vm.runInNewContext('(async()=>{'+app.slice(start,end)+'})()',state);assert(state.nextTerrainController);state.window.atlasHarbornTerrain=state.nextTerrainController;
 const pass=app.indexOf('const nextFutureMeshes=[],nextModelMeshes=[];'),passEnd=app.indexOf(';nextContext.traverse',pass);vm.runInNewContext(app.slice(pass,passEnd+1)+'modelMeshes=nextModelMeshes;',state);vm.runInNewContext(app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature=')),state);
 const models=state.modelMeshes.filter(m=>m.userData.assetId===contract.assetId);assert.equal(models.length,207);for(const selected of [null,asset.projectId]){state.selectedStudyProjectId=selected;for(const mode of ['future','existing','construction','future']){vm.runInNewContext('applyVisibility('+JSON.stringify(mode)+')',state);assert.equal(models.filter(m=>m.visible).length,mode==='future'?207:0);assert.equal(state.nextTerrainController.active,mode==='future');}}
 state.nextTerrainController.dispose();appearance.dispose();
});
