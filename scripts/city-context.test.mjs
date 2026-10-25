import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createCityContext,cityContextBudget} from '../public/city-context.js';
const district={id:'study',bounds:[-10,-20,30,40],center:[10,5,10],sourceCropCenter:[10,5,10]};
function mesh(data={}){const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());m.userData=data;m.position.set(100,50,100);return m;}
function group(...children){const g=new THREE.Group();g.add(...children);return {scene:g};}
function controller(loader,contextURLs=['ground.glb'],options={}){const scene=new THREE.Scene(),renderer={};return {scene,renderer,context:createCityContext({THREE,scene,renderer,loader,contextURLs,classify:d=>d.Status,overrides:{superseded:{excludeSuperseded:true}},omittedSourceIds:new Set(['replaced']),styleExisting:o=>{o.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count*3).fill(.5),3));},...options})};}
test('surrounding context is on demand, existing-only and unloaded when hidden',async()=>{
 const ground=mesh(),duplicate=mesh({id:'existing',Status:'Existing'}),existing=mesh({id:'existing',Status:'Existing'}),proposed=mesh({id:'proposed',Status:'Proposed'}),superseded=mesh({id:'superseded',Status:'Existing'}),replaced=mesh({id:'replaced',Status:'Existing'}),calls=[];
 const {context,scene,renderer}=controller({loadAsync:async url=>{calls.push(url);return url==='ground.glb'?group(ground,duplicate):group(existing,proposed,superseded,replaced);}});
 context.setDistrict(district);assert.equal(calls.length,0);await context.setEnabled(true);
 assert.equal(renderer.localClippingEnabled,true);assert.equal(context.ready,true);assert.deepEqual(calls.sort(),['ground.glb','models/citywide.glb']);
 assert.equal(existing.visible,true);assert.equal(replaced.visible,true);for(const o of [duplicate,proposed,superseded])assert.equal(o.visible,false);
 assert.deepEqual(existing.position.toArray(),[100,50,100]);assert.equal(existing.material.clipIntersection,true);
 assert.ok(existing.material.clippingPlanes.every(p=>p.distanceToPoint(new THREE.Vector3(10,5,10))<0));
 const root=scene.children.find(o=>o.name==='Surrounding city overview');assert.equal(root.visible,true);
 await context.setEnabled(false);assert.equal(root.visible,false);assert.equal(root.children.length,0);assert.equal(context.ready,false);await context.setEnabled(true);assert.equal(calls.length,4);
 context.setDistrict({...district,id:'citywide'});assert.equal(root.visible,false);assert.equal(root.children.length,0);assert.equal(context.ready,false);
});
test('failed background load waits for concurrent work, disposes partial assets and can retry',async()=>{
 let first=true,disposed=0;const partial=mesh();partial.geometry.addEventListener('dispose',()=>disposed++);
 const {context,scene}=controller({loadAsync:async url=>{if(url==='bad.glb'&&first){first=false;throw new Error('temporary failure');}await new Promise(r=>setTimeout(r,5));return group(url==='ground.glb'?partial:mesh());}},['ground.glb','bad.glb']);
 context.setDistrict(district);await assert.rejects(context.setEnabled(true),/temporary failure/);assert.equal(context.ready,false);assert.equal(disposed,1);
 const root=scene.children.find(o=>o.name==='Surrounding city overview');assert.equal(root.children.length,0);
 await context.setEnabled(true);assert.equal(context.ready,true);assert.equal(root.visible,true);
});

test('touch or limited-memory policy keeps nearby fine detail off without relying on user agent',async()=>{
 for(const budget of [cityContextBudget({coarsePointer:true}),cityContextBudget({coarsePointer:false,deviceMemory:4})]){
  const calls=[],status=[];
  const {context}=controller({loadAsync:async url=>{calls.push(url);return group(mesh({Status:'Existing'}));}},['ground.glb'],{resourceBudget:budget,districts:[district,{id:'nearby',bounds:[-1000,-1000,0,1000],bytes:1000}],onStatus:text=>status.push(text)});
  context.setDistrict(district);await context.setEnabled(true);
  assert.equal(budget.concurrency,1);assert.deepEqual(calls,['ground.glb','models/citywide.glb']);assert.match(status.at(-1),/fine detail stays off/);
 }
 assert.equal(cityContextBudget({coarsePointer:false,deviceMemory:8}).neighbours.maxFiles,4);
});

test('off during decoding discards the late asset and does not schedule the remaining files',async()=>{
 let resolveFirst,disposed=0;const calls=[],partial=mesh();partial.geometry.addEventListener('dispose',()=>disposed++);
 const {context,scene}=controller({loadAsync:url=>{calls.push(url);return new Promise(resolve=>{resolveFirst=resolve;});}},['one.glb','two.glb'],{resourceBudget:cityContextBudget({coarsePointer:true})});
 context.setDistrict(district);const pending=context.setEnabled(true);
 await context.setEnabled(false);resolveFirst(group(partial));await pending;
 assert.deepEqual(calls,['one.glb']);assert.equal(disposed,1);assert.equal(context.ready,false);assert.equal(scene.children[0].children.length,0);
});

test('rapid off/on and area updates share one decoder batch and preserve only the newest view',async()=>{
 let resolveFirst,calls=0,active=0,peak=0;const loaded=[];
 const {context,scene}=controller({loadAsync:async()=>{
  calls++;active++;peak=Math.max(peak,active);
  if(calls===1)await new Promise(resolve=>{resolveFirst=resolve;});
  const item=mesh({Status:'Existing'});loaded.push(item);active--;return group(item);
 }},['ground.glb'],{resourceBudget:cityContextBudget({coarsePointer:true})});
 context.setDistrict(district);const initial=context.setEnabled(true);await context.setEnabled(false);
 const latest=context.setEnabled(true);context.setDistrict({...district,id:'new-area'});resolveFirst();await Promise.all([initial,latest]);
 assert.equal(peak,1);assert.equal(calls,3);assert.equal(context.ready,true);assert.equal(scene.children[0].children.length,2);
 assert.equal(scene.children[0].visible,true);
 await context.setEnabled(false);assert.equal(scene.children[0].children.length,0);
});

test('overview memory limit fails closed, releases partial assets and permits a clean retry',async()=>{
 let large=true,disposed=0;const budget={...cityContextBudget({coarsePointer:true}),maxGeometryBytes:5000};
 const {context,scene}=controller({loadAsync:async()=>{
  const item=mesh({Status:'Existing'});
  if(large)item.geometry.setAttribute('large',new THREE.BufferAttribute(new Float32Array(2000),1));
  item.geometry.addEventListener('dispose',()=>disposed++);return group(item);
 }},['ground.glb'],{resourceBudget:budget});
 context.setDistrict(district);await assert.rejects(context.setEnabled(true),/memory budget/);
 assert.equal(context.ready,false);assert.equal(scene.children[0].children.length,0);assert.equal(disposed,1);
 large=false;await context.setEnabled(true);assert.equal(context.ready,true);
});
