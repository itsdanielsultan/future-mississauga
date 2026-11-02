import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {createModelAppearance}=await import('../public/model-appearance.js');
const {applyModelVisibility}=await import('../public/model-visibility.js');
const {VOYA_ARCHITECTURAL_SOURCE:source,VOYA_ARCHITECTURAL_ROLES:roles,VOYA_ARCHITECTURAL_PALETTE:palette,voyaArchitecturalRole}=await import('../public/voya-appearance.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const geometryState=geometry=>({attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>[key,{count:a.count,itemSize:a.itemSize,normalized:a.normalized,sha256:sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))}])),index:sha(Buffer.from(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength))});
const sourceMaterialState=material=>{const state=material.toJSON();delete state.uuid;return state;};
async function meshes(){
 const bytes=readFileSync(new URL('../public/models/refinement/voya-towers-plan-derived.glb',import.meta.url));assert.equal(sha(bytes),source.sha256);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),{scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
 const found=[];scene.traverse(mesh=>{if(mesh.isMesh){Object.assign(mesh.userData,{assetId:source.assetId,sourceAssetSHA256:source.sha256,lifecycle:'under_construction',displayStatus:'Under Construction'});found.push(mesh)}});return found;
}

test('every one of the95 pinned Voya source meshes matches exactly one architectural role',async()=>{
 const all=await meshes();assert.equal(all.length,95);assert.equal(roles.length,95);assert.equal(new Set(roles.map(r=>r[0])).size,95);
 const counts={glass:0,band:0,garden:0};
 for(const mesh of all){const role=voyaArchitecturalRole(mesh);assert(role,mesh.name);counts[role]++;assert.equal(mesh.userData.projectId,'voya');assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);}
 assert.deepEqual(counts,{glass:11,band:73,garden:11});
 assert.deepEqual(palette.glass,{color:0x46545b,roughness:.36,metalness:.12,vertexColors:false});assert.deepEqual(palette.band,{color:0xe3e4df,roughness:.8,metalness:0,vertexColors:false});
});

test('all95 real meshes retain exact source materials, vertex colours, geometry, transforms and facts through natural/status cycles',async()=>{
 for(const authored of [false,true]){
  const all=await meshes(),appearance=createModelAppearance(THREE),saved=[];let sourceDisposed=0,displayDisposed=0;
  for(const mesh of all){
   const original=mesh.material,role=voyaArchitecturalRole(mesh),data=structuredClone(mesh.userData),geometry=mesh.geometry,geometryBefore=geometryState(geometry),materialBefore=sourceMaterialState(original),matrix=mesh.matrixWorld.toArray();original.addEventListener('dispose',()=>sourceDisposed++);
   appearance.register(mesh,{authored});const natural=mesh.material;
   if(role==='garden')assert.equal(natural,original,'Exact planted areas retain their original vertex colours');
   else{
    assert.notEqual(natural,original);assert.equal(natural.color.getHex(),palette[role].color);assert.equal(natural.roughness,palette[role].roughness);assert.equal(natural.metalness,palette[role].metalness);assert.equal(natural.vertexColors,false);
    const after=sourceMaterialState(natural),before={...materialBefore};for(const key of ['color','roughness','metalness','vertexColors']){delete after[key];delete before[key];}assert.deepEqual(after,before,'No unrelated source PBR property changes');natural.addEventListener('dispose',()=>displayDisposed++);
   }
   saved.push({mesh,original,natural,geometry,geometryBefore,materialBefore,matrix,data});
  }
  for(const scenario of ['existing','construction','future']){
   applyModelVisibility(all,scenario,{unknownStatuses:true});const visibility=all.map(m=>m.visible);
   for(let n=0;n<2;n++){
    appearance.setMode('status');const uniform=all[0].material;assert.equal(uniform.color.getHex(),0x85b4bf);assert(all.every(m=>m.material===uniform),'All95 use the same current planning group');
    appearance.setMode('natural');saved.forEach(({mesh,natural})=>assert.equal(mesh.material,natural));assert.deepEqual(all.map(m=>m.visible),visibility);
   }
  }
  for(const {mesh,original,geometry,geometryBefore,materialBefore,matrix,data} of saved){assert.equal(mesh.geometry,geometry);assert.deepEqual(geometryState(geometry),geometryBefore);assert.deepEqual(sourceMaterialState(original),materialBefore);assert.deepEqual(mesh.matrixWorld.toArray(),matrix);assert.deepEqual(mesh.userData,data);}
  appearance.dispose();appearance.dispose();assert.equal(sourceDisposed,0);assert.equal(displayDisposed,84);saved.forEach(({mesh,original})=>assert.equal(mesh.material,original));
 }
});

test('each exact source identity, mesh name, ID and full architecture role is required independently',async()=>{
 const template=(await meshes())[0];
 for(const change of [m=>m.userData.assetId='other',m=>m.userData.projectId='other',m=>m.userData.sourceAssetSHA256='changed',m=>m.name+='-other',m=>m.userData.id+='-other',m=>m.userData.architectureRole+=' altered',m=>delete m.userData.architectureRole]){
  const copy=template.clone();copy.userData=structuredClone(template.userData);change(copy);assert.equal(voyaArchitecturalRole(copy),null);
 }
 const copy=template.clone();copy.material=template.material.clone();copy.material.color.setHex(0x85b4bf);assert.equal(voyaArchitecturalRole(copy),'glass','Display role never depends on input RGB');
 copy.material.map=new THREE.Texture();assert.equal(voyaArchitecturalRole(copy),null,'Linked source textures are not flattened');copy.material=[template.material];assert.equal(voyaArchitecturalRole(copy),null,'Unexpected multi-material source is not flattened');
});

test('late Voya meshes inherit status and restore the same role finish without capturing a display material',async()=>{
 const mesh=(await meshes())[0],original=mesh.material,appearance=createModelAppearance(THREE,{initial:'status'});appearance.register(mesh);assert.equal(mesh.material.color.getHex(),0x85b4bf);appearance.register(mesh,{authored:true});appearance.setMode('natural');assert.equal(mesh.material.color.getHex(),palette.glass.color);appearance.unregister(mesh);assert.equal(mesh.material,original);appearance.dispose();
});
