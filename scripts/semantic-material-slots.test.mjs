import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const {SEMANTIC_MATERIAL_ASSETS,semanticMaterialSlots}=await import('../public/semantic-material-slots.js');
const {createModelAppearance,NATURAL_MASSING_COLOUR}=await import('../public/model-appearance.js');
const {voyaArchitecturalRole,VOYA_ARCHITECTURAL_PALETTE}=await import('../public/voya-appearance.js');
const assets=JSON.parse(readFileSync(new URL('../public/data/refinement-models.json',import.meta.url))).assets;
const counts={'south-banks-plan-derived':16,'harbourwalk-terraced-reference':240,'voya-towers-plan-derived':20,'wf-128-current-plan':12,'wf-170-settlement-envelope':1,'south-common-source-derived-preview':1};
const withoutColour=value=>{const copy=structuredClone(value);delete copy.uuid;delete copy.color;return copy;};

test('every exact semantic slot resolves in its pinned public GLB; other source materials and geometry remain intact',async()=>{
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let matched=0;
 for(const [id,policy] of Object.entries(SEMANTIC_MATERIAL_ASSETS)){
  const asset=assets.find(a=>a.id===id);assert(asset,id);assert.equal(policy.slots.length,counts[id]);
  const bytes=readFileSync(new URL('../public/'+asset.url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),policy.sha256,id+' exact source bytes');
  assert.equal(asset.downloadSHA256||asset.sha256,policy.sha256);
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});const controller=createModelAppearance(THREE);let resolved=0;
  for(const mesh of meshes){
   Object.assign(mesh.userData,{assetId:id,projectId:asset.projectId,sourceAssetSHA256:policy.sha256,lifecycle:asset.lifecycle});
   const original=mesh.material,sources=Array.isArray(original)?original:[original],serialized=sources.map(m=>m.toJSON()),geometry=mesh.geometry,positions=[...geometry.attributes.position.array];
   const slots=semanticMaterialSlots(mesh),voyaRole=voyaArchitecturalRole(mesh);resolved+=slots.length;
   // Force the retained/native path too: the five schematic runtime assets
   // currently use generic neutral massing, but historical retained slots must
   // remain safe if loaded through a preserved-material path.
   controller.register(mesh,{authored:true});const natural=mesh.material,shown=Array.isArray(natural)?natural:[natural];
   for(let i=0;i<sources.length;i++){
    assert.deepEqual(sources[i].toJSON(),serialized[i]);
    if(voyaRole==='garden')assert.equal(shown[i],sources[i],'Exact Voya planted-area source finish');
    else if(voyaRole){assert.notEqual(shown[i],sources[i]);assert.equal(shown[i].color.getHex(),VOYA_ARCHITECTURAL_PALETTE[voyaRole].color);}
    else if(slots.includes(i)){assert.notEqual(shown[i],sources[i]);assert.equal(shown[i].color.getHex(),NATURAL_MASSING_COLOUR);assert.deepEqual(withoutColour(shown[i].toJSON()),withoutColour(serialized[i]));}
    else assert.equal(shown[i],sources[i],id+' nonsemantic material reference');
   }
   if(!slots.length&&!voyaRole)assert.equal(natural,original);
   controller.setMode('status');controller.setMode('natural');assert.equal(mesh.material,natural);
   assert.equal(mesh.geometry,geometry);assert.deepEqual([...geometry.attributes.position.array],positions);
   controller.unregister(mesh);assert.equal(mesh.material,original);sources.forEach(m=>m.dispose());geometry.dispose();
  }
  assert.equal(resolved,counts[id],id+' exact runtime slot count');matched+=resolved;controller.dispose();
 }
 assert.equal(matched,290);
});

function fixture(){
 const assetId='south-common-source-derived-preview',policy=SEMANTIC_MATERIAL_ASSETS[assetId];
 const semantic=new THREE.MeshPhysicalMaterial({color:0x85b4bf,roughness:.27,metalness:.31,clearcoat:.4,opacity:.6,transparent:true,depthWrite:false,side:THREE.FrontSide}),finish=new THREE.MeshStandardMaterial({color:0x85b4bf});
 semantic.normalMap=new THREE.Texture();semantic.normalScale.set(.2,.4);
 const original=[semantic,finish],mesh=new THREE.Mesh(new THREE.BoxGeometry(),original);
 mesh.name=policy.slots[0][0];mesh.userData={assetId,projectId:policy.projectId,sourceAssetSHA256:policy.sha256,lifecycle:'under_construction'};
 return {mesh,original,semantic,finish,policy};
}
test('known semantic slot clones only its colour; same-colour adjacent authored finish remains the exact source reference',()=>{
 const f=fixture(),controller=createModelAppearance(THREE);let originalDisposed=0,cloneDisposed=0;
 f.semantic.addEventListener('dispose',()=>originalDisposed++);controller.register(f.mesh,{authored:true});
 const [clone,finish]=f.mesh.material;clone.addEventListener('dispose',()=>cloneDisposed++);
 assert.equal(finish,f.finish);assert.equal(clone.normalMap,f.semantic.normalMap);assert.deepEqual(clone.normalScale.toArray(),[.2,.4]);assert.equal(f.semantic.color.getHex(),0x85b4bf);
 assert.deepEqual(withoutColour(clone.toJSON()),withoutColour(f.semantic.toJSON()));
 controller.setMode('status');controller.setMode('natural');assert.equal(f.mesh.material[0],clone);controller.unregister(f.mesh);assert.equal(f.mesh.material,f.original);assert.equal(cloneDisposed,1);assert.equal(originalDisposed,0);controller.dispose();assert.equal(cloneDisposed,1);
});
test('wrong asset, project, identity or source hash never qualifies a coincidentally similar architectural colour',()=>{
 for(const alter of [f=>f.mesh.userData.assetId='different',f=>f.mesh.userData.projectId='different',f=>f.mesh.name='different',f=>f.mesh.userData.sourceAssetSHA256='changed']){
  const f=fixture();alter(f);const controller=createModelAppearance(THREE);assert.deepEqual(semanticMaterialSlots(f.mesh),[]);controller.register(f.mesh,{authored:true});assert.equal(f.mesh.material,f.original);controller.setMode('status');controller.setMode('natural');assert.equal(f.mesh.material,f.original);controller.dispose();
 }
});
test('exact userData id is accepted as identity, while a texture-linked material is retained untouched',()=>{
 const [assetId,policy]=Object.entries(SEMANTIC_MATERIAL_ASSETS).find(([,p])=>p.slots.some(([,id])=>id!==null));const [name,id]=policy.slots[0];
 const material=new THREE.MeshStandardMaterial({color:0x85b4bf,map:new THREE.Texture()}),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.name='loader-alias';mesh.userData={assetId,projectId:policy.projectId,sourceAssetSHA256:policy.sha256,id};
 assert.deepEqual(semanticMaterialSlots(mesh),[0]);const controller=createModelAppearance(THREE);controller.register(mesh,{authored:true});assert.equal(mesh.material,material);controller.dispose();
});
