import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {chooseNeighbourDistricts,loadNeighbourContext} from '../public/neighbour-context.js';
const districts=JSON.parse(readFileSync(new URL('../public/data/districts.json',import.meta.url)));
test('nearby source selection stays within four files and 36 MB for every detailed area',()=>{
 for(const d of districts.filter(d=>d.id!=='citywide')){const chosen=chooseNeighbourDistricts(d,districts);assert.ok(chosen.length<=4);assert.ok(chosen.reduce((n,d)=>n+d.bytes,0)<=36000000);assert.ok(!chosen.some(n=>n.id==='citywide'||n.id===d.id));}
 assert.deepEqual(chooseNeighbourDistricts(districts.find(d=>d.id==='streetsville'),districts).map(d=>d.id),['meadowvale','erin-mills','heartland','east-credit-creditview']);
 assert.deepEqual(chooseNeighbourDistricts(districts.find(d=>d.id==='malton'),districts).map(d=>d.id),['airport-corporate']);
});
test('nearby source fallback survives manifest-only replacements without cutting original faces',async()=>{
 const district={id:'focus',bounds:[0,0,100,100],bytes:100},neighbour={id:'nearby',bounds:[-1000,-1000,1100,0],bytes:1000};
 const scene=new THREE.Group(),native=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),fallback=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 native.userData={Status:'Existing',id:'retained-native'};fallback.userData={Status:'Existing',id:'separated-native',sourceLayerSeparated:true,sourceReplacements:[{assetId:'unloaded-study',modes:['existing','construction','future']}]};
 scene.add(native,fallback);const originals=[native,fallback].map(o=>({positions:Array.from(o.geometry.attributes.position.array),indices:Array.from(o.geometry.index.array)}));let cuts=0;
 const result=await loadNeighbourContext({THREE,district,districts:[district,neighbour],loader:{loadAsync:async()=>({scene})},classify:d=>d.Status,overrides:{},styleExisting:()=>{},omittedSourceIds:new Set(['retained-native']),prepareRoot:()=>{cuts++;}});
 assert.equal(cuts,0);assert.equal(result.metrics.drawObjects,2);
 for(const [i,o] of [native,fallback].entries()){assert.equal(o.visible,true);assert.deepEqual(Array.from(o.geometry.attributes.position.array),originals[i].positions);assert.deepEqual(Array.from(o.geometry.index.array),originals[i].indices);assert.equal(o.material.userData.coverageMask.count.value,1);}
});
test('anonymous existing batches survive while geometry stays unchanged and overlapping crops receive coverage masks',async()=>{
 const d={id:'focus',bounds:[0,0,100,100],bytes:100},others=[{id:'north',bounds:[-1000,-1000,1100,0],bytes:1000},{id:'west',bounds:[-1000,-1000,0,1100],bytes:1000}],loaded=[];
 const result=await loadNeighbourContext({THREE,district:d,districts:[d,...others],loader:{loadAsync:async()=>{const scene=new THREE.Group();for(const data of [{Status:'Existing',tile:1},{Status:'Proposed',id:'future'},{Status:'Existing',id:'excluded'}]){const o=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());o.userData=data;o.position.set(1,2,3);scene.add(o);}loaded.push(scene);return {scene};}},classify:d=>d.Status,overrides:{excluded:{excludeDuplicate:true}},omittedSourceIds:new Set(),styleExisting:()=>{}});
 assert.equal(result.root.children.length,2);assert.equal(result.metrics.drawObjects,2);assert.ok(result.metrics.peakGeometryBytes<160000000);
 for(const scene of loaded){assert.equal(scene.children[0].visible,true);assert.deepEqual(scene.children[0].position.toArray(),[1,2,3]);assert.equal(scene.children[1].visible,false);assert.equal(scene.children[2].visible,false);}
 assert.deepEqual(loaded.map(s=>s.children[0].material.userData.coverageMask.count.value).sort(),[1,2]);
});
