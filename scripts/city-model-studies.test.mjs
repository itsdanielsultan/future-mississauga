import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {cityModelStudies,loadCityStudy,bindStudyReplacement,presentCityStudyProjects}=await import('../public/city-model-studies.js');
const {shouldLoadRefinement,createOptionalRefinementLoader}=await import('../public/refinement-loading.js');
const {applyModelVisibility}=await import('../public/model-visibility.js');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const {validateCityModelStudies}=await import('./validate-city-model-studies.mjs');
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root)));
const catalogue=await read('public/data/model-previews.json'),refinements=await read('public/data/refinement-models.json');
const assets=cityModelStudies(refinements.assets,catalogue).filter(a=>a.defaultVisible);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const fetcher=async url=>{const a=catalogue.assets.find(a=>a.url===url);return new Response(await readFile(new URL(a.repositoryFile||'public/'+a.url,root)));};
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
const triangles=root=>meshes(root).reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
const dispose=root=>{root.traverse(o=>{o.geometry?.dispose();for(const material of [o.material].flat().filter(Boolean))material.dispose();});root.removeFromParent();};
const parse=async bytes=>loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');

test('only registered public assemblies load by default; other optional studies remain optional',async()=>{
 assert.deepEqual(assets.map(a=>a.projectId),['mcity-1-2','mcity-1-2','avia','edge-oro','edge-oro','artform']);
 for(const asset of assets)assert(shouldLoadRefinement(asset));
 assert(!shouldLoadRefinement({localOptional:true,projectId:'unrelated'}));
 assert.equal(cityModelStudies(refinements.assets,catalogue).filter(a=>!a.defaultVisible).length,refinements.assets.length-2);
 await validateCityModelStudies(new URL('../public',import.meta.url).pathname);
});

test('runtime presentation leaves stored project facts and all unrelated records intact',async()=>{
 const original=await read('public/data/projects.json'),changed=structuredClone(original);presentCityStudyProjects(changed);
 for(let i=0;i<original.length;i++){
  if(!['mcity-1-2','avia','edge-oro','artform'].includes(original[i].id)){assert.deepEqual(changed[i],original[i]);continue;}
  for(const key of ['position','meshIds','retainedMeshIds','status','statusDate','heightM','storeys','sources','geometrySources','completion'])assert.deepEqual(changed[i][key],original[i][key]);
 }
 assert.equal(changed.find(p=>p.id==='mcity-1-2').localOptional,false);
});

for(const asset of assets)test(asset.id+' verifies original bytes and preserves registered bounds and triangles',async()=>{
 const loaded=await loadCityStudy(THREE,loader,asset,{fetcher,dispose});
 const box=new THREE.Box3().setFromObject(loaded.scene,true);
 for(const [i,row]of[box.min.toArray(),box.max.toArray()].entries())for(let j=0;j<3;j++)assert(Math.abs(row[j]-asset.bounds[i][j])<.02);
 assert.equal(loaded.sourceAssets.length,asset.previewAssets.length);
 assert.equal(triangles(loaded.scene),asset.previewAssets.reduce((n,a)=>n+(a.triangles||0),0)||asset.triangles||(asset.projectId==='artform'?291104:undefined));
 assert(meshes(loaded.scene).every(m=>m.geometry.attributes.normal));
 if(asset.projectId==='avia'){
  assert.deepEqual(loaded.scene.position.toArray(),[-6040,88.3,-10]);assert.deepEqual(loaded.scene.scale.toArray(),[1,1,1]);assert.equal(loaded.scene.rotation.y,0);
  assert(loaded.scene.children.every(o=>o.userData.displayBatching?.batches>0));
  assert(meshes(loaded.scene).length<asset.previewAssets.reduce((n,a)=>n+a.meshCount,0)*.5,'Opaque batching reduces draw calls while preserving transparent surfaces');
 }else if(asset.projectId==='mcity-1-2'){assert.deepEqual(loaded.scene.position.toArray(),[0,0,0]);assert(meshes(loaded.scene).some(m=>m.userData.studySemantic==='unchanged-tower'));}else{assert.deepEqual(loaded.scene.scale.toArray(),[1,1,1]);assert(Math.abs(THREE.MathUtils.radToDeg(loaded.scene.rotation.y)-asset.rotationYDegrees)<1e-10);}
 dispose(loaded.scene);
});

test('partial Avia failure preserves source, disposes the partial assembly and permits a complete retry',async()=>{
 const avia=assets.find(a=>a.projectId==='avia');let fail=true,disposed=0,committed=0;
 const manager=createOptionalRefinementLoader({load:asset=>loadCityStudy(THREE,loader,asset,{fetcher:url=>fail&&url===avia.previewAssets[1].url?Promise.reject(new Error('network')):fetcher(url),dispose:scene=>{disposed++;dispose(scene);}}),commit:(_,result)=>{committed++;dispose(result.scene);},dispose:result=>dispose(result.scene),isCurrent:()=>true});
 await assert.rejects(manager.load(avia),/network/);assert.equal(committed,0);assert.equal(disposed,1);assert(!manager.has(avia.id));
 fail=false;await manager.load(avia);assert.equal(committed,1);assert(manager.has(avia.id));
});

test('incorrect public bytes or placement never commit a replacement',async()=>{
 const asset=assets[0];
 await assert.rejects(loadCityStudy(THREE,loader,asset,{fetcher:async()=>new Response('wrong file'),dispose}),/integrity/);
 const shifted={...asset,translation:[1,0,0]};await assert.rejects(loadCityStudy(THREE,loader,shifted,{fetcher,dispose}),/registered city bounds/);
});

for(const district of ['downtown','citywide'])test(district+' retains exact municipal fallbacks until details are visible in every scenario',async()=>{
 const scene=(await parse(await readFile(new URL('public/models/'+district+'.glb',root)))).scene;
 const before=triangles(scene);splitSourceOverlaps(THREE,scene,assets);assert.equal(triangles(scene),before);
 for(const mesh of meshes(scene))mesh.userData.displayStatus=mesh.userData.Status;
 const municipal=meshes(scene),aviaSource=municipal.filter(m=>m.userData.id==='63-6237');assert.equal(aviaSource.length,1);
 const mcityFaces=municipal.filter(m=>m.userData.sourceLayerSeparated);assert.equal(mcityFaces.reduce((n,m)=>n+m.geometry.index.count/3,0),district==='citywide'?780:540);
 const detailed=assets.map(asset=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.userData={assetId:asset.id,projectId:asset.projectId,displayStatus:asset.status,modes:asset.modes,draftStudy:!asset.defaultVisible};return mesh;});
 for(const scenario of ['existing','construction','future']){
  applyModelVisibility(municipal,scenario,{uncertainVersions:false});assert(aviaSource.every(m=>m.visible));assert(mcityFaces.every(m=>m.visible));
  const unrelatedBefore=municipal.filter(m=>!mcityFaces.includes(m)&&!aviaSource.includes(m)).map(m=>m.visible);
  for(const asset of assets)bindStudyReplacement(scene,asset);
  applyModelVisibility([...municipal,...detailed],scenario,{referenceStudies:false,uncertainVersions:false});
  assert(detailed.every(m=>m.visible));assert(mcityFaces.every(m=>!m.visible));assert(aviaSource.every(m=>!m.visible));
  assert.deepEqual(municipal.filter(m=>!mcityFaces.includes(m)&&!aviaSource.includes(m)).map(m=>m.visible),unrelatedBefore);
  applyModelVisibility(municipal,scenario,{uncertainVersions:false});assert(aviaSource.every(m=>m.visible));assert(mcityFaces.every(m=>m.visible));
 }
 dispose(scene);for(const mesh of detailed)dispose(mesh);
});

test('a missing detail catalogue leaves the municipal map configuration usable',async()=>{
 const {runInNewContext}=await import('node:vm'),source=await readFile(new URL('public/app.js',root),'utf8');
 const start=source.indexOf("try{const response=await fetch('data/model-previews.json'"),end=source.indexOf('\nconst existingStyleIndex',start);
 const original=structuredClone(refinements),state={fetch:async()=>({ok:false}),AbortSignal,refinementData:original,projects:[],cityModelStudies,presentCityStudyProjects,console:{warn(){}}};
 await runInNewContext('(async()=>{'+source.slice(start,end)+'})()',state);assert.deepEqual(original,refinements);
});

test('Cooksville Artform uses all 240 exact source faces, including those beyond the new footprint',async()=>{
 const asset=assets.find(a=>a.projectId==='artform'),scene=(await parse(await readFile(new URL('public/models/cooksville.glb',root)))).scene;
 const before=triangles(scene),audit=splitSourceOverlaps(THREE,scene,[asset]);assert.equal(triangles(scene),before);assert.equal(audit.reduce((n,a)=>n+a.fallbackTriangles,0),240);
 assert(asset.replacementBounds[0][2]<asset.bounds[0][2]);assert.equal(asset.translation[1],40.189998626708984);assert.equal(asset.registration.groundContactVerified,false);
 const fallback=meshes(scene).filter(m=>m.userData.sourceLayerSeparated);for(const m of meshes(scene))m.userData.displayStatus=m.userData.Status;
 const detail=new THREE.Mesh(new THREE.BoxGeometry());detail.userData={assetId:asset.id,displayStatus:'Existing',modes:asset.modes};
 for(const scenario of ['existing','construction','future']){applyModelVisibility(meshes(scene),scenario);assert(fallback.every(m=>m.visible));applyModelVisibility([...meshes(scene),detail],scenario);assert(fallback.every(m=>!m.visible));}
 dispose(scene);dispose(detail);
});

test('Edge replacement preserves Oro municipal geometry and scenario visibility; no full intended-design model is integrated',async()=>{
 assert(!assets.some(a=>a.previewAssets.some(p=>p.id==='oro')));
 const scene=(await parse(await readFile(new URL('public/models/downtown.glb',root)))).scene;
 const oro=meshes(scene).filter(m=>['63-6206','63-6207'].includes(m.userData.id));assert.equal(oro.length,2);
 const before=oro.map(m=>({data:structuredClone(m.userData),geometry:m.geometry}));
 splitSourceOverlaps(THREE,scene,assets);for(const a of assets)bindStudyReplacement(scene,a);
 oro.forEach((mesh,i)=>{assert.equal(mesh.geometry,before[i].geometry);assert.deepEqual(mesh.userData,before[i].data);});
 for(const scenario of ['existing','construction','future']){
  oro.forEach(m=>m.userData.displayStatus=m.userData.Status);applyModelVisibility(oro,scenario);const baseline=oro.map(m=>m.visible);
  const edgeDetails=assets.filter(a=>a.projectId==='edge-oro').map(a=>{const m=new THREE.Mesh(new THREE.BoxGeometry());m.userData={assetId:a.id,projectId:a.projectId,displayStatus:'Existing',modes:a.modes};return m;});
  applyModelVisibility([...oro,...edgeDetails],scenario);assert.deepEqual(oro.map(m=>m.visible),baseline);assert(edgeDetails.every(m=>m.visible));edgeDetails.forEach(dispose);
 }
 dispose(scene);
});
