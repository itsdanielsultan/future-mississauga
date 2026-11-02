import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import {M1_M2_V5_SCOPE as scope,restoreM1M2Refinements,restoreM1M2Catalogue,restoreM1M2Projects,restoreM1M2Revisions,modelScopeFingerprint} from './mcity-m1-m2-v5-scope.mjs';
import {createModelAppearance} from '../public/model-appearance.js';
import {modelRevisionForProject,mediaModelRevision} from '../public/model-revisions.js';
import {cityModelStudies,loadCityStudy} from '../public/city-model-studies.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {projectDetailsHTML} from '../public/project-cards.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url)),json=p=>JSON.parse(read('data/'+p+'.json')),sha=b=>createHash('sha256').update(b).digest('hex');
const refinements=json('refinement-models'),catalogue=json('model-previews'),revisions=json('model-revisions'),projects=json('projects');
const meshes=root=>{const list=[];root.traverse(o=>{if(o.isMesh)list.push(o)});return list;};
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});
const load=async url=>{const raw=gunzipSync(read(url));return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const fetcher=async url=>{const b=read(url);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};

test('M1/M2 same-ID revision keeps exact masks, lifecycle and every unrelated fact',()=>{
 const prior=restoreM1M2Refinements(structuredClone(refinements));restoreM1M2Catalogue(structuredClone(catalogue));restoreM1M2Revisions(structuredClone(revisions));
 assert.equal(modelScopeFingerprint(restoreM1M2Projects(structuredClone(projects))),scope.priorProjectsFingerprint);
 for(const [file,pin]of Object.entries(scope.facts))assert.equal(sha(read('data/'+file)),pin);
 for(const spec of scope.refinements){const a=refinements.assets.find(a=>a.id===spec.id),old=prior.assets.find(a=>a.id===spec.id);for(const key of ['replacesSourceIds','replacementModes','replacementTriangleKeys','replacementGeometry','lifecycle','modes','geometryDrawingDates','sourceArchiveSHA256'])assert.deepEqual(a[key],old[key],key);assert.deepEqual(a.sources.slice(0,old.sources.length),old.sources);assert.deepEqual(a.sources.slice(-2).map(s=>new URL(s.url).hostname),['www.corearchitects.com','www.rjc.ca']);assert.equal(a.lifecycle,'existing');assert.deepEqual(a.modes,['existing','construction','future']);assert.equal(a.registration.rotationYDegrees,old.registration.rotationYDegrees);assert.deepEqual(a.registration.translation,old.registration.translation);assert.deepEqual(a.registration.podiumVerticalCorrections,old.registration.podiumVerticalCorrections);assert.equal(sha(read(old.url)),old.downloadSHA256);}
 assert.equal(scope.refinements.reduce((n,s)=>n+refinements.assets.find(a=>a.id===s.id).replacementTriangleKeys.length,0),404);
 const html=projectDetailsHTML(projects.find(p=>p.id==='mcity-1-2'));assert.match(html,/low faceted pavilion is coarse or absent/);assert.doesNotMatch(html,/Rev02|Rev03|unchanged inferred tower geometry/);
});

for(const spec of scope.refinements)test(spec.id+' keeps accepted PBR, source normals, original levels and podium geometry',async()=>{
 const a=refinements.assets.find(a=>a.id===spec.id),encoded=read(a.url),raw=gunzipSync(encoded);assert.equal(sha(encoded),a.downloadSHA256);assert.equal(sha(raw),a.sha256);assert.equal(raw.length,a.decodedBytes);const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(b=>!b.uri));assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.pdf\b|\.eml\b/);
 const scene=(await load(a.url)).scene,old=(await load(spec.oldValues.url)).scene,list=meshes(scene),oldList=meshes(old);assert.equal(list.length,a.drawPrimitives);assert.equal(list.filter(m=>m.material.transparent).length,a.transparentPrimitivesRetained);assert.equal(list.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),a.triangles);assert(list.every(m=>m.geometry.attributes.normal));
 const box=new THREE.Box3().setFromObject(scene,true);assert.deepEqual([box.min.toArray(),box.max.toArray()],a.bounds);
 for(const before of oldList){const after=list.find(m=>m.name===before.name);assert(after,before.name);const semantic=before.userData.studySemantic||'';if(semantic==='unchanged-tower'||semantic.startsWith('retained-source-podium:')){const indexBytes=m=>m.geometry.index?Buffer.from(m.geometry.index.array.buffer,m.geometry.index.array.byteOffset,m.geometry.index.array.byteLength):Buffer.alloc(0);assert.equal(sha(indexBytes(after)),sha(indexBytes(before)),before.name+' protected index');const b=before.geometry.attributes.position,c=after.geometry.attributes.position;assert.equal(c.count,b.count);for(let i=0;i<b.count;i++)assert.equal(c.getY(i),b.getY(i),before.name+' level');if(semantic.startsWith('retained-source-podium:'))assert.equal(sha(Buffer.from(c.array.buffer,c.array.byteOffset,c.array.byteLength)),sha(Buffer.from(b.array.buffer,b.array.byteOffset,b.array.byteLength)),before.name+' City podium');}const material=m=>{const j=m.toJSON();delete j.uuid;delete j.metadata;return j;};assert.deepEqual(material(after.material),material(before.material),before.name+' original PBR');}
 const appearance=createModelAppearance(THREE),materials=list.map(m=>m.material);for(const m of list){Object.assign(m.userData,{assetId:a.id,projectId:a.projectId,sourceAssetSHA256:a.downloadSHA256,lifecycle:'existing'});appearance.register(m,{authored:true});}appearance.setMode('status');appearance.setMode('natural');list.forEach((m,i)=>assert.equal(m.material,materials[i]));appearance.dispose();dispose(scene);dispose(old);
});

test('the real city-study loader activates both completed buildings in all three scenarios',async()=>{
 const assets=cityModelStudies(refinements.assets,catalogue).filter(a=>a.projectId==='mcity-1-2');assert.equal(assets.length,2);const roots=[],all=[];
 for(const a of assets){const loaded=await loadCityStudy(THREE,new GLTFLoader(),a,{fetcher,dispose});roots.push(loaded.scene);assert.equal(loaded.sourceAssets.length,1);assert.equal(loaded.sourceAssets[0].url,a.url);const list=meshes(loaded.scene);assert.equal(list.length,a.drawPrimitives);for(const m of list){Object.assign(m.userData,{assetId:a.id,projectId:a.projectId,lifecycle:'existing',modes:a.modes});all.push(m);}}
 for(const mode of ['existing','construction','future']){applyModelVisibility(all,mode,{unknownStatuses:false});assert.equal(all.filter(m=>m.visible).length,365);}
 roots.forEach(dispose);
});

test('individual and paired previews bind revision dates to their exact assets without redating images',()=>{
 for(const id of ['mcity-m1','mcity-m2','mcity-pair']){const view=catalogue.views.find(v=>v.id===id);assert.equal(view.subtitle,'Completed buildings · Approximate exterior');assert.doesNotMatch(view.summary,/unchanged|Rev02|Rev03/);assert.match(view.limits,/Floor sequence/);assert.equal(modelRevisionForProject(revisions,catalogue,'mcity-1-2',id).updatedOn,'2026-11-01');const changed=structuredClone(catalogue);changed.assets.find(a=>a.id===view.assets[0]).sha256='0'.repeat(64);assert.equal(modelRevisionForProject(revisions,changed,'mcity-1-2',id),null);const revision=revisions.revisions.find(r=>r.viewIds.includes(id));assert.deepEqual(revision.media,[]);}
 assert.equal(mediaModelRevision(revisions,{url:'assets/wide/downtown-future.png',sha256:'a'.repeat(64),modelSHA256:catalogue.assets.find(a=>a.id==='mcity-m1').sha256}),null);
});
