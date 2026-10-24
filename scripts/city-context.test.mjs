import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createCityContext} from '../public/city-context.js';
const district={id:'study',bounds:[-10,-20,30,40],center:[10,5,10],sourceCropCenter:[10,5,10]};
function mesh(data={}){const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());m.userData=data;m.position.set(100,50,100);return m;}
function group(...children){const g=new THREE.Group();g.add(...children);return {scene:g};}
function controller(loader,contextURLs=['ground.glb']){const scene=new THREE.Scene(),renderer={};return {scene,renderer,context:createCityContext({THREE,scene,renderer,loader,contextURLs,classify:d=>d.Status,overrides:{superseded:{excludeSuperseded:true}},omittedSourceIds:new Set(['replaced']),styleExisting:o=>{o.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count*3).fill(.5),3));}})};}
test('surrounding context is on demand, cached, existing-only and clipped around unchanged detail coordinates',async()=>{
 const ground=mesh(),duplicate=mesh({id:'existing',Status:'Existing'}),existing=mesh({id:'existing',Status:'Existing'}),proposed=mesh({id:'proposed',Status:'Proposed'}),superseded=mesh({id:'superseded',Status:'Existing'}),replaced=mesh({id:'replaced',Status:'Existing'}),calls=[];
 const {context,scene,renderer}=controller({loadAsync:async url=>{calls.push(url);return url==='ground.glb'?group(ground,duplicate):group(existing,proposed,superseded,replaced);}});
 context.setDistrict(district);assert.equal(calls.length,0);await context.setEnabled(true);
 assert.equal(renderer.localClippingEnabled,true);assert.equal(context.ready,true);assert.deepEqual(calls.sort(),['ground.glb','models/citywide.glb']);
 assert.equal(existing.visible,true);assert.equal(replaced.visible,true);for(const o of [duplicate,proposed,superseded])assert.equal(o.visible,false);
 assert.deepEqual(existing.position.toArray(),[100,50,100]);assert.equal(existing.material.clipIntersection,true);
 assert.ok(existing.material.clippingPlanes.every(p=>p.distanceToPoint(new THREE.Vector3(10,5,10))<0));
 const root=scene.children.find(o=>o.name==='Surrounding city overview');assert.equal(root.visible,true);
 await context.setEnabled(false);assert.equal(root.visible,false);await context.setEnabled(true);assert.equal(calls.length,2);
 context.setDistrict({...district,id:'citywide'});assert.equal(root.visible,false);
});
test('failed background load waits for concurrent work, disposes partial assets and can retry',async()=>{
 let first=true,disposed=0;const partial=mesh();partial.geometry.addEventListener('dispose',()=>disposed++);
 const {context,scene}=controller({loadAsync:async url=>{if(url==='bad.glb'&&first){first=false;throw new Error('temporary failure');}await new Promise(r=>setTimeout(r,5));return group(url==='ground.glb'?partial:mesh());}},['ground.glb','bad.glb']);
 context.setDistrict(district);await assert.rejects(context.setEnabled(true),/temporary failure/);assert.equal(context.ready,false);assert.equal(disposed,1);
 const root=scene.children.find(o=>o.name==='Surrounding city overview');assert.equal(root.children.length,0);
 await context.setEnabled(true);assert.equal(context.ready,true);assert.equal(root.visible,true);
});
