import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {UPTOWN_SCOPE as scope,uptownFingerprint,restoreUptownEligibility} from './uptown-neighbour-scope.mjs';
import {createUptownContextReplacement} from '../public/uptown-context-replacement.js';
import {splitSourceOverlaps} from '../public/source-layer-cut.js';
import {createCityContext,cityContextBudget} from '../public/city-context.js';
import {refinementInDistrict} from '../public/refinement-loading.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const json=path=>JSON.parse(read('data/'+path+'.json'));
const manifest=json('refinement-models'),districts=json('districts');
const m1=manifest.assets.find(asset=>asset.id==='mcity-m1-20261025-exterior-study');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const meshes=root=>{const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;};
const triangles=mesh=>(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
const load=async name=>{const bytes=read('models/'+name+'.glb');return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
const dispose=root=>{for(const mesh of meshes(root)){mesh.geometry.dispose();for(const material of [mesh.material].flat())material.dispose();}};

test('Uptown changes only eligibility on three exact assets, preserving every original asset field',()=>{
 assert.equal(sha(read('uptown-context-replacement.js')),scope.moduleSHA256);
 assert.equal(uptownFingerprint(manifest),scope.currentRegistryFingerprint);
 const restored=structuredClone(manifest);restored.assets.forEach(restoreUptownEligibility);
 assert.equal(uptownFingerprint(restored),scope.priorRegistryFingerprint);
 for(const spec of scope.assets){
  const row=manifest.assets.find(asset=>asset.id===spec.id);
  assert.deepEqual(row.forceDistricts,['uptown']);assert(refinementInDistrict(row,districts.find(district=>district.id==='uptown')));
  for(const mutate of [r=>r.forceDistricts.push('malton'),r=>r.url+='changed',r=>r.modes=['existing'],r=>r.sha256='0'.repeat(64)]){
   const changed=structuredClone(row);mutate(changed);assert.throws(()=>restoreUptownEligibility(changed));
  }
 }
 assert.equal(m1.replacementTriangleKeys.length,136);
 const app=read('app.js').toString();
 assert.match(app,/surroundingCity\?\.updateSourceReplacements\(which,visibility.visibleAssetIds\)/);
 assert.match(app,/uptownReplacementAsset:refinementData.assets.find\(a=>a.id==='mcity-m1-20261025-exterior-study'\),splitSourceOverlaps/);
});

test('real municipal overview and Downtown context retain all geometry and restore M1 fallback only when the detailed asset is visible',async()=>{
 const root=new THREE.Group();root.add(await load('citywide'),await load('downtown'));
 const originals=meshes(root),before=new Map(originals.map(mesh=>[mesh,{positions:mesh.geometry.attributes.position,indices:Array.from(mesh.geometry.index?.array||[]),material:mesh.material,matrix:mesh.matrix.clone(),visible:mesh.visible,triangles:triangles(mesh)}]));
 const replacement=createUptownContextReplacement({THREE,asset:m1,splitSourceOverlaps}),audit=replacement.prepare(root),fallbacks=meshes(root).filter(mesh=>mesh.userData.uptownContextReplacement);
 assert.equal(audit.length,2);assert.equal(fallbacks.length,2);assert(fallbacks.every(mesh=>triangles(mesh)===136));
 assert.equal(meshes(root).reduce((sum,mesh)=>sum+triangles(mesh),0),originals.reduce((sum,mesh)=>sum+before.get(mesh).triangles,0),'source faces are partitioned, never deleted');
 const afterPrepare=meshes(root).map(mesh=>mesh.geometry);
 assert.deepEqual(replacement.prepare(root),[]);assert.deepEqual(meshes(root).map(mesh=>mesh.geometry),afterPrepare,'repeat preparation cannot split again');
 for(const [scenario,visible,district] of [['future',true,'uptown'],['construction',true,'uptown'],['existing',true,'uptown'],['future',false,'uptown'],['future',true,'uptown'],['future',true,'downtown'],['future',false,'uptown']]){
  const active=visible&&district==='uptown',state=replacement.update(root,{district,scenario,visibleAssetIds:new Set(visible?[m1.id]:[])});
  assert.equal(state.fallbackTriangles,272);assert.equal(state.hiddenTriangles,active?272:0);
  assert(fallbacks.every(mesh=>mesh.visible===!active));
  for(const mesh of originals){const previous=before.get(mesh);assert.equal(mesh.geometry.attributes.position,previous.positions);assert.equal(mesh.material,previous.material);assert.deepEqual(mesh.matrix,previous.matrix);assert.equal(mesh.visible,previous.visible,'Avia and every unregistered original retain visibility');if(!mesh.userData.preserveSourceNormals)assert.deepEqual(Array.from(mesh.geometry.index?.array||[]),previous.indices);}
 }
 dispose(root);
});

test('real surrounding-city loader binds visibility before asynchronous load and restores fallback on area changes or hidden asset',async()=>{
 const scene=new THREE.Scene(),context=createCityContext({THREE,scene,renderer:{},loader:{loadAsync:async()=>({scene:await load('citywide')})},contextURLs:[],classify:data=>data.Status,overrides:{},styleExisting(){},districts,uptownReplacementAsset:m1,splitSourceOverlaps,resourceBudget:cityContextBudget({coarsePointer:true})});
 context.setDistrict(districts.find(district=>district.id==='uptown'));
 context.updateSourceReplacements('future',new Set([m1.id]));await context.setEnabled(true);
 assert.equal(context.sourceReplacementAudit.visibility.hiddenTriangles,136);
 for(const scenario of ['existing','construction','future'])assert.equal(context.updateSourceReplacements(scenario,new Set([m1.id])).hiddenTriangles,136);
 assert.equal(context.updateSourceReplacements('future',new Set()).hiddenTriangles,0);
 assert.equal(context.updateSourceReplacements('future',new Set([m1.id])).hiddenTriangles,136);
 context.setDistrict(districts.find(district=>district.id==='downtown'));assert.equal(context.sourceReplacementAudit.visibility.hiddenTriangles,0);
 await context.setEnabled(false);assert.equal(context.ready,false);assert.equal(context.sourceReplacementAudit.visibility.fallbackTriangles,0);
});

test('unbound or incomplete replacement policy fails closed',()=>{
 assert.throws(()=>createUptownContextReplacement({THREE,asset:{...m1,replacementTriangleKeys:m1.replacementTriangleKeys.slice(1)},splitSourceOverlaps}),/binding/);
 assert.throws(()=>createUptownContextReplacement({THREE,asset:{...m1,id:'other'},splitSourceOverlaps}),/binding/);
 assert.throws(()=>createUptownContextReplacement({THREE,asset:m1}),/binding/);
});
