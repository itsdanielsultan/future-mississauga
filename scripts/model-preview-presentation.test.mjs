import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {previewClipping,applyPreviewAppearance}=await import('../public/model-preview-presentation.js');
const {voyaArchitecturalRole}=await import('../public/voya-appearance.js');
test('model bounds stay within the depth range during orbit, pan and zoom',()=>{
 const radius=67;
 for(const position of [[0,0,200],[300,50,-200],[0,0,10],[0,0,5000]]){
  const distance=Math.hypot(...position),planes=previewClipping(distance,radius);
  assert(planes.near>0&&planes.far>planes.near);
  assert(planes.far>distance+radius);
  if(distance>radius*1.15)assert(planes.near<distance-radius);
  if(distance>radius*2)assert(planes.far/planes.near<4,'distant models retain useful depth precision');
 }
 const planes=previewClipping(300,radius);assert(planes.far/planes.near<2);
 for(const args of [[NaN,1],[1,0],[1,-1]])assert.throws(()=>previewClipping(...args));
 // Panning moves both camera and target. Off-axis radial distance must not
 // push the near plane through geometry still visible at the screen edge.
 const camera=new THREE.PerspectiveCamera(35,1.5,.1,50000);camera.position.set(150,0,300);camera.lookAt(150,0,0);camera.updateMatrixWorld();
 const depth=-new THREE.Vector3().applyMatrix4(camera.matrixWorldInverse).z;
 assert.equal(depth,300);const panned=previewClipping(depth,radius);
 assert(panned.near<300-radius&&panned.far>300+radius);
 assert.equal(previewClipping(-10,radius).near,.05,'a partly forward sphere retains a positive close near plane');
});
test('standalone Voya reuses only the hash-qualified city appearance and restores source materials',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/data/model-previews.json',import.meta.url))),asset=manifest.assets.find(a=>a.id==='voya');
 const bytes=gunzipSync(readFileSync(new URL('../public/'+asset.url,import.meta.url))),scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const originals=[];scene.traverse(mesh=>{if(mesh.isMesh)originals.push({mesh,material:mesh.material,geometry:mesh.geometry,array:mesh.geometry.attributes.position.array.slice()});});
 assert.equal(applyPreviewAppearance(THREE,scene,{...asset,downloadSHA256:'0'.repeat(64)}),null);
 const display=applyPreviewAppearance(THREE,scene,asset);assert(display);
 let roles=0,changed=0;
 for(const {mesh,material,geometry,array}of originals){if(voyaArchitecturalRole(mesh))roles++;if(mesh.material!==material)changed++;assert.equal(mesh.geometry,geometry);assert.deepEqual(mesh.geometry.attributes.position.array,array);}
 assert.equal(roles,95);assert(changed>0&&changed<roles,'qualified planted-area roles retain their original material');
 display.dispose();for(const {mesh,material}of originals)assert.equal(mesh.material,material);
});
