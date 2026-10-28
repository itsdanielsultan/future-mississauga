import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {selectPreview,verifiedModelBytes} from '../public/model-preview-loading.js';
import {modelDownloadAssets,configureStudyActions,visibleReferenceCreditHTML,studyViewerMessage} from '../public/model-study-presentation.js';
import {modelRevisionForProject,mediaModelRevision} from '../public/model-revisions.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(`../public/${path}`,import.meta.url)));
const catalogue=read('data/model-previews.json'),registry=read('data/model-revisions.json');
const view=selectPreview(catalogue,'ergocentric-275-superior'),asset=catalogue.assets.find(item=>item.id===view.assets[0]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const geometrySHA='c3bf9ec74a0d8cf57fc96cb8230b1dc2f59cbacd9163c9deff3881adfb9f632e';
const publicSHA='1be0160ad175e161e8d2f023d03f91cbc908ec9baa4f4787aae7c5ba6f1e2df4';

test('275 Superior serves the exact approved untextured model, with a distinct public identity',async()=>{
  const bytes=fs.readFileSync(new URL(`../public/${asset.url}`,import.meta.url));
  assert.equal(bytes.length,18362);assert.equal(hash(bytes),'2073d1b0373039fb4317e70aef33af2dd0abdd5bb12835955765f9647bd55c02');
  const decoded=gunzipSync(bytes);assert.equal(decoded.length,100940);assert.equal(hash(decoded),publicSHA);
  assert.equal(hash(await verifiedModelBytes(asset,async()=>new Response(bytes))),publicSHA);
  const glb=JSON.parse(decoded.subarray(20,20+decoded.readUInt32LE(12)).toString());
  assert.equal(glb.meshes.length,8);assert.equal(glb.nodes.length,8);assert.equal(glb.images?.length||0,0);assert.equal(glb.textures?.length||0,0);
  assert.equal(asset.publicGeometry,true);assert.match(asset.publicationScope,/Public interactive study/);
  assert.equal(asset.scopeDecisionSHA256,'b9033f35f87d1bd9a3c3a668a46ae066a59c84921452592d7b4eb385f7607324');
  assert.equal(glb.extras.privateCandidate,false);
  assert.equal(glb.extras.publication,'Public interactive authored study. Geometry is publicly served; no standalone model download is offered.');
  assert.equal(glb.scenes[0].extras.scope,'City baseline retained in the public interactive facade study.');
  assert.equal(asset.meshCount,8);assert.equal(asset.triangles,1472);
  const triangles=glb.meshes.flatMap(mesh=>mesh.primitives).reduce((sum,primitive)=>sum+glb.accessors[primitive.indices].count/3,0);
  assert.equal(triangles,1472);
  assert.equal(asset.geometrySourceSHA256,geometrySHA);
  assert.match(asset.metadataDerivativeNote,/unchanged/);
});

test('reversing only the three publication metadata edits reproduces the exact private original',()=>{
  const decoded=gunzipSync(fs.readFileSync(new URL(`../public/${asset.url}`,import.meta.url)));
  const jsonLength=decoded.readUInt32LE(12),tail=decoded.subarray(20+jsonLength);
  assert.equal(hash(tail),'205d06aa56aa1efa4e3a91c001bba1db1b1cd2c398fcc2d63b670f92da11505e');
  let text=decoded.subarray(20,20+jsonLength).toString().trimEnd();
  for(const [current,original] of [
    ['"privateCandidate":false','"privateCandidate":true'],
    ['Public interactive authored study. Geometry is publicly served; no standalone model download is offered.','Private model review only. Website adoption/publication remains with sole website owner after scope/QA checks.'],
    ['City baseline retained in the public interactive facade study.','Private extracted City baseline']
  ]){
    assert.equal(text.split(current).length,2,'each metadata edit must occur exactly once');
    text=text.replace(current,original);
  }
  const json=Buffer.from(text),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const header=Buffer.from(decoded.subarray(0,20));
  header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);
  const original=Buffer.concat([header,padded,tail]);
  assert.equal(original.length,100916);assert.equal(hash(original),geometrySHA);
});

test('the individual study offers no standalone model or compressed-download action',()=>{
  assert.equal(view.offerDownloads,false);assert.deepEqual(modelDownloadAssets(view,[asset]),[]);
  for(const prior of catalogue.views.filter(item=>item.id!==view.id)) assert.deepEqual(modelDownloadAssets(prior,['existing action']),['existing action']);
  const selectors=['#modelDownloads','#compressedDownloads','#downloadNote','.sidebar > p.credit:not([id]):not([data-visible-reference-credit])','.sidebar > p:has(a[download])'];
  const elements=new Map(selectors.map(selector=>[selector,{hidden:false}]));let inserted='';
  const root={querySelectorAll:selector=>[elements.get(selector)],querySelector:selector=>selector==='#studyCredit'?{insertAdjacentHTML:(_position,html)=>{inserted=html;}}:null};
  configureStudyActions(view,root);
  assert.ok([...elements.values()].every(element=>element.hidden));assert.match(inserted,/David Lasker\/Cityscape Photography/);
  for(const message of ['This browser cannot unpack the model. Use the compressed download below or a newer browser.','3D graphics are unavailable. You can still download the model and credits.','Graphics could not be restored. Reload the viewer or use the model download.']) assert.doesNotMatch(studyViewerMessage(view,message),/download/i);
});

test('credit stays visible beside the study and the city route targets only Citywide',()=>{
  const html=visibleReferenceCreditHTML(view);
  assert.match(html,/Photo reference: <a href="https:\/\/davidlaskerphotography\.com\/"/);
  assert.match(html,/>David Lasker\/Cityscape Photography<\/a>/);
  assert.equal(asset.cityDataTerms,true);assert.match(view.credit,/City of Mississauga/);
  assert.equal(view.cityURL,'explore.html?district=citywide&project=ergocentric-275-superior');
  assert.match(view.limits,/capture date is unknown/);assert.match(view.limits,/not current as-built verification/);
  assert.match(view.rights,/photograph is not reproduced or used as a texture/);
  assert.doesNotMatch(view.credit,/Architect(?:ure|ural)? design:/i);
  assert.equal(visibleReferenceCreditHTML({visibleReferenceCredit:{label:'Bad link',url:'javascript:alert(1)'}}),'');
});

test('28 October is the exact authored-model date, with separate source identities for the image pair',()=>{
  assert.equal(asset.modelCreatedUTC,'2026-10-28T12:52:11.137762+00:00');
  const revision=modelRevisionForProject(registry,catalogue,view.projectId,view.id);assert.equal(revision.updatedOn,'2026-10-28');
  const record=registry.revisions.find(item=>item.projectId===view.projectId);assert.equal(Object.hasOwn(record,'publishedOn'),false);
  assert.equal(record.media.length,2);
  assert.equal(record.geometryIdentity.authoredModelSHA256,geometrySHA);
  assert.equal(record.geometryIdentity.publicModelSHA256,publicSHA);
  const after=record.media.find(item=>item.role==='after');
  assert.deepEqual(after.modelSHA256s,[geometrySHA],'the historical image keeps its actual render-source identity');
  assert.equal(after.geometryEquivalentPublicModelSHA256,publicSHA);
  for(const media of record.media){
    const bytes=fs.readFileSync(new URL(`../public/${media.url}`,import.meta.url));assert.equal(bytes.length,media.bytes);assert.equal(hash(bytes),media.sha256);
    assert.equal(mediaModelRevision(registry,{...media,modelSHA256:media.modelSHA256s[0]}).role,media.role);
  }
  const before=record.media.find(item=>item.role==='before');assert.equal(mediaModelRevision(registry,{...before,modelSHA256:geometrySHA}),null);
  const altered=structuredClone(catalogue);altered.assets.find(item=>item.id===asset.id).sha256='0'.repeat(64);
  assert.equal(modelRevisionForProject(registry,altered,view.projectId,view.id),null);
});
