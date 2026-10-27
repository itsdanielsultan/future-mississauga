import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js'),{GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {cityModelStudies,loadCityStudy,bindStudyReplacement}=await import('../public/city-model-studies.js'),{createCityLowerShell}=await import('../public/city-lower-shell.js'),{applyModelVisibility}=await import('../public/model-visibility.js'),{createOptionalRefinementLoader}=await import('../public/refinement-loading.js');
const read=async p=>fs.readFile(new URL('../'+p,import.meta.url)),json=async p=>JSON.parse(await read(p));
const catalogue=await json('public/data/model-previews.json'),refinements=await json('public/data/refinement-models.json'),reference=await json('scripts/oro-composite-reference.json');
const oro=cityModelStudies(refinements.assets,catalogue).find(a=>a.lowerShell),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
const parse=async bytes=>loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const source=async district=>(await parse(await read('public/models/'+district+'.glb'))).scene;
const fetcher=async url=>new Response(await read(catalogue.assets.find(a=>a.url===url).repositoryFile));
const dispose=root=>{root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});root.removeFromParent();};
const vertexHash=geometry=>{const p=geometry.attributes.position,keys=[];for(let i=0;i<p.count;i++)keys.push([p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(7)).join(','));return createHash('sha256').update([...new Set(keys)].sort().join('\n')).digest('hex');};
function area(geometry){const p=geometry.attributes.position;let total=0;for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);total+=b.sub(a).cross(c.sub(a)).length()/2;}return total;}
for(const district of ['downtown','cooksville','citywide'])test(district+' lower shell exactly matches the independent clipped diagnostic and preserves source geometry',async()=>{
 const original=await source(district),before=meshes(original).map(m=>({geometry:m.geometry,positions:m.geometry.attributes.position.array.slice()}));
 const lower=await createCityLowerShell(THREE,original,oro.lowerShell),bodies=meshes(lower).filter(m=>m.userData.geometryRole==='city-lower-shell'),caps=meshes(lower).filter(m=>m.userData.geometryRole==='derived-cut-closure');
 assert.equal(bodies.length,2);assert.equal(caps.length,2);
 for(const body of bodies){const expected=reference.nodes.find(n=>n.id===body.userData.sourceId);assert.equal(body.geometry.attributes.position.count/3,expected.triangleCount);assert.equal(vertexHash(body.geometry),expected.renderedVertexSetSHA256);assert(body.geometry.boundingBox.max.y<=69.55001);}
 for(const cap of caps){const p=cap.geometry.attributes.position,n=cap.geometry.attributes.normal;for(let i=0;i<p.count;i++){assert(Math.abs(p.getY(i)-69.55)<.00001);assert(n.getY(i)>.9999);}assert(Math.abs(area(cap.geometry)-cap.userData.sectionArea)<.03);}
 assert(Math.abs(caps.reduce((sum,m)=>sum+area(m.geometry),0)-2705.689189556976)<.03,'caps preserve the podium hole, with no duplicate tower area or footprint expansion');
 meshes(original).forEach((m,i)=>{assert.equal(m.geometry,before[i].geometry);assert.deepEqual(m.geometry.attributes.position.array,before[i].positions);});dispose(lower);dispose(original);
});
test('actual Oro composite retains its detailed GLB height, rigid transform, materials and full triangle count',async()=>{
 const original=await source('downtown'),result=await loadCityStudy(THREE,loader,oro,{sourceRoot:original,fetcher,dispose}),detail=result.scene.children[0];
 assert.deepEqual(detail.position.toArray(),[-4514.404296875,69.55,-275.9661610921224]);assert.deepEqual(detail.scale.toArray(),[1,1,1]);assert(Math.abs(THREE.MathUtils.radToDeg(detail.rotation.y)-46.764265665329)<1e-10);
 assert.equal(meshes(detail).reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),358368);
 const box=new THREE.Box3().setFromObject(detail,true);assert(Math.abs(box.min.y-69.55)<1e-8);assert(Math.abs(box.max.y-236.425)<1e-8);assert(meshes(detail).some(m=>m.material.transparent));
 for(const [i,row]of[new THREE.Box3().setFromObject(result.scene,true).min.toArray(),new THREE.Box3().setFromObject(result.scene,true).max.toArray()].entries())row.forEach((v,j)=>assert(Math.abs(v-oro.bounds[i][j])<.02));dispose(result.scene);dispose(original);
});
test('atomic load keeps both originals on detailed, source or closure failure and allows retry',async()=>{
 const original=await source('downtown'),nodes=meshes(original).filter(m=>oro.replacesSourceIds.includes(m.userData.id));let fail=true,commits=0;
 const manager=createOptionalRefinementLoader({load:asset=>loadCityStudy(THREE,loader,asset,{sourceRoot:original,fetcher:url=>fail?Promise.reject(new Error('network')):fetcher(url),dispose}),commit:(asset,result)=>{commits++;bindStudyReplacement(original,asset);original.add(result.scene);},dispose:result=>dispose(result.scene),isCurrent:()=>true});
 await assert.rejects(manager.load(oro),/network/);assert(nodes.every(m=>!m.userData.sourceReplacements));assert.equal(commits,0);
 const changed={...oro,lowerShell:{...oro.lowerShell,nodes:oro.lowerShell.nodes.map(n=>({...n,sectionArea:n.sectionArea+1}))}};await assert.rejects(loadCityStudy(THREE,loader,changed,{sourceRoot:original,fetcher,dispose}),/cut closure/);assert(nodes.every(m=>!m.userData.sourceReplacements));
 const saved=nodes[0].userData.id;nodes[0].userData.id='missing';await assert.rejects(loadCityStudy(THREE,loader,oro,{sourceRoot:original,fetcher,dispose}),/base is missing/);nodes[0].userData.id=saved;
 fail=false;await manager.load(oro);assert.equal(commits,1);assert(nodes.every(m=>m.userData.sourceReplacements[0].assetId===oro.id));dispose(original);
});
test('Oro composite and its fallback preserve construction/future inclusion and exclude Existing',async()=>{
 const original=await source('downtown'),nodes=meshes(original).filter(m=>oro.replacesSourceIds.includes(m.userData.id));for(const node of nodes){node.userData.displayStatus='Under Construction';node.userData.recordedProgress=true;}
 const detail=new THREE.Mesh(new THREE.BoxGeometry());detail.userData={assetId:oro.id,projectId:oro.projectId,displayStatus:oro.status,modes:oro.modes,constructionDesign:true,uncertain:true};bindStudyReplacement(original,oro);
 for(const mode of ['existing','construction','future']){applyModelVisibility([...nodes,detail],mode);assert.equal(detail.visible,mode!=='existing');assert(nodes.every(m=>!m.visible));applyModelVisibility(nodes,mode);assert(nodes.every(m=>m.visible===(mode!=='existing')));}
 applyModelVisibility([...nodes,detail],'construction',{uncertainVersions:false});assert(!detail.visible);assert(nodes.every(m=>m.visible));
 const unrelated=new THREE.Mesh(new THREE.BoxGeometry());unrelated.userData={displayStatus:'Under Construction'};applyModelVisibility([unrelated],'construction');assert(!unrelated.visible,'other unverified construction meshes keep their prior behavior');dispose(original);dispose(detail);dispose(unrelated);
});
