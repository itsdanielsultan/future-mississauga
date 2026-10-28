import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadModelRevisions,modelRevisionForProject,mediaModelRevision} from '../public/model-revisions.js';
import {projectDetailsHTML} from '../public/project-cards.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(`../public/${path}`,import.meta.url)));
const registry=read('data/model-revisions.json'), catalogue=read('data/model-previews.json');
const record=registry.revisions[0], projectId='sgm-maritz-6710';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the model date is 27 October while its website publication is 28 October',()=>{
  const revision=modelRevisionForProject(registry,catalogue,projectId,projectId);
  assert.equal(revision.updatedOn,'2026-10-27');
  assert.equal(revision.label,'Updated on 27 October 2026');
  assert.equal(record.publishedOn,'2026-10-28');
  const project=read('data/projects.json').find(item=>item.id===projectId);
  const html=projectDetailsHTML(project,{revision});
  assert.match(html,/<time datetime="2026-10-27">Updated on 27 October 2026<\/time>/);
  assert.doesNotMatch(html,/Updated on 28 October/);
});

test('changed model bytes, compressed download, source date or view assembly invalidate its date',()=>{
  const expected=record.modelAssets[0];
  for(const key of ['sha256','downloadSHA256','url','bytes','decodedBytes','modelReviewDate']){
    const changed=structuredClone(catalogue);
    const asset=changed.assets.find(item=>item.id===expected.id);
    asset[key]=typeof asset[key]==='number'?asset[key]+1:'changed';
    assert.equal(modelRevisionForProject(registry,changed,projectId,projectId),null,key);
  }
  const changed=structuredClone(catalogue);
  changed.views.find(item=>item.id===projectId).assets.push('artform');
  assert.equal(modelRevisionForProject(registry,changed,projectId,projectId),null);
  for(const invalid of ['2026-02-30','2026-10-28T12:00:00Z','unknown']){
    const changedRegistry=structuredClone(registry);changedRegistry.revisions[0].updatedOn=invalid;
    assert.equal(modelRevisionForProject(changedRegistry,catalogue,projectId),null);
  }
});

test('generic review and reference dates never become dates for unrelated buildings or old images',()=>{
  for(const id of ['artform','avia','edge-oro','mcity-1-2','municipal-23-3369']) assert.equal(modelRevisionForProject(registry,catalogue,id),null);
  assert.equal(mediaModelRevision(registry,{url:'assets/wide/downtown-future.png',sha256:'a'.repeat(64),modelSHA256:record.modelAssets[0].sha256}),null);
  const before=record.media.find(item=>item.role==='before'), after=record.media.find(item=>item.role==='after');
  assert.equal(mediaModelRevision(registry,{url:before.url,sha256:before.sha256,modelSHA256:after.modelSHA256s[0]}),null);
  const exact=mediaModelRevision(registry,{url:after.url,sha256:after.sha256,modelSHA256:after.modelSHA256s[0]});
  assert.equal(exact.role,'after');
  assert.equal(Object.hasOwn(exact,'updatedOn'),false,'Images must not inherit a model revision as a render date');
  assert.equal(mediaModelRevision(registry,{url:after.url,sha256:'a'.repeat(64),modelSHA256:after.modelSHA256s[0]}),null);
});

test('revision records match actual GLB, compressed download and all eight derivative image files',()=>{
  assert.equal(registry.revisions.length,2);
  const asset=record.modelAssets[0],compressed=fs.readFileSync(new URL(`../public/${asset.url}`,import.meta.url)),decoded=gunzipSync(compressed);
  assert.equal(compressed.length,asset.bytes);assert.equal(sha(compressed),asset.downloadSHA256);
  assert.equal(decoded.length,asset.decodedBytes);assert.equal(sha(decoded),asset.sha256);
  assert.equal(record.media.length,8);
  for(const media of record.media){
    const bytes=fs.readFileSync(new URL(`../public/${media.url}`,import.meta.url));
    assert.equal(bytes.length,media.bytes);assert.equal(sha(bytes),media.sha256);
    for(const modelSHA256 of media.modelSHA256s) assert.equal(mediaModelRevision(registry,{...media,modelSHA256}).role,media.role);
  }
});

test('missing optional revision metadata never blocks the model viewer',async()=>{
  assert.equal(await loadModelRevisions(async()=>{throw new Error('offline');}),null);
  assert.equal(await loadModelRevisions(async()=>({ok:false})),null);
  assert.equal(await loadModelRevisions(async()=>({ok:true,json:async()=>({schema:'wrong'})})),null);
  assert.deepEqual(await loadModelRevisions(async()=>({ok:true,json:async()=>registry})),registry);
});

test('optional metadata fetch and response reading are both bounded and aborted on timeout',async()=>{
  let signal;
  const never = () => new Promise(()=>{});
  assert.equal(await loadModelRevisions(async(_url,options)=>{signal=options.signal;return never();},{timeoutMs:10}),null);
  assert.equal(signal.aborted,true);
  assert.equal(await loadModelRevisions(async(_url,options)=>{signal=options.signal;return {ok:true,json:never};},{timeoutMs:10}),null);
  assert.equal(signal.aborted,true);
});
