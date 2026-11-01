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
const ids=['mcity-m4-future-detail-20261101','mcity-m4-spring2026-detail-20261101','mcity-m5-authored-detail-20261101','mcity-m7-m8-20261101-dated-exteriors','mcity-m3-upper-detail-20261101','mcity-m6-20261101-dated-exterior'];
const accepted=[...catalogue.assets.filter(a=>['mcity-m1','mcity-m2'].includes(a.id)),...data.assets.filter(a=>ids.includes(a.id))];
const acceptedHashes={
 'mcity-m1':'fa2dbb81b9cd0a03bbdf7d1c189e81066ca10ff5d0e0c45dae96b502c2e7320a',
 'mcity-m2':'f8df47618a455813ce83c64ced978e5b18797ee13f233be743ed09e8ce7f9f87',
 'mcity-m3-upper-detail-20261101':'de41aa0078aab3d32c0bdee631434878c8f0bed44dfaff66244b67dc50231699',
 'mcity-m4-future-detail-20261101':'193a33d5866adb9dbdd2aa8915ed802d9c4420918b4a34c9453d9aa12397fd3a',
 'mcity-m4-spring2026-detail-20261101':'71ddefd801ed80defa5ccfeb7c2b36836c0a3ec0e14db93eef2f07c3ed4a4783',
 'mcity-m5-authored-detail-20261101':'5fd6bd183936e546469e7d07fb7191767bed79f043cc8c74ec1d48727dede1b3',
 'mcity-m6-20261101-dated-exterior':'03cffd7b17cae8d431f3e30b567ac628415b87a09746951137d47a5ddab29693',
 'mcity-m7-m8-20261101-dated-exteriors':'109c685cb649b359df4b7a1340f9b228101f75d7505bdf988d0fc894128351f8'
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
 assert(data.assets.some(a=>a.id==='mcity-m3-upper-detail-20261101'));assert(data.assets.some(a=>a.id==='mcity-m6-20261101-dated-exterior'));
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

test('M3 overlay keeps the exact municipal lower capture once with separate dated structural visibility',async()=>{
 const asset=data.assets.find(a=>a.id==='mcity-m3-upper-detail-20261101');assert.equal(asset.loadWithMunicipalMesh,'63-6249');assert.equal(asset.municipalMeshIncluded,false);
 const source=(await parse(await read('public/models/downtown.glb'))).scene,detail=(await parse(await read('public/'+asset.url))).scene;
 const lower=meshes(source).filter(m=>m.userData.id==='63-6249');assert.equal(lower.length,1);
 const original=lower[0].geometry.attributes.position.array.slice();
 assert(meshes(detail).every(m=>m.userData.id!=='63-6249'));source.add(detail);
 assert.equal(meshes(source).filter(m=>m.userData.id==='63-6249').length,1);assert.deepEqual(lower[0].geometry.attributes.position.array,original);
 const overlay=meshes(detail);for(const mesh of overlay)Object.assign(mesh.userData,{assetId:asset.id,lifecycle:asset.lifecycle,modes:asset.modes,recordedProgress:asset.recordedProgress,uncertain:true});
 for(const mode of ['existing','construction','future']){applyModelVisibility(overlay,mode,{unknownStatuses:false});assert(overlay.every(m=>m.visible===(mode!=='existing')));}
 assert(overlay.every(m=>m.geometry.attributes.normal||[m.material].flat().every(material=>material.flatShading)));dispose(source);
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
