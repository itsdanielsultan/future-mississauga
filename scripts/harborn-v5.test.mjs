import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {HARBORN_V5_SCOPE,harbornV5Fingerprint,restoreHarbornV5Fields,restoreHarbornV5Versions} from './harborn-v5-scope.mjs';
import {getHarbornTerrainContract} from '../public/harborn-terrain.js';

const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const json=path=>JSON.parse(read(path));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const asset=()=>json('data/refinement-models.json').assets.find(row=>row.id===HARBORN_V5_SCOPE.id);

test('accepted V5 runtime, contract and compressed geometry match the qualified handoff exactly',()=>{
 for(const [path,pin] of Object.entries(HARBORN_V5_SCOPE.files)){
  const bytes=read(path);assert.equal(bytes.length,pin.bytes,path);assert.equal(hash(bytes),pin.sha256,path);
 }
 const row=asset(),decoded=gunzipSync(read(row.url));
 assert.equal(decoded.length,row.decodedBytes);assert.equal(hash(decoded),row.decodedSHA256);
 assert.equal(row.downloadSHA256,row.sha256);
 assert.equal(hash(read(row.url)),row.sha256);
 assert.deepEqual(row.sourceDimensionsM,{blockA_length:40.31,blockB_length:32.33});
 assert.equal(row.geometryVerifiedCurrent,false);
 assert.equal(row.status,'Proposed');assert.deepEqual(row.modes,['future']);
 assert.equal(row.totalHomes,12);assert.deepEqual(row.townBlocks,[{name:'A',units:7},{name:'B',units:5}]);
 assert.deepEqual(row.planningHeightM,[10.67,10.7]);
 assert.equal(row.registration.workingHorizontalUncertaintyM,1);
 assert.equal(row.registration.verticalDatumWorkingUncertaintyM,1);
});

test('historical geometry, V4 contract, weights and apron adapter remain byte-identical',()=>{
 for(const [path,pin] of Object.entries(HARBORN_V5_SCOPE.retainedFiles)){
  const bytes=read(path);assert.equal(bytes.length,pin.bytes,path);assert.equal(hash(bytes),pin.sha256,path);
 }
});

test('the V5 exception restores the complete prior asset without broadening accepted planning facts',()=>{
 const row=asset();assert.equal(harbornV5Fingerprint(row),HARBORN_V5_SCOPE.newFingerprint);
 assert.equal(harbornV5Fingerprint(restoreHarbornV5Fields(row,true)),HARBORN_V5_SCOPE.priorFingerprint);
 for(const change of [row=>{row.status='Approved';},row=>{row.totalHomes=13;},row=>{row.sources[0].url='https://example.com';},row=>{row.registration.workingHorizontalUncertaintyM=0;},row=>{row.sourceDimensionsM.blockA_length=41;}]){
  const changed=asset();change(changed);assert.throws(()=>restoreHarbornV5Fields(changed,true));
 }
 const unrelated={id:'unrelated',status:'Proposed'};assert.equal(restoreHarbornV5Fields(unrelated,true),unrelated);
});

test('V5 version normalization removes only the new exact entry and retains historical versions',()=>{
 const versions=json('data/model-asset-versions.json'),before=structuredClone(versions);
 restoreHarbornV5Versions(versions);
 for(const url of Object.keys(HARBORN_V5_SCOPE.versions))delete before.sha256[url];
 assert.deepEqual(versions,before);
 for(const path of Object.keys(HARBORN_V5_SCOPE.retainedFiles).filter(path=>path.startsWith('models/studies-')))
  assert.equal(versions.sha256[path],HARBORN_V5_SCOPE.retainedFiles[path].sha256);
 const changed=json('data/model-asset-versions.json');changed.sha256[asset().url]='0'.repeat(64);
 assert.throws(()=>restoreHarbornV5Versions(changed));
});

test('normal city entry requests the pinned V5 contract and original weights',async()=>{
 const requested=[];
 assert.equal(await getHarbornTerrainContract('malton'),null);
 const result=await getHarbornTerrainContract('cooksville',async url=>{
  requested.push(url);return new Response(read(url.split('?')[0]));
 });
 assert.equal(requested[0],'data/harborn-terrain-v5-20261112.json?v=bf6328c22435');
 assert.equal(requested[1],'models/studies-20261101/harborn-tie-v4-4dfd05d9de20.bin');
 assert.equal(result.contract.candidate.url,asset().url);
 assert.equal(result.contract.candidate.sha256,asset().sha256);
 assert.equal(result.contract.candidate.decodedSHA256,asset().decodedSHA256);
 assert.equal(result.contract.privateReviewOnly,false);
 assert.match(read('app.js').toString(),/from '\.\/harborn-terrain\.js\?v=20261113-design2'/);
});
