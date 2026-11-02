import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import * as THREE from '../public/vendor/three.module.js';
import {prepareFlatShadowReceiver,inspectFlatShadowReceiver,flatDirectionalShadowVertex,flatDirectionalShadowFragment,FLAT_SHADOW_CACHE_KEY,FLAT_SHADOW_WRAPPER_VERSION} from '../public/flat-shadow-receiver.js';
import {createModelAppearance} from '../public/model-appearance.js';
import {createDaylight} from '../public/daylight.js';

const originalOffset='shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );';
const compile=material=>{const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader,{});return shader;};
test('read-only wrapper inspection retains the exact baseline hook and effective source key',()=>{
 const material=new THREE.MeshStandardMaterial({flatShading:true}),previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
 assert.equal(inspectFlatShadowReceiver(material),null);assert.equal(inspectFlatShadowReceiver(null),null);
 prepareFlatShadowReceiver(THREE,material);const version=material.version,descriptor=inspectFlatShadowReceiver(material);
 assert(Object.isFrozen(descriptor));assert.equal(descriptor.version,FLAT_SHADOW_WRAPPER_VERSION);assert.equal(descriptor.cacheKey,FLAT_SHADOW_CACHE_KEY);
 assert.equal(descriptor.previousCompile,previousCompile);assert.equal(descriptor.previousCacheKeyFunction,previousKey);assert.equal(descriptor.previousCacheKeyBinding,material);
 assert.equal(descriptor.previousCacheKeyMode,'compile-source');assert.equal(descriptor.previousKey(),previousCompile.toString());
 assert.equal(descriptor.installedCompile,material.onBeforeCompile);assert.equal(descriptor.installedCacheKey,material.customProgramCacheKey);
 assert.equal(material.customProgramCacheKey(),previousCompile.toString()+'|'+FLAT_SHADOW_CACHE_KEY);
 assert.equal(inspectFlatShadowReceiver(material),descriptor);assert.equal(material.version,version);
 assert.throws(()=>{descriptor.previousCompile=()=>{};},TypeError);
 assert.equal(inspectFlatShadowReceiver(material.clone()),null,'copied material state is not a registered wrapper');
});
test('inspection does not invoke custom predecessors and rejects either replaced wrapper identity',()=>{
 const material=new THREE.MeshStandardMaterial({flatShading:true});let compileCalls=0,keyCalls=0;
 const priorCompile=function(shader){assert.equal(this,material);compileCalls++;shader.uniforms.prior={value:9};};
 const priorKey=function(){assert.equal(this,material);keyCalls++;return this.userData.cachePrefix;};
 material.userData.cachePrefix='bound-key';material.onBeforeCompile=priorCompile;material.customProgramCacheKey=priorKey;
 prepareFlatShadowReceiver(THREE,material);const descriptor=inspectFlatShadowReceiver(material);
 assert.equal(compileCalls,0);assert.equal(keyCalls,0);assert.equal(descriptor.previousCompile,priorCompile);assert.equal(descriptor.previousCacheKeyFunction,priorKey);
 assert.equal(descriptor.previousCacheKeyMode,'bound-custom');assert.equal(descriptor.previousCacheKeyBinding,material);assert.equal(descriptor.previousKey(),'bound-key');
 assert.equal(compile(material).uniforms.prior.value,9);assert.equal(compileCalls,1);assert.equal(material.customProgramCacheKey(),'bound-key|'+FLAT_SHADOW_CACHE_KEY);
 const counts=[compileCalls,keyCalls],version=material.version;
 material.onBeforeCompile=function(...args){return descriptor.installedCompile.apply(this,args);};
 assert.equal(inspectFlatShadowReceiver(material),null,'even a delegating shader wrapper is unknown');
 material.onBeforeCompile=descriptor.installedCompile;assert.equal(inspectFlatShadowReceiver(material),descriptor);
 material.customProgramCacheKey=()=>descriptor.installedCacheKey();
 assert.equal(inspectFlatShadowReceiver(material),null,'identical returned key does not prove wrapper identity');
 assert.equal(prepareFlatShadowReceiver(THREE,material),true);assert.equal(inspectFlatShadowReceiver(material),null,'idempotent prepare must not certify a replacement');
 material.customProgramCacheKey=descriptor.installedCacheKey;assert.equal(inspectFlatShadowReceiver(material),descriptor);
 assert.deepEqual([compileCalls,keyCalls],counts);assert.equal(material.version,version);
 const impostor=new THREE.MeshStandardMaterial({flatShading:true});impostor.onBeforeCompile=descriptor.installedCompile;impostor.customProgramCacheKey=descriptor.installedCacheKey;impostor.userData.flatShadowReceiver=descriptor;
 assert.equal(inspectFlatShadowReceiver(impostor),null,'copied wrapper functions and public metadata cannot register another material');
});
test('the pinned Three receiver patch changes only directional normal displacement',()=>{
 const source=THREE.ShaderChunk.shadowmap_vertex,derived=flatDirectionalShadowVertex(THREE);
 const guard=/#if defined\( SHADOWMAP_TYPE_PCF \)\n([^]*?)\n#else\n([^]*?)\n#endif/;
 assert.equal((derived.match(guard)||[]).length,3);
 assert.equal(derived.replace(guard,(_,pcf,other)=>other),source,'Basic and VSM retain the complete original vertex chunk');
 assert.equal(derived.replace(guard,(_,pcf)=>pcf),source.replace(originalOffset,'shadowWorldPosition = worldPosition;'),'PCF changes only its directional receiver offset');
 assert(derived.includes('shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias'));
 assert(derived.includes('shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias'));
 assert.throws(()=>flatDirectionalShadowVertex({ShaderChunk:{shadowmap_vertex:source.replace(originalOffset,'changed')}}),/requires review/);
});
test('compile hooks compose and program keys distinguish flat corrected and untouched authored materials',()=>{
 const material=new THREE.MeshStandardMaterial({flatShading:true}),authored=material.clone();let called=0;
 material.onBeforeCompile=shader=>{called++;shader.uniforms.prior={value:3};};material.customProgramCacheKey=()=>'prior-key';
 assert.equal(prepareFlatShadowReceiver(THREE,material),true);const firstKey=material.customProgramCacheKey();assert.equal(firstKey,'prior-key|'+FLAT_SHADOW_CACHE_KEY);
 assert.equal(prepareFlatShadowReceiver(THREE,material),true);assert.equal(material.customProgramCacheKey(),firstKey);
 const shader=compile(material);assert.equal(called,1);assert.equal(shader.uniforms.prior.value,3);assert(shader.fragmentShader.includes('getFlatDirectionalShadow( directionalShadowMap'));
 assert(!shader.vertexShader.includes('#include <shadowmap_vertex>'));assert(shader.vertexShader.includes('vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;'));
 assert.notEqual(authored.customProgramCacheKey(),firstKey);assert(compile(authored).vertexShader.includes('#include <shadowmap_vertex>'));
 assert.equal(prepareFlatShadowReceiver(THREE,new THREE.MeshStandardMaterial()),false);
 assert.throws(()=>material.onBeforeCompile({vertexShader:'missing',uniforms:{}},{}),/include changed/);
});
test('flat PCF depth follows the receiver plane while original spot/point/non-PCF routines stay exact',()=>{
 const {pars,lights}=flatDirectionalShadowFragment(THREE);
 assert(pars.startsWith(THREE.ShaderChunk.shadowmap_pars_fragment));
 assert.equal(lights.replace('getFlatDirectionalShadow( directionalShadowMap','getShadow( directionalShadowMap'),THREE.ShaderChunk.lights_fragment_begin);
 assert(pars.includes('#define getFlatDirectionalShadow getShadow'));
 for(let i=0;i<5;i++)assert(pars.includes(`shadowCoord.z + dot( receiverGradient, vogelDiskSample( ${i}, 5, phi ) * radius )`));
 assert(pars.includes('abs( receiverDet ) > 1e-14'));assert(pars.includes('vec2( 1.0 ) / shadowMapSize'));
 assert.throws(()=>flatDirectionalShadowFragment({ShaderChunk:{...THREE.ShaderChunk,lights_fragment_begin:''}}),/requires review/);
 const changed=THREE.ShaderChunk.shadowmap_pars_fragment.replace('vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z','changed');
 assert.throws(()=>flatDirectionalShadowFragment({ShaderChunk:{...THREE.ShaderChunk,shadowmap_pars_fragment:changed}}),/filter samples changed/);
});
test('receiver-plane comparison removes self-shadow for tilted faces without removing a nearby occluder',()=>{
 // Independent planar shadow-map oracle, including all four hardware PCF taps.
 // A constant sample depth incorrectly shadows these tilted faces; correcting
 // the sample depth leaves the surface lit but still detects a nearer object.
 let oldSelfShadow=0,contactShadows=0;
 for(const size of [2048,4096])for(const gradient of [[.03,.05],[-.06,.02],[.02,-.07],[0,0]])for(let i=0;i<5;i++){
   const radius=Math.sqrt((i+.5)/5)/size,angle=i*2.399963229728653+.7,offset=[Math.cos(angle)*radius,Math.sin(angle)*radius];
   const z=.4,bias=-.000008440599282549062;
   const sampleZ=z+bias+gradient[0]*offset[0]+gradient[1]*offset[1]-(Math.abs(gradient[0])+Math.abs(gradient[1]))/size;
   for(const u of [-.99,.99])for(const v of [-.99,.99]){
     const surface=z+gradient[0]*(offset[0]+u/size)+gradient[1]*(offset[1]+v/size);
     if(z+bias>surface)oldSelfShadow++;
     assert(sampleZ<=surface,'a flat face must not shadow itself');
     if(sampleZ>surface-.0002)contactShadows++;
   }
 }
 assert(oldSelfShadow>20);assert.equal(contactShadows,2*4*5*4);
});
test('natural massing and every planning material correct receivers while authored materials and light stay exact',()=>{
 const appearance=createModelAppearance(THREE),source=new THREE.MeshStandardMaterial({flatShading:true}),sourceCompile=source.onBeforeCompile,sourceKey=source.customProgramCacheKey();
 const generic=new THREE.Mesh(new THREE.BoxGeometry(3,4,5),new THREE.MeshStandardMaterial()),authored=new THREE.Mesh(new THREE.BoxGeometry(2,6,2),source);generic.castShadow=generic.receiveShadow=authored.castShadow=authored.receiveShadow=true;
 appearance.register(generic);appearance.register(authored,{authored:true});assert(compile(generic.material).vertexShader.includes('vDirectionalShadowCoord'));assert.equal(authored.material,source);assert.equal(source.onBeforeCompile,sourceCompile);assert.equal(source.customProgramCacheKey(),sourceKey);
 const scene=new THREE.Scene(),renderer={setClearColor(){},shadowMap:{}},light=createDaylight(THREE,scene,renderer);light.update(new THREE.Vector3(0,30,0),{position:new THREE.Vector3(0,150,150)},2000);const before={bias:light.sun.shadow.bias,normalBias:light.sun.shadow.normalBias,type:renderer.shadowMap.type,enabled:renderer.shadowMap.enabled};
 for(const lifecycle of ['existing','under_construction','approved','proposed','unknown']){generic.userData.lifecycle=lifecycle;appearance.setMode('status');assert(generic.material.customProgramCacheKey().includes(FLAT_SHADOW_CACHE_KEY));compile(generic.material);appearance.setMode('natural');assert.equal(authored.material,source);}
 assert.deepEqual({bias:light.sun.shadow.bias,normalBias:light.sun.shadow.normalBias,type:renderer.shadowMap.type,enabled:renderer.shadowMap.enabled},before);
 for(const mesh of [generic,authored])assert(mesh.castShadow&&mesh.receiveShadow);appearance.dispose();assert.equal(authored.material,source);
});
test('actual affected municipal source and late-loaded detail preserve every position/index byte',async()=>{
 register('./recovery-three-loader.mjs',import.meta.url);const{GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
 const bytes=readFileSync(new URL('../public/models/cooksville.glb',import.meta.url)),root=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex'),meshes=[];root.traverse(m=>{if(m.isMesh&&['existing-91','existing-101'].includes(m.name))meshes.push(m);});assert.equal(meshes.length,2);
 const records=meshes.map(m=>({geometry:m.geometry,position:m.geometry.attributes.position,positionSHA:hash(m.geometry.attributes.position.array),index:m.geometry.index,indexSHA:hash(m.geometry.index.array),material:m.material})),appearance=createModelAppearance(THREE);
 appearance.setMode('status');meshes.forEach(m=>{m.userData.lifecycle='existing';appearance.register(m);assert(m.material.customProgramCacheKey().includes(FLAT_SHADOW_CACHE_KEY));});
 appearance.setMode('natural');for(const[m,r]of meshes.map((m,i)=>[m,records[i]])){assert.equal(m.geometry,r.geometry);assert.equal(m.geometry.attributes.position,r.position);assert.equal(m.geometry.index,r.index);assert.equal(hash(m.geometry.attributes.position.array),r.positionSHA);assert.equal(hash(m.geometry.index.array),r.indexSHA);compile(m.material);appearance.unregister(m);assert.equal(m.material,r.material);}
 appearance.dispose();
});

test('context coverage and flat receiver hooks compose once and masks remain live after updates',async()=>{
 const {setCoverageMask}=await import('../public/neighbour-context.js');
 const {inspectFlatShadowReceiver:inspectContextReceiver}=await import('../public/flat-shadow-receiver.js?v=20261102-shadow3');
 const material=new THREE.MeshStandardMaterial({flatShading:true}),rectangles=[[1,2,30,40],[50,60,70,80]];
 setCoverageMask(THREE,material,rectangles);const shader=compile(material),key=material.customProgramCacheKey();
 const descriptor=inspectContextReceiver(material);assert(descriptor);assert.equal(descriptor.previousCacheKeyMode,'bound-custom');assert.equal(descriptor.previousCacheKeyBinding,material);
 assert.equal(descriptor.previousCacheKeyFunction.call(descriptor.previousCacheKeyBinding),'source-context-coverage-v1');assert.equal(descriptor.previousKey(),'source-context-coverage-v1');
 const prior={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
 descriptor.previousCompile.call(material,prior,{});assert(prior.vertexShader.includes('contextWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;'));
 assert(prior.vertexShader.includes('#include <shadowmap_vertex>'),'the previous hook is exactly coverage, without the receiver wrapper');
 assert.equal(key,'source-context-coverage-v1|'+FLAT_SHADOW_CACHE_KEY);
 assert(shader.vertexShader.includes('contextWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;'));
 assert(shader.vertexShader.includes('#if defined( SHADOWMAP_TYPE_PCF )\nshadowWorldPosition = worldPosition;\n#else\n'+originalOffset+'\n#endif'));
 assert(shader.fragmentShader.includes('contextWorldXZ.x>=r.x'));assert(shader.fragmentShader.includes('discard;'));
 assert.equal(shader.uniforms.coveredRectangleCount.value,2);assert.deepEqual(shader.uniforms.coveredRectangles.value[0].toArray(),rectangles[0]);
 setCoverageMask(THREE,material,[[9,10,11,12]]);assert.equal(material.customProgramCacheKey(),key);assert.equal(shader.uniforms.coveredRectangleCount.value,1);assert.deepEqual(shader.uniforms.coveredRectangles.value[0].toArray(),[9,10,11,12]);
 assert.equal(inspectContextReceiver(material),descriptor);assert.equal(prior.uniforms.coveredRectangleCount.value,1,'bound prior coverage uniforms stay live');
 assert.equal(compile(material).vertexShader,shader.vertexShader);
});
