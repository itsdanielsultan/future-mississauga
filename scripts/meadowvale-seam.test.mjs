import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MEADOWVALE_SEAM_SCOPE as scope,restoreMeadowvaleSeamVersion} from './meadowvale-seam-scope.mjs';
import {assetURL} from '../public/asset-delivery.js';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const json=path=>JSON.parse(read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('Meadowvale uses one exact additive seam asset and retains its original context and historical route',()=>{
 const source=read(scope.asset.url),context=json('data/context-assets.json'),versions=json('data/model-asset-versions.json');
 assert.equal(source.length,4428);assert.equal(sha(source),scope.asset.sha256);assert.equal(versions.sha256[scope.asset.url],scope.asset.sha256);
 assert.deepEqual(context['meadowvale-village'],[scope.existingContextURL,scope.asset.url]);
 assert.deepEqual(Object.entries(context).filter(([,urls])=>urls.includes(scope.asset.url)).map(([id])=>id),['meadowvale-village']);
 assert.equal(sha(read(scope.existingContextURL)),scope.existingContextSHA256);assert.notEqual(assetURL(scope.existingContextURL),scope.existingContextURL);assert.equal(assetURL(scope.asset.url),scope.asset.url);
 assert.equal(scope.originalNativeMeshes,219);assert.equal(scope.originalNativeMeshesChanged,0);
});

test('all 63 seam faces stay vertical within the original source cell boundaries and carry no private metadata',()=>{
 const b=read(scope.asset.url);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 const jsonLength=b.readUInt32LE(12),gltf=JSON.parse(b.subarray(20,20+jsonLength)),bin=b.subarray(28+jsonLength);
 assert.equal(gltf.meshes.length,1);assert.equal(gltf.nodes.length,1);assert.equal(gltf.meshes[0].name,'ParkSourceCellSeamClosure');assert.equal(gltf.materials,undefined);
 assert.equal(gltf.nodes[0].extras.existingTrianglesModified,0);assert.equal(gltf.nodes[0].extras.addedHorizontalFootprintAreaM2,0);assert.equal(gltf.nodes[0].extras.sourceMesh,'Park.001');
 assert(!/\/Users\/|\/private\/|\.blend|privateCandidate|privateOnly/i.test(JSON.stringify(gltf)));
 const position=gltf.accessors[0],index=gltf.accessors[1],pv=gltf.bufferViews[position.bufferView],iv=gltf.bufferViews[index.bufferView];assert.equal(position.count,189);assert.equal(index.count/3,63);assert.equal(position.componentType,5126);assert.equal(index.componentType,5125);
 const vertex=i=>Array.from({length:3},(_,axis)=>bin.readFloatLE(pv.byteOffset+i*12+axis*4));
 for(let i=0;i<index.count;i+=3){const [a,b,c]=[0,1,2].map(j=>vertex(bin.readUInt32LE(iv.byteOffset+(i+j)*4)));const xzArea=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;assert.equal(xzArea,0);assert((a[0]===b[0]&&b[0]===c[0]&&a[0]%50===0)||(a[2]===b[2]&&b[2]===c[2]&&a[2]%50===0));}
});

test('historical model guards accept only the exact reviewed version and preserve every unrelated version',()=>{
 const original=json('data/model-asset-versions.json'),restored=restoreMeadowvaleSeamVersion(structuredClone(original));
 assert.equal(Object.keys(restored.sha256).length,Object.keys(original.sha256).length-1);
 for(const [url,value]of Object.entries(restored.sha256))assert.equal(value,original.sha256[url]);
 for(const bad of [undefined,'0'.repeat(64)]){const data=structuredClone(original);data.sha256[scope.asset.url]=bad;assert.throws(()=>restoreMeadowvaleSeamVersion(data),/exact accepted Meadowvale/);}
 const extra=structuredClone(original);extra.sha256['models/unreviewed.glb']='f'.repeat(64);assert.equal(restoreMeadowvaleSeamVersion(extra).sha256['models/unreviewed.glb'],'f'.repeat(64));
});
