import {restorePreOHNVersions} from './offshore-context-scope.mjs';
import {restoreHarbornVersions} from './harborn-v4-scope.mjs';
import {restoreM6M8Appearance,M6_M8_APPEARANCE} from './mcity-m6-m8-appearance-scope.mjs';
import {restoreM3V7Asset,restoreM3V7Projects,M3_V7_SCOPE} from './mcity-m3-v7-scope.mjs';
import {glbMeshFingerprints} from './mcity-mesh-fingerprint.mjs';
import {restoreM4V3Fields,M4_V3_ASSETS} from './mcity-m4-v3-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import {modelRevisionForProject} from '../public/model-revisions.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {createModelAppearance} from '../public/model-appearance.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url));
const json=name=>JSON.parse(read('data/'+name));
const sha=b=>createHash('sha256').update(b).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>sha(JSON.stringify(stable(value)));
const BASELINE={"maskedRefinements":"d64d4d3222ac40f3e0b61514b70795409c073e8c27e83d99496611e2cf64aacf","priorCatalogue":"9f74c27c0df8cd41e57ea8eff28e52eeceb1173015375ec4718fe77559f61a3d","priorRevisions":"1e7eb4e76fbfa6bfd02415484ce6b697bde408b4bed63f4dd2265efef78c121b","priorVersions":"a42ea0106f2c99c23041fa24dee25f44f2fa3cb92576c08aed7a73f580d14ae7","projects":"002407e16c575da384ee7adcf57b753b1cfd5880c1b01b85f157183ef764f00a","lifecycle":"fe4f314ef8289453de68d0abc602f036cb5be7447131168187bf67735d7fea24"};
const CHANGED_KEYS=["url", "sha256", "downloadSHA256", "decodedSHA256", "bytes", "decodedBytes", "triangleCount", "bounds", "modelFidelity", "warning", "qualification", "credit", "sourceRevision", "sourceEvidenceDate", "sources", "modelReviewDate", "geometryConfidence", "comparisonWidthM", "heightVerified", "modelRevisionId"];
const MODEL_URL='models/studies-20261101/mcity-m5-exterior-v5-af9d51546ca3.glb.gz',RAW='af9d51546ca35a1fbc850b2afc3cbf1565010ee7c196f03df7e8cf6679ff829a',GZIP='4162051b4d6706a65b3f5f0606ce31dfd9500c41f6ea766f1a40eb15ac519b6f';
const refinements=json('refinement-models.json'),catalogue=json('model-previews.json'),revisions=json('model-revisions.json'),versions=json('model-asset-versions.json');
const asset=refinements.assets.find(a=>a.id==='mcity-m5-authored-detail-20261101');
test('M5 V5 changes only its model metadata and appends exact standalone/revision bindings',()=>{
 const r=restoreM1M2Refinements(restoreM6M8Appearance(restoreM3V7Asset(restoreM4V3Fields(structuredClone(refinements))))),row=r.assets.find(a=>a.id===asset.id);for(const key of CHANGED_KEYS)delete row[key];assert.equal(fingerprint(r),BASELINE.maskedRefinements);
 const c=restoreM1M2Catalogue(structuredClone(catalogue));c.assets=c.assets.filter(a=>a.id!=='mcity-m5-v5');c.views=c.views.filter(v=>v.id!=='mcity-m5');
 // Only the three stale display suffixes may differ from the prior catalogue.
 // Restore those exact strings before hashing every historical field and record.
 for(const id of ['mcity-m1','mcity-m2','mcity-pair']){const view=c.views.find(v=>v.id===id);assert.equal(view.subtitle,'Completed buildings · Approximate exterior');view.subtitle+=' · Rev02';}
 assert.equal(fingerprint(c),BASELINE.priorCatalogue);
 const h=restoreM1M2Revisions(structuredClone(revisions));h.revisions=h.revisions.filter(r=>r.id!=='mcity-m5-v5-20261101');assert.equal(fingerprint(h),BASELINE.priorRevisions);
 const v=restoreHarbornVersions(restorePreOHNVersions(versions));delete v.sha256[MODEL_URL];for(const a of [...M4_V3_ASSETS,...M6_M8_APPEARANCE]){assert.equal(v.sha256[a.url],a.downloadSHA256);delete v.sha256[a.url];}for(const a of [...M3_V7_SCOPE.versions,...M1_M2_V5_SCOPE.versions,PARK26_SCOPE.version]){assert.equal(v.sha256[a.url],a.sha256);delete v.sha256[a.url];}assert.equal(fingerprint(v),BASELINE.priorVersions);
 assert.equal(fingerprint(restoreM1M2Projects(restoreM3V7Projects(JSON.parse(read('data/projects.json'))))),M3_V7_SCOPE.priorProjectsFingerprint);assert.equal(sha(read('data/project-lifecycle-20261101.json')),BASELINE.lifecycle);
 assert.equal(sha(read('models/studies-20261101/mcity-m5-design-detail.glb')),'5fd6bd183936e546469e7d07fb7191767bed79f043cc8c74ec1d48727dede1b3');
 assert.deepEqual(asset.replacesSourceIds,[]);assert.deepEqual(asset.replacementModes,[]);assert.equal(asset.lifecycle,'under_construction');assert.deepEqual(asset.modes,['future']);assert.equal(asset.recordedProgress,false);assert.equal(asset.architecturalHeightM,null);assert.equal(asset.heightM,null);assert.equal(asset.heightVerified,false);assert.equal(asset.proxyComparisonVerticalExtentM,117.87167930107422);assert.equal(asset.comparisonWidthM,34);
});
test('the exact accepted M5 GLB remains source-free and future-only while architectural PBR stays intact',async()=>{
 const encoded=read(MODEL_URL),decoded=gunzipSync(encoded);assert.equal(encoded.length,375477);assert.equal(decoded.length,1505248);assert.equal(sha(encoded),GZIP);assert.equal(sha(decoded),RAW);assert.equal(versions.sha256[MODEL_URL],GZIP);
 const gltf=JSON.parse(decoded.subarray(20,20+decoded.readUInt32LE(12)));assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b|private-candidate/);
 const {scene}=await new GLTFLoader().parseAsync(decoded.buffer.slice(decoded.byteOffset,decoded.byteOffset+decoded.byteLength),'');
 const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});assert.equal(meshes.length,56);assert.equal(meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),89856);
 const box=new THREE.Box3().setFromObject(scene,true);assert.deepEqual([box.min.toArray(),box.max.toArray()],asset.bounds);assert.equal(new Set(meshes.map(m=>m.material)).size,10);
 const guards=meshes.filter(m=>m.material.name==='podium-clear-guard');assert.equal(guards.length,2);
 for(const mesh of guards){assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.opacity,72/255);assert.equal(mesh.material.side,THREE.DoubleSide);assert.equal(mesh.material.roughness,.22);assert.equal(mesh.material.metalness,.03);}
 const appearance=createModelAppearance(THREE),materials=meshes.map(m=>m.material);
 for(const mesh of meshes){Object.assign(mesh.userData,{assetId:asset.id,projectId:'mcity-5',sourceAssetSHA256:GZIP,lifecycle:asset.lifecycle,modes:asset.modes,uncertain:true});appearance.register(mesh,{authored:true});}
 for(const mode of ['existing','construction','future']){applyModelVisibility(meshes,mode,{unknownStatuses:false});assert(meshes.every(m=>m.visible===(mode==='future')));}
 appearance.setMode('status');appearance.setMode('natural');meshes.forEach((m,i)=>assert.equal(m.material,materials[i]));guards.forEach(m=>{assert.equal(m.material.transparent,true);assert.equal(m.material.opacity,72/255);});appearance.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
test('M5 standalone view keeps qualified dimensions, proper credit and an exact revision date without redating media',()=>{
 const view=catalogue.views.find(v=>v.id==='mcity-m5'),preview=catalogue.assets.find(a=>a.id==='mcity-m5-v5');assert.deepEqual(view.assets,[preview.id]);assert.equal(preview.sha256,RAW);assert.equal(preview.downloadSHA256,GZIP);assert.equal(preview.url,MODEL_URL);assert.equal(preview.cityDataTerms,false);
 assert.match(view.limits,/not verified measurements/);assert.match(view.credit,/IBI Group \/ Arcadis/);assert.match(view.rights,/no official endorsement/);assert.equal(view.cityURL,'explore.html?district=downtown&project=mcity-5');assert(view.sources.every(s=>s.url.startsWith('https://')));
 assert.deepEqual(view.cameraDirection,[1,.26,-.43]);
 assert.equal(modelRevisionForProject(revisions,catalogue,'mcity-5','mcity-m5').updatedOn,'2026-11-01');assert.deepEqual(revisions.revisions.find(r=>r.id==='mcity-m5-v5-20261101').media,[]);
 const changed=structuredClone(catalogue);changed.assets.find(a=>a.id===preview.id).sha256='a'.repeat(64);assert.equal(modelRevisionForProject(revisions,changed,'mcity-5','mcity-m5'),null);
});


test('M5 opens toward the reviewed front corner with the full height inside desktop and phone frames',()=>{
 const view=catalogue.views.find(v=>v.id==='mcity-m5');
 // The owner review's source-hero native camera offset, converted Blender Z-up
 // to the GLB's Y-up coordinates. Keep that heading with a mild elevated view.
 const reviewedHeading=new THREE.Vector3(268.0478515625,0,-114.6749267578125).normalize();
 const direction=new THREE.Vector3(...view.cameraDirection).normalize();
 assert(new THREE.Vector3(direction.x,0,direction.z).normalize().dot(reviewedHeading)>.999);
 const elevation=THREE.MathUtils.radToDeg(Math.asin(direction.y));assert(elevation>10&&elevation<18);
 const size=new THREE.Vector3().fromArray(asset.bounds[1]).sub(new THREE.Vector3().fromArray(asset.bounds[0]));
 const radius=size.length()/2;
 for(const aspect of [16/10,390/620]){
  const camera=new THREE.PerspectiveCamera(35,aspect,.1,50000);
  const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*aspect);
  camera.position.copy(direction).multiplyScalar(radius/Math.sin(Math.min(vertical,horizontal)/2)*1.08);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
   const projected=new THREE.Vector3(x*size.x/2,y*size.y/2,z*size.z/2).project(camera);
   assert(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z>-1&&projected.z<1,`${aspect}: full model remains in frame`);
  }
 }
});


test('M5 V5 changes the podium only and removes the unpublished V4 delivery identity',()=>{
 const expected=JSON.parse(readFileSync(new URL('./mcity-m5-v5-unchanged-groups.json',import.meta.url))),actual=glbMeshFingerprints(gunzipSync(read(MODEL_URL)));
 assert.equal(Object.keys(expected.groups).length,39);
 for(const [name,pin]of Object.entries(expected.groups))assert.equal(actual[name],pin,name+' geometry and material remain exact');
 const oldURL='models/studies-20261101/mcity-m5-exterior-v4-9a6cbe2229df.glb.gz';
 assert.equal(existsSync(new URL('../public/'+oldURL,import.meta.url)),false);
 assert.equal(versions.sha256[oldURL],undefined);
 assert(!catalogue.assets.some(a=>a.id==='mcity-m5-v4'||a.url===oldURL));assert(!revisions.revisions.some(r=>r.id==='mcity-m5-v4-20261101'));
 assert.deepEqual(catalogue.views.find(v=>v.id==='mcity-m5').cameraDirection,[1,.26,-.43]);
});
import {restoreM1M2Refinements,restoreM1M2Catalogue,restoreM1M2Revisions,restoreM1M2Projects,M1_M2_V5_SCOPE} from './mcity-m1-m2-v5-scope.mjs';
import {PARK26_SCOPE} from './park26-scope.mjs';
