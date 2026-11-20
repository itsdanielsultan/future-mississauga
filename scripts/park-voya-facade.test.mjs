import {restoreUptownEligibility} from './uptown-neighbour-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {register} from 'node:module';
import {QUALIFIED_FACADE_SCOPE as scope,qualifiedFacadeFingerprint,restoreQualifiedFacadeFields,restoreQualifiedFacadeVersions} from './park-voya-facade-scope.mjs';
import {loadModelAsset} from '../public/refinement-loading.js';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../public/vendor/meshopt_decoder.mjs');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const row=id=>JSON.parse(read('data/refinement-models.json')).assets.find(asset=>asset.id===id);
const decode=path=>path.endsWith('.gz')?gunzipSync(read(path)):read(path);
const meshes=scene=>{const found=[];scene.updateMatrixWorld(true);scene.traverse(mesh=>{if(mesh.isMesh)found.push(mesh);});return found;};
const material=source=>{const json=source.toJSON();delete json.uuid;return json;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const load=async path=>{const bytes=decode(path);return(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};

test('qualified public files, sidecars and historical models retain their exact accepted bytes',()=>{
 for(const [path,pin] of Object.entries({...scope.files,...scope.historicalFiles})){const bytes=read(path);assert.equal(bytes.length,pin.bytes,path);assert.equal(hash(bytes),pin.sha256,path);}
 for(const [id,pin] of Object.entries(scope.assets)){
  const asset=row(id),compressed=read(pin.newURL),raw=decode(pin.newURL);assert(pin.newURL.endsWith('.glb.gz'));assert.deepEqual(raw,read(pin.publicRawURL));
  assert.equal(asset.bytes,compressed.length);assert.equal(asset.decodedBytes,raw.length);
  assert.equal(hash(compressed),asset.sha256);assert.equal(hash(raw),asset.decodedSHA256);assert.equal(asset.downloadSHA256,asset.sha256);
  const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
  assert.equal(gltf.images?.length||0,0);assert.equal(gltf.textures?.length||0,0);assert(gltf.buffers.every(buffer=>!buffer.uri));
  assert.doesNotMatch(JSON.stringify(gltf),/\/Users\/|\.blend\b|\.eml\b/);
 }
});

test('public derivatives change only recorded review labels and retain the accepted candidate binary chunks',()=>{
 for(const [id,proof] of Object.entries(scope.publicDerivatives)){
  const bytes=decode(scope.assets[id].newURL),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength));
  assert.equal(hash(bytes.subarray(20+jsonLength)),proof.binaryChunksSHA256,id+' unchanged BIN');
  assert.equal(row(id).sourceCandidateSHA256,proof.sourceCandidateSHA256);
  for(const change of proof.metadataChanges){let object=gltf;for(const key of change.path.slice(0,-1))object=object[key];const key=change.path.at(-1);assert.deepEqual(object[key],change.after);object[key]=change.before;}
  assert.equal(hash(JSON.stringify(stable(gltf))),proof.sourceCanonicalJSONSHA256,id+' all non-publication JSON unchanged');
 }
});

test('normal model loading transfers only the compressed routes and decodes the complete accepted scenes',async()=>{
 const requests=[];
 for(const [id,count] of [['wf-26park-current-plan',112],['voya-towers-plan-derived',103]]){
  const asset=row(id),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.loadAsync=()=>assert.fail('The registered route must use compressed model loading');
  const result=await loadModelAsset(loader,asset.url,url=>url,async url=>{const bytes=read(url);requests.push({url,bytes:bytes.length});return new Response(bytes);});
  assert.equal(meshes(result.scene).length,count);assert.deepEqual(requests.at(-1),{url:asset.url,bytes:asset.bytes});
 }
 assert.deepEqual(requests.map(request=>request.bytes),[673678,313275]);assert(requests.every(request=>request.url.endsWith('.glb.gz')));
});

for(const [id,oldCount,newCount,triangles] of [['wf-26park-current-plan',35,112,58968],['voya-towers-plan-derived',95,103,69160]])
test(id+' adds only accepted facade groups while every original mesh, material, level and transform stays exact',async()=>{
 const pin=scope.assets[id],original=await load(pin.oldURL),accepted=await load(pin.newURL),oldMeshes=meshes(original),newMeshes=meshes(accepted);
 assert.equal(oldMeshes.length,oldCount);assert.equal(newMeshes.length,newCount);assert.equal(newMeshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0),triangles);
 for(const before of oldMeshes){
  const after=newMeshes.find(mesh=>mesh.name===before.name);assert(after,before.name);
  assert.deepEqual(Object.keys(after.geometry.attributes),Object.keys(before.geometry.attributes));
  for(const [key,attribute] of Object.entries(before.geometry.attributes)){assert.equal(after.geometry.attributes[key].itemSize,attribute.itemSize);assert.deepEqual(after.geometry.attributes[key].array,attribute.array,before.name+'/'+key);}
  assert.deepEqual(after.geometry.index?.array,before.geometry.index?.array,before.name+' triangles');
  assert.deepEqual(after.matrixWorld.toArray(),before.matrixWorld.toArray(),before.name+' position');
  assert.deepEqual([after.material].flat().map(material),[before.material].flat().map(material),before.name+' source finish');
 }
 const beforeBox=new THREE.Box3().setFromObject(original,true),afterBox=new THREE.Box3().setFromObject(accepted,true);
 assert.equal(afterBox.min.y,beforeBox.min.y);assert.equal(afterBox.max.y,beforeBox.max.y);
});

test('exact facade exceptions retain planning facts, source history and all stated qualifications',()=>{
 for(const [id,pin] of Object.entries(scope.assets)){
  const accepted=restoreUptownEligibility(row(id));assert.equal(qualifiedFacadeFingerprint(accepted),pin.newFingerprint);
  const prior=restoreQualifiedFacadeFields(structuredClone(accepted),true);assert.equal(qualifiedFacadeFingerprint(prior),pin.priorFingerprint);
  for(const key of ['status','lifecycle','modes','heightM','storeys','position','registration','sourceMeshIdsToDisable','replacesSourceIds','replacementModes'])assert.deepEqual(accepted[key],prior[key],id+' '+key);
  assert.deepEqual(accepted.sources.slice(0,prior.sources.length),prior.sources,'dated source history');
  for(const mutate of [asset=>{asset.status='Existing';},asset=>{asset.modes=['existing'];},asset=>{asset.modelCaveat='Measured as-built design';},asset=>{asset.sources[0].url='https://example.com';}]){const changed=row(id);mutate(changed);assert.throws(()=>restoreQualifiedFacadeFields(changed,true));}
 }
 const park=row('wf-26park-current-plan'),voya=row('voya-towers-plan-derived');
 assert.match(park.modelCaveat,/finishes.*illustrative/);assert.match(park.modelCaveat,/\+\/-2 m/);assert(park.sources.some(source=>source.title==='A4.01 North elevation'));assert(park.sources.some(source=>source.title==='A4.02 East and west elevations'));
 assert.match(voya.modelCaveat,/spacing and relief are approximate/);assert.match(voya.modelCaveat,/No final roof or equipment geometry/);assert.match(voya.geometryCoverage,/Roof schedule.*remain unresolved/);assert.match(voya.modelCaveat,/\+\/-6 m/);
});

test('version restoration removes exactly four accepted model entries and preserves every other version',()=>{
 const versions=JSON.parse(read('data/model-asset-versions.json')),before=structuredClone(versions);restoreQualifiedFacadeVersions(versions);
 for(const path of Object.keys(scope.versions))delete before.sha256[path];assert.deepEqual(versions,before);
 const changed=JSON.parse(read('data/model-asset-versions.json'));changed.sha256[Object.keys(scope.versions)[0]]='0'.repeat(64);assert.throws(()=>restoreQualifiedFacadeVersions(changed));
});
