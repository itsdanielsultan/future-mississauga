import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import {MCITY_V6_SCOPE as scope,restoreMcityV6Refinements,restoreMcityV6Catalogue,restoreMcityV6Revisions,restoreMcityV6Versions,restoreMcityV6Projects} from './mcity-v6-scope.mjs';
import {glbMeshFingerprints} from './mcity-mesh-fingerprint.mjs';
import {cityModelStudies,loadCityStudy} from '../public/city-model-studies.js';
import {modelRevisionForProject,mediaModelRevision} from '../public/model-revisions.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {createModelAppearance} from '../public/model-appearance.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const json=name=>JSON.parse(read('data/'+name+'.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const refinements=json('refinement-models'),catalogue=json('model-previews'),revisions=json('model-revisions'),versions=json('model-asset-versions');
const parse=url=>{const raw=gunzipSync(read(url)),length=raw.readUInt32LE(12);return {raw,gltf:JSON.parse(raw.subarray(20,20+length)),bin:raw.subarray(28+length)};};
const load=async url=>{const {raw}=parse(url);return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const meshes=root=>{const list=[];root.traverse(node=>{if(node.isMesh)list.push(node);});return list;};
const dispose=root=>root.traverse(node=>{node.geometry?.dispose();for(const material of [node.material].flat().filter(Boolean))material.dispose();});

test('M1/M5 v6 adopts exactly the two approved public derivatives and retains prior URLs',()=>{
 assert.equal(scope.handoffSHA256,'7dd657c6295d10e0175425954b98c7d569bdfb8f888995b5367c902ccdba346f');
 restoreMcityV6Refinements(structuredClone(refinements));restoreMcityV6Catalogue(structuredClone(catalogue));restoreMcityV6Revisions(structuredClone(revisions));restoreMcityV6Versions(structuredClone(versions));restoreMcityV6Projects(json('projects'));
 for(const [index,asset]of scope.publicDerivatives.entries()){
  const compressed=read(asset.url),{raw,gltf,bin}=parse(asset.url);
  assert.equal(sha(compressed),asset.downloadSHA256);assert.equal(sha(raw),asset.publicSHA256);assert.equal(compressed.length,asset.bytes);assert.equal(raw.length,asset.decodedBytes);assert.equal(sha(raw.subarray(20+raw.readUInt32LE(12))),asset.BINChunkSHA256);
  assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(buffer=>!buffer.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.blend\b|\.pdf\b|\.eml\b|privateOnly":true|privateCandidate":true/);
  assert.equal(versions.sha256[asset.url],asset.downloadSHA256);
  const prior=scope.refinements[index].oldValues;assert.equal(sha(read(prior.url)),prior.downloadSHA256);assert.equal(versions.sha256[prior.url],prior.downloadSHA256);
 }
 const oldM5=catalogue.assets.find(asset=>asset.id==='mcity-m5-v5');assert.equal(oldM5.sha256,'af9d51546ca35a1fbc850b2afc3cbf1565010ee7c196f03df7e8cf6679ff829a');
});

test('M1 adds nine pavilion meshes without changing any prior mesh, accessor, material or binary byte',()=>{
 const spec=scope.refinements[0],before=parse(spec.oldValues.url),after=parse(spec.newValues.url);
 assert.equal(before.gltf.meshes.length,183);assert.equal(after.gltf.meshes.length,192);
 for(const key of ['meshes','materials','accessors','bufferViews'])assert.deepEqual(after.gltf[key].slice(0,before.gltf[key].length),before.gltf[key],key);
 assert(before.bin.equals(after.bin.subarray(0,before.bin.length)));
 for(let i=0;i<before.gltf.nodes.length;i++){
  const old={...before.gltf.nodes[i]},current={...after.gltf.nodes[i]};delete old.extras;delete current.extras;
  if(old.children)current.children=current.children.filter(index=>index<before.gltf.nodes.length);
  assert.deepEqual(current,old,'existing node transform '+i);
 }
 assert.equal(spec.newValues.triangles-spec.oldValues.triangles,4712);
 const row=refinements.assets.find(asset=>asset.id===spec.id);assert.equal(row.lifecycle,'existing');assert.deepEqual(row.modes,['existing','construction','future']);assert.equal(row.replacementTriangleKeys.length,136);assert.match(row.caveat,/roof height is estimated within about 2 m/);assert.match(row.caveat,/ground-level podium gaps remain unresolved/);assert.doesNotMatch(row.caveat,/coarse or absent/);
});

test('M5 changes only ten upper podium groups and keeps 46 other groups and all materials exact',()=>{
 const spec=scope.refinements[1],before=parse(spec.oldValues.url),after=parse(spec.newValues.url),a=glbMeshFingerprints(before.raw),b=glbMeshFingerprints(after.raw);
 const changed=Object.keys(a).filter(name=>a[name]!==b[name]);
 assert.deepEqual(changed,['Podium masonry piers | masonry','Podium masonry lintels and sills | masonry','Podium large recessed windows | window','Podium window mullions | mullion','Podium projecting balcony plates | slab','Podium balcony glass guards | podium-clear-guard','Podium balcony side guards | podium-clear-guard','Podium thin guard top rails | mullion','Podium thin guard supports | mullion','Podium thin guard side rails | mullion']);
 assert.equal(Object.keys(a).length,56);assert.deepEqual(Object.keys(a),Object.keys(b));assert.equal(Object.keys(a).filter(name=>a[name]===b[name]).length,46);assert.deepEqual(after.gltf.materials,before.gltf.materials);assert.deepEqual(after.gltf.nodes,before.gltf.nodes);
 const row=refinements.assets.find(asset=>asset.id===spec.id);assert.equal(row.lifecycle,'under_construction');assert.deepEqual(row.modes,['future']);assert.equal(row.recordedProgress,false);assert.equal(row.heightM,null);assert.equal(row.architecturalHeightM,null);assert.equal(row.comparisonWidthM,34);assert.equal(row.proxyComparisonVerticalExtentM,117.87167930107422);assert.match(row.qualification.join(' '),/40.5 m frontage, 20.48 m podium datum and 1.2 m balcony projection remain estimates/);assert.match(row.qualification.join(' '),/undated official completed-design rendering/);
});

test('the real city-study loader accepts the added M1 pavilion bounds and keeps completed visibility',async()=>{
 const row=cityModelStudies(refinements.assets,catalogue).find(asset=>asset.id===scope.refinements[0].id);
 const loaded=await loadCityStudy(THREE,new GLTFLoader(),row,{fetcher:async url=>{const bytes=read(url);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};},dispose});
 const list=meshes(loaded.scene);assert.equal(list.length,192);assert.equal(loaded.sourceAssets[0].url,scope.publicDerivatives[0].url);assert.equal(list.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),367975);assert.equal(list.filter(m=>m.material.transparent).length,133);
 for(const mesh of list)Object.assign(mesh.userData,{assetId:row.id,lifecycle:row.lifecycle,modes:row.modes});
 for(const mode of ['existing','construction','future']){applyModelVisibility(list,mode,{unknownStatuses:false});assert(list.every(mesh=>mesh.visible));}
 dispose(loaded.scene);
});

test('the official GLTF loader keeps M5 bounds and transparent guards without a shading rewrite',async()=>{
 const row=refinements.assets.find(asset=>asset.id===scope.refinements[1].id),{scene}=await load(row.url),list=meshes(scene);assert.equal(list.length,56);assert.equal(list.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),91644);
 const bounds=new THREE.Box3().setFromObject(scene,true);assert.deepEqual([bounds.min.toArray(),bounds.max.toArray()],row.bounds);
 const appearance=createModelAppearance(THREE),materials=list.map(mesh=>mesh.material);
 for(const mesh of list){Object.assign(mesh.userData,{assetId:row.id,projectId:row.projectId,lifecycle:row.lifecycle,modes:row.modes,sourceAssetSHA256:row.downloadSHA256});appearance.register(mesh,{authored:true});}
 for(const mode of ['existing','construction','future']){applyModelVisibility(list,mode,{unknownStatuses:false});assert(list.every(mesh=>mesh.visible===(mode==='future')));}
 appearance.setMode('status');appearance.setMode('natural');list.forEach((mesh,index)=>assert.equal(mesh.material,materials[index]));
 const guards=list.filter(mesh=>mesh.material.name==='podium-clear-guard');assert.equal(guards.length,2);for(const mesh of guards){assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.opacity,72/255);assert.equal(mesh.material.side,THREE.DoubleSide);}
 appearance.dispose();dispose(scene);
});

test('current revision dates follow exact mixed assemblies while M2 and old images retain their dates',()=>{
 for(const [project,view,date]of [['mcity-1-2','mcity-m1','2026-11-12'],['mcity-1-2','mcity-pair','2026-11-12'],['mcity-1-2','mcity-m2','2026-11-01'],['mcity-5','mcity-m5','2026-11-12']])assert.equal(modelRevisionForProject(revisions,catalogue,project,view).updatedOn,date);
 assert.equal(catalogue.assets.find(asset=>asset.id==='mcity-m2').modelReviewDate,'2026-11-01');
 const altered=structuredClone(catalogue);altered.assets.find(asset=>asset.id==='mcity-m2').modelReviewDate='2026-11-12';assert.equal(modelRevisionForProject(revisions,altered,'mcity-1-2','mcity-pair'),null);
 for(const id of ['mcity-m1','mcity-m5-v6']){const altered=structuredClone(catalogue);altered.assets.find(asset=>asset.id===id).sha256='0'.repeat(64);const view=id==='mcity-m1'?'mcity-m1':'mcity-m5';assert.equal(modelRevisionForProject(revisions,altered,id==='mcity-m1'?'mcity-1-2':'mcity-5',view),null);}
 for(const revision of scope.addedRevisions){assert.deepEqual(revision.media,[]);assert.equal(mediaModelRevision(revisions,{url:'assets/wide/downtown-future.png',sha256:'a'.repeat(64),modelSHA256:revision.modelAssets[0].sha256}),null);}
});
