import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createModelAppearance,NATURAL_MASSING_COLOUR} from '../public/model-appearance.js';
import {statusColours} from '../public/model-status-materials.js';
import {planningAppearanceColour} from '../public/planning-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
const mesh=(lifecycle,material=new THREE.MeshStandardMaterial({color:0x85b4bf}))=>{
 const object=new THREE.Mesh(new THREE.BoxGeometry(5,30,8),material);object.userData={lifecycle,uncertain:true};return object;
};

test('natural massing is neutral and authored architecture is restored exactly after status view',()=>{
 const a=createModelAppearance(THREE),voya=mesh('under_construction'),finish=new THREE.MeshPhysicalMaterial({color:0x26394f,roughness:.22,metalness:.35,transmission:.2}),exchange=mesh('under_construction',finish);
 a.register(voya);a.register(exchange,{authored:true});
 assert.equal(a.mode,'natural');assert.equal(voya.material.color.getHex(),NATURAL_MASSING_COLOUR);assert.equal(exchange.material,finish);
 a.setMode('status');assert.equal(voya.material.color.getHex(),statusColours['Under Construction']);assert.equal(exchange.material,voya.material);
 a.setMode('natural');assert.equal(voya.material.color.getHex(),NATURAL_MASSING_COLOUR);assert.equal(exchange.material,finish);a.dispose();
});

test('appearance toggles preserve material arrays, textures, PBR properties and every geometry buffer',()=>{
 const map=new THREE.Texture(),normalMap=new THREE.Texture(),first=new THREE.MeshPhysicalMaterial({color:0x34445a,roughness:.13,metalness:.37,clearcoat:.45,opacity:.65,transparent:true,alphaTest:.2,map,normalMap,side:THREE.FrontSide,depthWrite:false}),second=new THREE.MeshStandardMaterial({color:0xd9c4ac});
 first.normalScale.set(.3,.4);first.userData={source:'authored'};const source=[first,second],object=mesh('approved',source),a=createModelAppearance(THREE);
 object.position.set(2,5,8);object.rotation.y=.4;object.updateMatrix();
 const buffers=Object.fromEntries(Object.entries(object.geometry.attributes).map(([key,attribute])=>[key,Array.from(attribute.array)])),indices=Array.from(object.geometry.index.array),matrix=object.matrix.toArray(),facts=structuredClone(object.userData),before={color:first.color.getHex(),roughness:first.roughness,metalness:first.metalness,clearcoat:first.clearcoat,opacity:first.opacity,transparent:first.transparent,alphaTest:first.alphaTest,side:first.side,depthWrite:first.depthWrite,normalScale:first.normalScale.toArray(),userData:structuredClone(first.userData)};
 a.register(object,{authored:true});for(let i=0;i<3;i++){a.setMode('status');assert.notEqual(object.material,source);a.setMode('natural');assert.equal(object.material,source);}
 assert.equal(first.map,map);assert.equal(first.normalMap,normalMap);assert.deepEqual({color:first.color.getHex(),roughness:first.roughness,metalness:first.metalness,clearcoat:first.clearcoat,opacity:first.opacity,transparent:first.transparent,alphaTest:first.alphaTest,side:first.side,depthWrite:first.depthWrite,normalScale:first.normalScale.toArray(),userData:first.userData},before);
 assert.deepEqual(object.userData,facts);assert.deepEqual(object.matrix.toArray(),matrix);assert.deepEqual(Array.from(object.geometry.index.array),indices);for(const [key,array] of Object.entries(buffers))assert.deepEqual(Array.from(object.geometry.attributes[key].array),array);a.dispose();
});

test('late models inherit selected appearance without replacing their restoration reference',()=>{
 const a=createModelAppearance(THREE);a.setMode('status');const source=new THREE.MeshStandardMaterial({color:0x776655}),late=mesh('proposed',source);
 a.register(late,{authored:true});assert.equal(late.material.color.getHex(),statusColours.Proposed);
 a.register(late,{authored:false});a.setMode('natural');assert.equal(late.material,source,'repeated registration must not capture a display override');
 a.setMode('status');assert.equal(a.unregister(late),true);assert.equal(late.material,source);assert.equal(a.unregister(late),false);a.setMode('natural');assert.equal(late.material,source);a.dispose();
});

test('appearance does not alter scenario filters, phase lifecycle, or uncertain geometry',()=>{
 const a=createModelAppearance(THREE),objects=['existing','under_construction','approved','proposed','unknown','on_hold'].map(state=>mesh(state));objects[1].userData.recordedProgress=false;
 objects.forEach(o=>a.register(o));const facts=objects.map(o=>structuredClone(o.userData));
 for(const scenario of ['existing','construction','future']){
  applyModelVisibility(objects,scenario,{unknownStatuses:false});const flags=objects.map(o=>o.visible);
  for(const appearance of ['status','natural']){a.setMode(appearance);assert.deepEqual(objects.map(o=>o.visible),flags);assert.deepEqual(objects.map(o=>o.userData),facts);}
 }
 a.setMode('status');assert.equal(objects[2].material.color.getHex(),planningAppearanceColour('planned'));assert.equal(objects[3].material,objects[2].material);assert.equal(objects[4].material.color.getHex(),NATURAL_MASSING_COLOUR);assert.notEqual(objects[1].material,objects[4].material);a.dispose();
});

test('release restores originals and disposes only owned display materials once',()=>{
 const a=createModelAppearance(THREE),shared=new THREE.MeshStandardMaterial({color:0x445566}),map=new THREE.Texture();shared.map=map;let sourceDisposals=0,textureDisposals=0;shared.addEventListener('dispose',()=>sourceDisposals++);map.addEventListener('dispose',()=>textureDisposals++);
 const one=mesh('existing',shared),two=mesh('existing',shared);a.register(one);a.register(two,{authored:true});const neutral=one.material;let neutralDisposals=0,statusDisposals=0;neutral.addEventListener('dispose',()=>neutralDisposals++);a.setMode('status');one.material.addEventListener('dispose',()=>statusDisposals++);
 a.dispose();a.dispose();assert.equal(one.material,shared);assert.equal(two.material,shared);assert.equal(sourceDisposals,0);assert.equal(textureDisposals,0);assert.equal(neutralDisposals,1);assert.equal(statusDisposals,1);
});

test('unknown appearance values cannot silently change the selected view',()=>{const a=createModelAppearance(THREE);assert.throws(()=>a.setMode('blue'),TypeError);assert.equal(a.mode,'natural');a.dispose();});
