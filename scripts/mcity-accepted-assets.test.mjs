import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {applyModelVisibility}=await import('../public/model-visibility.js');
const {resolveModelLifecycle,displayStatusForLifecycle}=await import('../public/model-status-materials.js');
const {cityModelStudies}=await import('../public/city-model-studies.js');
const {splitSourceOverlaps}=await import('../public/source-layer-cut.js');
const read=async path=>readFile(new URL('../'+path,import.meta.url));
const json=async path=>JSON.parse(await read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalogue=await json('public/data/model-previews.json'),data=await json('public/data/refinement-models.json'),projects=await json('public/data/projects.json');
const ids=['mcity-m4-future-detail-20261101','mcity-m4-spring2026-detail-20261101','mcity-m5-authored-detail-20261101','mcity-m7-m8-20261101-dated-exteriors','mcity-m3-likeness-20261101-v7','mcity-m6-20261101-dated-exterior'];
const accepted=[...catalogue.assets.filter(a=>['mcity-m1','mcity-m2'].includes(a.id)),...data.assets.filter(a=>ids.includes(a.id))];
const acceptedHashes={
 'mcity-m1':'630368744c2ba9f8252004d87bf31d31f66397c3cc037b21db65f43e6da7f9ca',
 'mcity-m2':'1f6d68734e2486165984f0e56605638fc0ea705a4cb326afbe33b0a4dde0ef20',
 'mcity-m3-likeness-20261101-v7':'46069389dca1b1f6f129b0a88d96f19ff8c00aa6d2fb2d87ddf05e0106c0c78f',
 'mcity-m4-future-detail-20261101':'c29a55cdc94e15748a826087415fecbb84be0a0bd324f15dac1023450cb943a2',
 'mcity-m4-spring2026-detail-20261101':'3383b5178f56a75fb709a1d201d812e6887cdd3f4255728bb8c2bc1701eaac60',
 'mcity-m5-authored-detail-20261101':'4162051b4d6706a65b3f5f0606ce31dfd9500c41f6ea766f1a40eb15ac519b6f',
 'mcity-m6-20261101-dated-exterior':'cad1af48cf240c74696e9d60a59694d7423092801e1f30f0bc9cc044e6976493',
 'mcity-m7-m8-20261101-dated-exteriors':'ab9f1a2ebe1df2f2eb3260d2acd853ba56cc7d50a02ef2d9106ea79b9103b198'
};
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const meshes=root=>{const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;};
const parse=async encoded=>{const bytes=encoded[0]===31&&encoded[1]===139?gunzipSync(encoded):encoded;return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
const dispose=root=>root.traverse(node=>{node.geometry?.dispose();for(const material of [node.material].flat().filter(Boolean))material.dispose();});

test('only the eight accepted derivative identities are activated with clean URLs and no source images',async()=>{
 assert.equal(accepted.length,8);
 for(const asset of accepted){
  assert.match(asset.url,/^models\/studies-20261101\/[a-z0-9-]+\.glb(?:\.gz)?$/);
  const encoded=await read('public/'+asset.url),decoded=encoded[0]===31?gunzipSync(encoded):encoded;
  assert.equal(encoded.length,asset.bytes);assert.equal(sha(encoded),asset.downloadSHA256);assert.equal(sha(encoded),acceptedHashes[asset.id]);
  assert.equal(sha(decoded),asset.decodedSHA256||asset.sha256);
  const gltf=JSON.parse(decoded.subarray(20,20+decoded.readUInt32LE(12)).toString());
  assert.equal(gltf.images?.length||0,0);assert(gltf.buffers.every(buffer=>!buffer.uri));
  assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
  const parsed=await parse(encoded);assert(meshes(parsed.scene).length>0);dispose(parsed.scene);
 }
 for(const asset of data.assets.filter(a=>ids.includes(a.id)||a.projectId==='mcity-1-2')){
  for(const key of ['privateRuntimeStage','localReview','stagedLegacyAccuracyCompatibility','legacyStageCompatibility'])assert(!Object.hasOwn(asset,key),asset.id+': '+key);
  assert(asset.uncertainGeometry&&asset.preserveMaterials&&asset.preserveSourceNormals);
 }
 assert(data.assets.some(a=>a.id==='mcity-m3-likeness-20261101-v7'));assert(data.assets.some(a=>a.id==='mcity-m6-20261101-dated-exterior'));
});

test('M4 progress and future design are mutually exclusive; M5 remains future-only with construction lifecycle',async()=>{
 const selected=data.assets.filter(a=>ids.slice(0,3).includes(a.id)),roots=[];
 for(const asset of selected){
  const loaded=await parse(await read('public/'+asset.url));roots.push(loaded.scene);
  const project=projects.find(p=>p.id===asset.projectId);
  for(const mesh of meshes(loaded.scene))Object.assign(mesh.userData,{assetId:asset.id,projectId:asset.projectId,lifecycle:resolveModelLifecycle({lifecycle:asset.lifecycle},{},project),modes:asset.modes,uncertain:true,recordedProgress:asset.recordedProgress});
 }
 const all=roots.flatMap(meshes),visibleIds=()=>[...new Set(all.filter(m=>m.visible).map(m=>m.userData.assetId))].sort();
 applyModelVisibility(all,'existing');assert.deepEqual(visibleIds(),[]);
 applyModelVisibility(all,'construction',{unknownStatuses:false});assert.deepEqual(visibleIds(),['mcity-m4-spring2026-detail-20261101']);
 applyModelVisibility(all,'future',{unknownStatuses:false});assert.deepEqual(visibleIds(),['mcity-m4-future-detail-20261101','mcity-m5-authored-detail-20261101']);
 assert(all.every(m=>m.userData.lifecycle==='under_construction'));
 assert(all.every(m=>m.material.isMeshStandardMaterial));roots.forEach(dispose);
 const app=(await read('public/app.js')).toString();
 assert.doesNotMatch(app,/loadAsset\('models\/mcity-m4-plan-derived\.glb'\)/);
 assert.doesNotMatch(app,/loadAsset\('models\/mcity-m3-upper-envelope\.glb'\)/);
 assert(!data.assets.some(a=>a.id==='mcity-m3-crown-silhouette'));
 assert(!data.assets.some(a=>['mcity-m4-recorded-level41','mcity-m5-developer-proxy'].includes(a.id)));
});

for(const [id,sourceIds] of [['mcity-m7-m8-20261101-dated-exteriors',['63-6170','63-6171','63-6172']],['mcity-m6-20261101-dated-exterior',['63-6173','63-6174']]])test(id+' preserves PBR and replaces exactly its source objects only when the detailed proposal is visible',async()=>{
 const asset=data.assets.find(a=>a.id===id);assert.equal(asset.lifecycle,'proposed');assert.deepEqual(asset.modes,['future']);assert.deepEqual(asset.replacesSourceIds,sourceIds);
 const source=(await parse(await read('public/models/downtown.glb'))).scene,detail=(await parse(await read('public/'+asset.url))).scene;
 const originals=meshes(source).filter(m=>asset.replacesSourceIds.includes(m.userData.id));assert.equal(originals.length,sourceIds.length);
 for(const m of originals)Object.assign(m.userData,{lifecycle:'proposed',sourceReplacements:[{assetId:asset.id,modes:asset.replacementModes}]});
 for(const m of meshes(detail))Object.assign(m.userData,{assetId:asset.id,lifecycle:asset.lifecycle,modes:asset.modes,uncertain:true});
 const detailed=meshes(detail),materials=new Set(detailed.map(m=>m.material));assert(materials.size>1);
 for(const mode of ['existing','construction','future']){
  applyModelVisibility([...originals,...detailed],mode,{unknownStatuses:false});
  assert(originals.every(m=>!m.visible));assert(detailed.every(m=>m.visible===(mode==='future')));
 }
 applyModelVisibility(originals,'future',{unknownStatuses:false});assert(originals.every(m=>m.visible));
 assert.equal(displayStatusForLifecycle(asset.lifecycle),'Proposed');dispose(source);dispose(detail);
});

test('M3 full replacement keeps municipal geometry unchanged and masks it once only while active',async()=>{
 const asset=data.assets.find(a=>a.id==='mcity-m3-likeness-20261101-v7');assert.equal(asset.loadWithMunicipalMesh,null);assert.equal(asset.municipalMeshIncluded,false);assert.deepEqual(asset.replacesSourceIds,['63-6249']);assert.deepEqual(asset.replacementModes,['construction','future']);
 const source=(await parse(await read('public/models/downtown.glb'))).scene,detail=(await parse(await read('public/'+asset.url))).scene;
 const lower=meshes(source).filter(m=>m.userData.id==='63-6249');assert.equal(lower.length,1);assert.equal(lower[0].geometry.index.count/3,32);
 const original=lower[0].geometry.attributes.position.array.slice();
 Object.assign(lower[0].userData,{lifecycle:'under_construction',recordedProgress:true,sourceReplacements:[{assetId:asset.id,modes:asset.replacementModes}]});
 const replacement=meshes(detail);assert.equal(replacement.length,39);assert(replacement.every(m=>m.userData.id!=='63-6249'));
 for(const mesh of replacement)Object.assign(mesh.userData,{assetId:asset.id,lifecycle:asset.lifecycle,modes:asset.modes,recordedProgress:asset.recordedProgress,uncertain:true});
 for(const mode of ['existing','construction','future']){applyModelVisibility([...lower,...replacement],mode,{unknownStatuses:false});assert(replacement.every(m=>m.visible===(mode!=='existing')));assert.equal(lower[0].visible,false);applyModelVisibility(lower,mode,{unknownStatuses:false});assert.equal(lower[0].visible,mode!=='existing');}
 assert.deepEqual(lower[0].geometry.attributes.position.array,original);dispose(source);dispose(detail);
});

test('accepted M1/M2 preserve exact source masks even without localReview flags',async()=>{
 const assets=cityModelStudies(data.assets,catalogue).filter(a=>a.projectId==='mcity-1-2');assert.equal(assets.length,2);assert(assets.every(a=>!a.localReview));
 const source=(await parse(await read('public/models/downtown.glb'))).scene;
 const audit=splitSourceOverlaps(THREE,source,assets);assert.equal(audit.reduce((n,a)=>n+a.fallbackTriangles,0),404);
 const fallbacks=meshes(source).filter(m=>m.userData.sourceLayerSeparated);
 for(const m of fallbacks)m.userData.lifecycle='existing';
 const detail=assets.map(a=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry());mesh.userData={assetId:a.id,lifecycle:'existing',modes:a.modes};return mesh;});
 for(const mode of ['existing','construction','future']){
  applyModelVisibility([...fallbacks,...detail],mode);assert(fallbacks.every(m=>!m.visible));
  applyModelVisibility(fallbacks,mode);assert(fallbacks.every(m=>m.visible));
 }
 dispose(source);detail.forEach(dispose);
});
