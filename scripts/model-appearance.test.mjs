import {municipalDisplayGeometry,createExistingStyleIndex,existingEnvelopeColour} from '../public/existing-materials.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {ALDO_ROOF_SOURCE,createModelAppearance,NATURAL_MASSING_COLOUR} from '../public/model-appearance.js';
import {statusColours} from '../public/model-status-materials.js';
import {planningAppearanceColour} from '../public/planning-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
const mesh=(lifecycle,material=new THREE.MeshStandardMaterial({color:0x85b4bf}))=>{
 const object=new THREE.Mesh(new THREE.BoxGeometry(5,30,8),material);object.userData={lifecycle,uncertain:true};return object;
};

test('Aldo reflects daylight only on the verified upper roof membrane',()=>{
 const roof=new THREE.MeshStandardMaterial({color:0x171717,roughness:.86,side:THREE.DoubleSide});
 roof.name='Plain black upper flat roof - Kyle correction 2026-10-09';
 const shingles=roof.clone();shingles.name='Sloped shingles';
 const object=mesh('unknown',[shingles,roof]),other=mesh('unknown',roof);
 const data={assetId:ALDO_ROOF_SOURCE.assetId,projectId:ALDO_ROOF_SOURCE.projectId,sourceAssetSHA256:ALDO_ROOF_SOURCE.sha256};
 Object.assign(object.userData,data);Object.assign(other.userData,{...data,sourceAssetSHA256:'changed'});
 const original=object.material,appearance=createModelAppearance(THREE);
 appearance.register(object,{authored:true});appearance.register(other,{authored:true});
 assert.equal(object.material[0],shingles);assert.equal(other.material,roof);
 const display=object.material[1];assert.equal(display.color.getHex(),0x2c2c2c);
 assert.equal(display.roughness,roof.roughness);assert.equal(roof.color.getHex(),0x171717);
 appearance.setMode('status');appearance.setMode('natural');assert.equal(object.material[1],display);
 let disposed=false;display.addEventListener('dispose',()=>{disposed=true;});
 appearance.dispose();assert.equal(object.material,original);assert(disposed);
});

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
 a.setMode('status');assert.equal(objects[2].material.color.getHex(),planningAppearanceColour('approved'));assert.notEqual(objects[3].material,objects[2].material);assert.equal(objects[3].material.color.getHex(),planningAppearanceColour('proposed'));assert.equal(objects[4].material.color.getHex(),planningAppearanceColour('unknown'));assert.notEqual(objects[1].material,objects[4].material);a.dispose();
});

test('release restores originals and disposes only owned display materials once',()=>{
 const a=createModelAppearance(THREE),shared=new THREE.MeshStandardMaterial({color:0x445566}),map=new THREE.Texture();shared.map=map;let sourceDisposals=0,textureDisposals=0;shared.addEventListener('dispose',()=>sourceDisposals++);map.addEventListener('dispose',()=>textureDisposals++);
 const one=mesh('existing',shared),two=mesh('existing',shared);a.register(one);a.register(two,{authored:true});const neutral=one.material;let neutralDisposals=0,statusDisposals=0;neutral.addEventListener('dispose',()=>neutralDisposals++);a.setMode('status');one.material.addEventListener('dispose',()=>statusDisposals++);
 a.dispose();a.dispose();assert.equal(one.material,shared);assert.equal(two.material,shared);assert.equal(sourceDisposals,0);assert.equal(textureDisposals,0);assert.equal(neutralDisposals,1);assert.equal(statusDisposals,1);
});

test('unknown appearance values cannot silently change the selected view',()=>{const a=createModelAppearance(THREE);assert.throws(()=>a.setMode('blue'),TypeError);assert.equal(a.mode,'natural');a.dispose();});

test('district buildings distinguish a registered tower from houses in both appearances while preserving source colours',()=>{
 const index=createExistingStyleIndex({records:[{id:'63-01',tile:63,bounds:[[0,0,0],[5,28,5]]}]});
 const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial());
 mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,1,1,2,1,1,1,15,1,18,2,18,19,2,18,18,8,18],3));
 mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(18).fill(.8),3));
 mesh.userData={tile:63,source:'City of Mississauga LOD2 2024 LiDAR',lifecycle:'existing'};
 const original=mesh.geometry,positions=original.attributes.position,colours=original.attributes.color;
 const appearance=createModelAppearance(THREE,{classifyMunicipal:object=>municipalDisplayGeometry(THREE,object,index)});
 appearance.register(mesh);
 assert.equal(mesh.geometry.attributes.position,positions);
 assert.equal(mesh.userData.majorStyleFaces,1);
 assert(mesh.geometry.attributes.color.getX(0)<mesh.geometry.attributes.color.getX(3));
 assert(mesh.material.vertexColors);
 const display=mesh.material;
 appearance.setMode('status');assert.equal(mesh.material,display);
 const project=mesh.clone();project.geometry=original;project.userData={tile:63,id:'63-01',lifecycle:'proposed'};
 appearance.register(project);assert.equal(project.geometry,original);assert(!project.material.vertexColors);
 const authored=mesh.clone();authored.geometry=original;appearance.register(authored,{authored:true});
 assert.equal(authored.geometry,original);
 appearance.dispose();assert.equal(mesh.geometry,original);assert.equal(original.attributes.color,colours);
});

test('only the exact measured upper triangle is grey when it shares two vertices with a low roof',()=>{
 const tri='0/28000/0,0/46000/0,10000/28000/0';
 const index=createExistingStyleIndex({records:[]},{'63:0:0':[tri]});
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,28,0,0,46,0,10,28,0,10,28,12],3));
 geometry.setIndex([0,1,2,0,2,3]);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 mesh.userData={tile:63,source:'City of Mississauga LOD2 2024 LiDAR',lifecycle:'existing'};
 municipalDisplayGeometry(THREE,mesh,index);
 const display=mesh.geometry,colours=display.attributes.color;
 const dark=colours.getX(display.index.getX(0)),pale=colours.getX(display.index.getX(3));
 assert(dark<pale);
 for(let c=0;c<6;c++)assert.equal(colours.getX(display.index.getX(c)),c<3?dark:pale);
 assert.equal(geometry.attributes.position.count,4);assert.equal(display.attributes.position.count,6);
});

test('only seven measured bodies in the municipal city display use the calibrated existing tones',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const source=JSON.parse(await readFile(new URL('./editions/20261121/plan-massing-materials.json',import.meta.url)));
 const rows=JSON.parse(await readFile(new URL('../public/data/refinement-models.json',import.meta.url))).assets;
 let matched=0;
 for(const [assetId,rule] of Object.entries(source.existingTowerBodies)){
  const asset=rows.find(row=>row.id===assetId);
  const bytes=await readFile(new URL('../public/'+asset.url,import.meta.url));
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,rule.sourceAssetSHA256);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const city=createModelAppearance(THREE,{existingEnvelopeColour}),studio=createModelAppearance(THREE);
  for(const node of gltf.nodes.filter(node=>node.mesh!==undefined)){
   const part=mesh('existing');part.name=THREE.PropertyBinding.sanitizeNodeName(node.name);
   Object.assign(part.userData,{assetId,sourceAssetSHA256:hash,projectId:asset.projectId});
   const selected=rule.nodes.includes(part.name);
   const target=assetId==='block-nine-reference-derived'?'637079':'7e878b';
   for(const mode of ['natural','status']){
    city.setMode(mode);city.register(part);
    assert.equal(part.material.color.getHexString(),selected?target:(mode==='natural'?'d3d8db':'b8b9b6'));
   }
   city.unregister(part);studio.register(part);
   assert.equal(part.material.color.getHex(),NATURAL_MASSING_COLOUR);
   studio.unregister(part);
   if(selected){
    matched++;part.userData.sourceAssetSHA256='unregistered';assert.equal(existingEnvelopeColour(part),null);
   }
  }
  city.dispose();studio.dispose();
 }
 assert.equal(matched,7);
});
