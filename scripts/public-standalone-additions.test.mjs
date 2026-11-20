import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_STANDALONE_ADDITIONS,restorePublicStandaloneAdditions} from './public-standalone-additions.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url)));
const manifest=read('model-previews'),refinements=read('refinement-models');
test('three standalone additions reuse the exact accepted public city assets and qualifications',()=>{
 for(const [viewID,cityID]of [['harborn-50-60','harborn-50-60-current-plan'],['port-credit-26-park','wf-26park-current-plan'],['voya','voya-towers-plan-derived']]){
  const view=manifest.views.find(v=>v.id===viewID),asset=manifest.assets.find(a=>a.id===view.assets[0]),city=refinements.assets.find(a=>a.id===cityID);
  assert.equal(view.projectId,city.projectId);assert.equal(asset.url,city.url);assert.equal(asset.sha256,city.decodedSHA256);assert.equal(asset.downloadSHA256,city.downloadSHA256);assert.equal(asset.bytes,city.bytes);assert.equal(asset.decodedBytes,city.decodedBytes);
  assert.equal(view.credit,city.credit);assert.equal(view.offerDownloads,false);assert.equal(view.fitToBounds,true);assert(view.cityURL.endsWith('project='+city.projectId));assert(view.limits.length>40&&view.sources.length);
 }
});
test('historical guard removes only exact approved additions and rejects altered bindings',()=>{
 const baseline=restorePublicStandaloneAdditions(structuredClone(manifest));
 assert.equal(baseline.views.length,manifest.views.length-3);assert.equal(baseline.assets.length,manifest.assets.length-3);
 for(const kind of ['assets','views'])for(const row of PUBLIC_STANDALONE_ADDITIONS[kind]){
  const changed=structuredClone(manifest);changed[kind].find(item=>item.id===row.id).title='Wrong building';assert.throws(()=>restorePublicStandaloneAdditions(changed));
 }
});
