import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import {M4_V3_ASSETS,restoreM4V3Fields} from './mcity-m4-v3-scope.mjs';
import {applyModelVisibility} from '../public/model-visibility.js';
import {createModelAppearance} from '../public/model-appearance.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url));
const data=JSON.parse(read('data/refinement-models.json')),versions=JSON.parse(read('data/model-asset-versions.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o)});return result;};
const load=async spec=>{const encoded=read(spec.url),raw=gunzipSync(encoded);assert.equal(sha(encoded),spec.downloadSHA256);assert.equal(sha(raw),spec.rawSHA256);return {raw,scene:(await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'')).scene};};

test('M4 V3 retains the exact accepted metadata, historical bytes and paired roof qualification',()=>{
 restoreM4V3Fields(structuredClone(data));
 const rows=data.assets.filter(a=>a.projectId==='mcity-4');assert.equal(rows.length,2);
 assert.equal(sha(read('models/studies-20261101/mcity-m4-future-detail.glb')),'193a33d5866adb9dbdd2aa8915ed802d9c4420918b4a34c9453d9aa12397fd3a');
 assert.equal(sha(read('models/studies-20261101/mcity-m4-spring2026-level41-detail.glb')),'71ddefd801ed80defa5ccfeb7c2b36836c0a3ec0e14db93eef2f07c3ed4a4783');
 for(const a of rows){assert.equal(a.lifecycle,'under_construction');assert.deepEqual(a.pairedRoofDatumsM,[200.7,215.65]);assert.deepEqual(a.replacesSourceIds,[]);assert.deepEqual(a.replacementModes,[]);assert.equal(a.sourceDesignDate,'2020-03-25');assert.equal(a.sourceEvidenceDate,'Spring 2026');assert.match(a.qualification.join(' '),/not an exact issued roof plan/);assert.match(a.credit,/CORE Architects/);assert.equal(versions.sha256[a.url],a.downloadSHA256);}
 const progress=rows.find(a=>a.recordedProgress);assert.equal(progress.clippingHeightAboveDatumM,123.65);assert.equal(progress.glazingHeightAboveDatumM,78.4);assert.equal(progress.constructionEvidenceDate,'Spring2026');assert.match(progress.warning,/does not claim November construction accuracy/);
});

test('M4 accepted GLBs preserve source-free geometry, roof datums and dated progress cut',async()=>{
 for(const spec of M4_V3_ASSETS){
  const a=data.assets.find(a=>a.id===spec.id),{raw,scene}=await load(spec),gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
  assert.equal(raw.length,spec.decodedBytes);assert.equal(read(spec.url).length,spec.bytes);assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
  const list=meshes(scene);assert.equal(list.length,spec.meshes);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),spec.triangles);assert.equal(new Set(list.map(m=>m.material)).size,spec.materialCount);
  const box=new THREE.Box3().setFromObject(scene,true);assert.deepEqual([box.min.toArray(),box.max.toArray()],a.bounds);
  if(a.recordedProgress){assert(Math.abs(box.max.y-box.min.y-123.65)<.001);const glazing=list.filter(m=>m.name.includes('recorded_glazing'));assert.equal(glazing.length,4);assert(glazing.every(m=>Math.abs(new THREE.Box3().setFromObject(m).max.y-box.min.y-78.4)<.001));}
  else {const roofs=list.filter(m=>m.name.includes('thin_roof_rim'));assert.equal(roofs.length,4);const heights=roofs.map(m=>Math.round((new THREE.Box3().setFromObject(m).max.y-box.min.y)*100)/100).sort((a,b)=>a-b);assert.deepEqual(heights,[200.7,200.7,215.65,215.65]);}
  const appearance=createModelAppearance(THREE),originals=list.map(m=>m.material);for(const mesh of list){Object.assign(mesh.userData,{assetId:a.id,projectId:a.projectId,sourceAssetSHA256:a.downloadSHA256,lifecycle:a.lifecycle,modes:a.modes,recordedProgress:a.recordedProgress});appearance.register(mesh,{authored:true});}
  appearance.setMode('status');appearance.setMode('natural');list.forEach((mesh,i)=>assert.equal(mesh.material,originals[i]));appearance.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 }
});

test('M4 has exactly one authored representation in each eligible scenario and no old proxy load',async()=>{
 const all=[];for(const spec of M4_V3_ASSETS){const a=data.assets.find(a=>a.id===spec.id),{scene}=await load(spec);for(const m of meshes(scene)){Object.assign(m.userData,{assetId:a.id,projectId:a.projectId,lifecycle:a.lifecycle,modes:a.modes,recordedProgress:a.recordedProgress,uncertain:true});all.push(m);}}
 for(const [mode,expected]of [['existing',[]],['construction',['mcity-m4-spring2026-detail-20261101']],['future',['mcity-m4-future-detail-20261101']]]){applyModelVisibility(all,mode,{unknownStatuses:false});assert.deepEqual([...new Set(all.filter(m=>m.visible).map(m=>m.userData.assetId))],expected);}
 assert(!data.assets.some(a=>a.id==='mcity-m4-recorded-level41'||a.url==='models/mcity-m4-plan-derived.glb'));
 assert.doesNotMatch(read('app.js').toString(),/loadAsset\(['"]models\/mcity-m4-plan-derived\.glb['"]\)/);
 for(const m of all){m.geometry.dispose();m.material.dispose();}
});
