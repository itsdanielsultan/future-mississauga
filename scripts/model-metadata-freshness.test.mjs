import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {selectPreview} from '../public/model-preview-loading.js';
import {loadModelRevisions,modelRevisionForProject} from '../public/model-revisions.js';
const read=name=>JSON.parse(readFileSync(new URL('../public/data/'+name,import.meta.url)));
const catalogue=read('model-previews.json'),revisions=read('model-revisions.json');
const source=readFileSync(new URL('../public/model-preview.js',import.meta.url),'utf8');
const entry=source.slice(source.indexOf('const $ ='),source.indexOf('for (const item of manifest.views)'));

function returningBrowser(current,stale){
 const requests=[];
 return {requests,fetch:async(url,options={})=>{
  requests.push({url,options});
  // Even the new request URL can already be cached by a previous visit. The
  // loader must ask the network rather than relying only on a query change.
  return {ok:true,json:async()=>structuredClone(options.cache==='no-store'?current:stale)};
 }};
}

test('a direct M5 study visit bypasses an older cached catalogue without a prior map visit',async()=>{
 const stale=structuredClone(catalogue);stale.views=stale.views.filter(v=>v.id!=='mcity-m5');stale.assets=stale.assets.filter(a=>a.id!=='mcity-m5-v5');
 const browser=returningBrowser(catalogue,stale);
 const result=await runInNewContext('(async()=>{'+entry+';return {view,manifest};})()',{
  fetch:browser.fetch,document:{getElementById(){throw new Error('No UI access before metadata is loaded');}},location:{search:'?model=mcity-m5'},URLSearchParams,selectPreview
 });
 assert.equal(result.view.id,'mcity-m5');
 assert.equal(result.manifest.assets.find(a=>a.id==='mcity-m5-v5').sha256,'af9d51546ca35a1fbc850b2afc3cbf1565010ee7c196f03df7e8cf6679ff829a');
 assert.equal(browser.requests.length,1);assert.equal(browser.requests[0].options.cache,'no-store');
 assert.match(browser.requests[0].url,/model-previews\.json\?v=20261102-coherent1$/);
});

test('a cached earlier revision list cannot hide the accepted M5 revision',async()=>{
 const stale=structuredClone(revisions);stale.revisions=stale.revisions.filter(r=>r.projectId!=='mcity-5');
 const browser=returningBrowser(revisions,stale);
 const current=await loadModelRevisions(browser.fetch);
 assert.equal(modelRevisionForProject(current,catalogue,'mcity-5','mcity-m5').updatedOn,'2026-11-01');
 assert.equal(browser.requests[0].options.cache,'no-store');
 assert.match(browser.requests[0].url,/model-revisions\.json\?v=20261102-coherent1$/);
 assert(browser.requests[0].options.signal instanceof AbortSignal);
});

test('unavailable fresh revision metadata does not invent a date from the catalogue',async()=>{
 const current=await loadModelRevisions(async()=>{throw new Error('Network unavailable');});
 assert.equal(current,null);assert.equal(modelRevisionForProject(current,catalogue,'mcity-5','mcity-m5'),null);
});
