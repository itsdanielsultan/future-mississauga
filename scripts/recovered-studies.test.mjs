import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const {applyModelVisibility}=await import('../public/model-visibility.js');
const manifest=JSON.parse(await fs.readFile(new URL('../public/data/refinement-models.json',import.meta.url)));
const studies=manifest.assets.filter(a=>a.id?.startsWith('mcity-')&&a.localOptional);
const sha=b=>createHash('sha256').update(b).digest('hex');
const parse=async b=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const meshList=root=>{const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});return meshes;};
const count=m=>(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
test('recovered scope contains exactly two opt-in Existing M City Rev02 studies, no lost 3085 replacement',()=>{
 assert.equal(studies.length,2);assert.equal(manifest.assets.filter(a=>a.localOptional&&a.url.includes('studies-20261025')).length,2);
 for(const a of studies){assert.equal(a.status,'Existing');assert.deepEqual(a.modes,['existing','construction','future']);assert.equal(a.sourceRevision,'02');assert(a.uncertainGeometry&&a.preserveMaterials&&a.preserveSourceNormals);assert.deepEqual(a.replacesSourceIds,[]);assert.equal(a.replacementTriangleKeys.length,a.replacementGeometry.sourceTriangles);assert.match(a.caveat,/not|approximate|inferred/);}
 assert.equal(studies.reduce((n,a)=>n+a.replacementTriangleKeys.length,0),404);
 assert(manifest.localReviewRecovery.missing.some(s=>s.includes('3085')));
});
for(const a of studies)test(a.id+' has pinned historical bytes and parses through real GLTFLoader',async()=>{
 const b=await fs.readFile(new URL('../public/'+a.url,import.meta.url)),raw=gunzipSync(b);assert.equal(sha(b),a.downloadSHA256);assert.equal(sha(raw),a.sha256);assert.equal(b.length,a.bytes);assert.equal(raw.length,a.decodedBytes);
 const gltf=await parse(raw),meshes=meshList(gltf.scene);assert.equal(meshes.length,a.drawPrimitives);assert.equal(meshes.reduce((n,m)=>n+count(m),0),a.triangles);assert.equal(meshes.filter(m=>m.material.transparent).length,a.transparentPrimitivesRetained);
 gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene,true);for(const [i,row] of [box.min.toArray(),box.max.toArray()].entries())for(let j=0;j<3;j++)assert(Math.abs(row[j]-a.bounds[i][j])<.001);
 assert(meshes.every(m=>m.geometry.attributes.normal));assert(meshes.some(m=>m.geometry.attributes.uv));assert(meshes.every(m=>m.userData.studySemantic));assert(meshes.some(m=>m.userData.studySemantic==='unchanged-tower'));assert(meshes.some(m=>m.userData.studySemantic.startsWith('retained-source-podium:')));assert(meshes.some(m=>m.userData.studySemantic.startsWith('rev02-entry:')));
});
for(const district of ['downtown','citywide'])test(district+' exact source masks preserve all faces and restore 404 faces in every scenario',async()=>{
 const data=await fs.readFile(new URL('../public/models/'+district+'.glb',import.meta.url)),root=(await parse(data)).scene;
 const sourceBefore=meshList(root).reduce((n,m)=>n+count(m),0);const audit=splitSourceOverlaps(THREE,root,studies),meshes=meshList(root);
 assert.equal(meshes.reduce((n,m)=>n+count(m),0),sourceBefore);assert.equal(audit.reduce((n,r)=>n+r.fallbackTriangles,0),404);assert.equal(audit.reduce((n,r)=>n+r.removedAllModesTriangles,0),0);
 for(const m of meshes)m.userData.displayStatus=m.userData.Status;
 const fallback=meshes.filter(m=>m.userData.sourceLayerSeparated);assert.equal(fallback.reduce((n,m)=>n+count(m),0),404);
 for(const mode of ['existing','construction','future']){
  applyModelVisibility(meshes,mode);assert(fallback.every(m=>m.visible));
  const extra=studies.map(a=>{const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());m.userData={assetId:a.id,projectId:a.projectId,draftStudy:true,displayStatus:'Existing',modes:a.modes};return m;});
  applyModelVisibility([...meshes,...extra],mode,{referenceStudies:true});assert(fallback.every(m=>!m.visible));
  applyModelVisibility([...meshes,...extra],mode,{referenceStudies:false});assert(fallback.every(m=>m.visible));
  applyModelVisibility([...meshes,...extra],mode,{selectedStudyProjectId:'mcity-1-2',uncertainVersions:false});assert(fallback.every(m=>!m.visible));
  extra[1].geometry.setIndex([]);applyModelVisibility([...meshes,...extra],mode,{referenceStudies:true});assert.equal(fallback.filter(m=>m.visible).reduce((n,m)=>n+count(m),0),268);
 }
});
test('exact source keys do not suppress an adjacent triangle inside the same bounds',()=>{
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,0,1, .1,0,.1,.9,0,.1,.1,0,.9],3));const root=new THREE.Group(),m=new THREE.Mesh(geo);m.userData.Status='Existing';root.add(m);
 const a={id:'exact',localReview:true,bounds:[[0,0,0],[1,1,1]],modes:['existing'],replacementTriangleKeys:['0.000,0.000,0.000|0.000,0.000,1.000|1.000,0.000,0.000']};const audit=splitSourceOverlaps(THREE,root,[a]);assert.equal(audit[0].fallbackTriangles,1);assert.equal(audit[0].remainingTriangles,1);assert.equal(count(m),1);
});
test('all baseline refinement assets and every prior non-M City project remain semantically unchanged',async()=>{
 const {execFileSync}=await import('node:child_process');const base='bdc90b554778f27160f90d329fba1e0e7e67feb6';const old=JSON.parse(execFileSync('git',['show',base+':public/data/refinement-models.json'],{maxBuffer:32*1024*1024}));assert.deepEqual(manifest.assets.slice(0,old.assets.length),old.assets);assert.equal(manifest.assets.length,old.assets.length+2);
 const before=JSON.parse(execFileSync('git',['show',base+':public/data/projects.json'],{maxBuffer:32*1024*1024})),after=JSON.parse(await fs.readFile(new URL('../public/data/projects.json',import.meta.url)));const prior=after.filter(p=>!['sgm-maritz-6710','ergocentric-275-superior'].includes(p.id));assert.equal(after.length,before.length+2);assert.equal(after.filter(p=>p.id==='sgm-maritz-6710').length,1);assert.equal(after.filter(p=>p.id==='ergocentric-275-superior').length,1);assert.equal(before.length,prior.length);assert.deepEqual(prior.filter(p=>p.id!=='mcity-1-2'),before.filter(p=>p.id!=='mcity-1-2'));
 const a=after.find(p=>p.id==='mcity-1-2'),b=before.find(p=>p.id==='mcity-1-2');for(const key of ['status','statusDate','towers','heightM','storeys','sources','geometrySources','meshIds','retainedMeshIds','position','actualCompletionDate','completion'])assert.deepEqual(a[key],b[key]);
});
