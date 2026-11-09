import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCleanMedia} from '../public/clean-media.js';
import {matchedFairviewBinding} from '../public/fairview-media.js';

const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/reference-updates.html';
const history=JSON.parse(fs.readFileSync(new URL('data/labelled-image-assets.json',pub)));
const legacy=JSON.parse(fs.readFileSync(new URL('data/neighbourhood-media.json',pub)));
const sha=text=>createHash('sha256').update(text).digest('hex');
const dataModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
function replaceImports(source,replacements){
 const counts=new Map(Object.keys(replacements).map(name=>[name,0]));
 const replaced=source.replace(/(\bfrom\s+|\bimport\(\s*)(['"])(\.\/[^'"?]+)(?:\?[^'"]*)?\2/g,(statement,prefix,quote,path)=>{
  if(!Object.hasOwn(replacements,path))return statement;
  counts.set(path,counts.get(path)+1);
  return prefix+quote+replacements[path]+quote;
 });
 for(const [path,count]of counts)assert.equal(count,1,'one consumer import for '+path);
 return replaced;
}
function entry(state){
 const identity='neighbourhood/fairview/'+state,timestamp='2026-11-02T01:30:00.000Z',remote='https://github.com/itsdanielsultan/future-mississauga/releases/download/test-only-fairview/';
 const asset=(role,width,height,mimeType)=>({url:(mimeType==='image/avif'?'gallery/test-only-fairview/':remote)+state+'-'+role+(mimeType==='image/png'?'.png':mimeType==='image/avif'?'.avif':'.jpg'),dimensions:[width,height],bytes:500000,sha256:sha(state+role+mimeType),mimeType});
 const displayMaster={...asset('clean',1800,1100,'image/png'),role:'cleanNativeScene',captionBaked:false};
 const download={...asset('download',1800,1300,'image/png'),role:'nativeSceneWithAppendedCreditFooter',sceneDimensions:[1800,1100],sceneBounds:[0,0,1800,1100],footerBounds:[0,1100,1800,1300],sceneSourceSHA256:displayMaster.sha256,allScenePixelsExact:true,sceneCrop:false,sceneResize:false};
 return {schema:'future-mississauga-current-native-media/v2',identity,title:'Fairview',scenario:'existing',comparisonState:state,aliases:[],historicalURLsRebound:false,sourceFreezeState:'FINAL_FROZEN',sourceSceneSHA256:sha('source-'+state),renderTimestampUTC:timestamp,nativeSceneDimensions:[1800,1100],displayMaster,download,
  responsivePreviews:[1200,1800].flatMap(width=>['image/avif','image/jpeg'].map(mimeType=>({...asset('scene-'+width,width,Math.round(1100*width/1800),mimeType),role:'responsivePreview',sourceSHA256:displayMaster.sha256,crop:false,captionBaked:false,lossyEncoding:true,resized:width!==1800}))),
  caption:{title:'Fairview',area:'Fairview',creator:'Daniel Sultan',scenario:'existing',comparisonState:state,geographicScope:'neighbourhood',cityCredit:'City of Mississauga',openStreetMap:false,sourcesURL:'https://futuremississauga.com/sources.html',requiredModelCredits:[],fullCredits:[],sourceDates:'Source dates retained separately.',renderTimestampUTC:timestamp}};
}
const entries=[entry('before'),entry('after')];
// Synthetic proof for consumer plumbing only. The production accepted map never
// includes this fixture; positive tests replace the validator in a private data URL.
const proof={schema:'future-mississauga-fairview-pilot-matched-view-proof/v1',proofID:'fm-fairview-pilot-'+('a'.repeat(24)),fixtureAccepted:true,members:entries.map(row=>({identity:row.identity,sha256:row.displayMaster.sha256}))};
const proofText=JSON.stringify(proof),proofHash=sha(proofText),proofPath='data/matched-pairs/test-only-fairview.json';
const manifest={schema:'future-mississauga-neighbourhood-media/v2',id:'fairview',state:'READY_FOR_PUBLICATION',publication:true,images:entries,comparisonProofs:[{url:proofPath,sha256:proofHash,proofID:proof.proofID}]};
const validatorStub=dataModule(`export function matchedFairviewBinding(rows,proof,digest){
 globalThis.__fairviewConsumerValidatorCalls++;
 if(!proof.fixtureAccepted||proof.schema!=='future-mississauga-fairview-pilot-matched-view-proof/v1'||rows.length!==2||rows.some((row,i)=>row.identity!==proof.members[i].identity||row.displayMaster.sha256!==proof.members[i].sha256||row.displayMaster.width!==1800||row.displayMaster.height!==1100))throw Error('test proof differs');
 return {proofID:proof.proofID,sha256:digest,identities:rows.map(row=>row.identity),beforeSceneSHA256:rows[0].displayMaster.sha256,afterSceneSHA256:rows[1].displayMaster.sha256,beforeResponsiveSHA256:rows[0].responsive.sha256,afterResponsiveSHA256:rows[1].responsive.sha256,responsiveDimensions:[1800,1100],cameraMatched:true,lightingMatched:true,comparisonKind:'native-neighbourhood-pilot-visibility'};
}`);
const beforeGlobals={fetch:globalThis.fetch,location:globalThis.location};
globalThis.location={href:base,origin:new URL(base).origin};globalThis.__fairviewConsumerValidatorCalls=0;
const fetcher=async path=>path==='data/labelled-image-assets.json'?new Response(JSON.stringify(history)):path==='data/neighbourhood-media-20261102.json'?new Response(JSON.stringify(manifest)):path===proofPath?new Response(proofText):path.startsWith('data/neighbourhood-media.json')?new Response(JSON.stringify(legacy)):new Response('',{status:404});
globalThis.fetch=fetcher;
const catalogSource=replaceImports(fs.readFileSync(new URL('media-catalog.js',pub),'utf8'),{'./asset-delivery.js':new URL('asset-delivery.js',pub).href,'./clean-media.js':new URL('clean-media.js',pub).href,'./fairview-media.js':validatorStub});
const catalogURL=dataModule(catalogSource),catalogModule=await import(catalogURL),catalog=await catalogModule.mediaCatalog;
const studySource=replaceImports(fs.readFileSync(new URL('neighbourhood-media.js',pub),'utf8'),{'./image-provenance.js':new URL('image-provenance.js',pub).href,'./clean-media.js':new URL('clean-media.js',pub).href,'./fairview-media.js':validatorStub,'./media-catalog.js':catalogURL});
const study=await import(dataModule(studySource));
after(()=>{globalThis.fetch=beforeGlobals.fetch;globalThis.location=beforeGlobals.location;delete globalThis.__fairviewConsumerValidatorCalls;});

test('the production Fairview validator stays closed for synthetic consumer fixtures',()=>{
 assert.throws(()=>matchedFairviewBinding(entries.map(row=>normalizeCleanMedia(row,base,{neighbourhood:true})),proof,proofHash),/accepted Fairview proof/);
});
test('the separate wrapper and proof are fetched before both Existing rows are adopted together',()=>{
 assert.equal(catalog.currentNeighbourhoods.length,2);assert.equal(catalog.currentPictures,undefined);
 assert.deepEqual(catalog.currentNeighbourhoods.map(row=>row.identity),entries.map(row=>row.identity));
 assert(catalog.currentNeighbourhoods.every(row=>row.caption.scenario==='existing'&&row.comparisonProof.comparisonKind==='native-neighbourhood-pilot-visibility'));
 assert.equal(catalog.currentNeighbourhoods[0].comparisonProof,catalog.currentNeighbourhoods[1].comparisonProof);
 const old=catalogModule.indexMedia(history,base),current=catalogModule.indexMedia(catalog,base);
 for(const [url,row]of old)assert.deepEqual(current.get(url),row,url);
});
test('proof missing, stalled, tampered or mismatched cannot partially replace the older catalogue',async()=>{
 const cases=[
  path=>path===proofPath?Promise.resolve(new Response('',{status:404})):fetcher(path),
  path=>path===proofPath?new Promise(()=>{}):fetcher(path),
  path=>path===proofPath?Promise.resolve(new Response(proofText+' ')):fetcher(path),
  path=>path==='data/neighbourhood-media-20261102.json'?Promise.resolve(new Response(JSON.stringify({...manifest,comparisonProofs:[{...manifest.comparisonProofs[0],proofID:'wrong-id'}]}))):fetcher(path)
 ];
 for(const currentFetch of cases){
  const calls=globalThis.__fairviewConsumerValidatorCalls;
  const loaded=await catalogModule.loadMediaCatalog(currentFetch,{baseURL:base,currentTimeoutMs:5});
  assert.equal(loaded.currentNeighbourhoods,undefined);assert.deepEqual(loaded.images,history.images);assert.equal(globalThis.__fairviewConsumerValidatorCalls,calls,'bad proof bytes/identity must not reach the validator');
 }
});
test('held, partial, swapped and invalid image rows preserve the complete historical selection',async()=>{
 for(const mutate of [m=>{m.state='LOCAL_STAGED_ONLY';m.publication=false;},m=>m.images.pop(),m=>m.images.reverse(),m=>{m.images[1]=null;},m=>{m.images[1].download.sceneResize=true;},m=>{m.images[1].scenario=m.images[1].caption.scenario='future';},m=>{m.comparisonProofs.push(m.comparisonProofs[0]);},m=>{m.images[1].displayMaster.url=history.images[0].displayMaster.url;},m=>{m.images[1].nativeSceneDimensions=[3200,1956];}]){
  const changed=structuredClone(manifest);mutate(changed);
  const loaded=await catalogModule.loadMediaCatalog(path=>path==='data/neighbourhood-media-20261102.json'?Promise.resolve(new Response(JSON.stringify(changed))):fetcher(path),{baseURL:base});
  assert.equal(loaded.currentNeighbourhoods,undefined);assert.deepEqual(loaded.images,history.images);
 }
});
test('hosted clean PNGs and local derivatives resolve to full native scene with separate footer download',async()=>{
 for(const row of entries)for(const url of [row.displayMaster.url,row.download.url,...row.responsivePreviews.map(image=>image.url)]){
  const preview=await study.resolveStudyImage(url+'?unchanged=1#preview');
  assert.equal(preview.src,row.displayMaster.url);assert.equal(preview.download,row.download.url);assert.equal(preview.width,1800);assert.equal(preview.height,1100);
  assert.equal(preview.meta,'Rendered 1 Nov 2026 · 2K PNG · 0.5 MB');assert.equal(preview.scenario,'existing');assert.equal(preview.attribution.cityCredit,'City of Mississauga');
 }
 assert.equal(await study.resolveStudyImage('https://other.example/unknown.png'),null);
 const rows=catalog.currentNeighbourhoods;
 assert(rows.every(row=>row.responsive.width===1800&&row.responsive.height===1100));
 assert(rows.every(row=>row.responsivePreviews.every(preview=>preview.width<=1800&&preview.height<=1100)));
});
test('legacy Fairview URLs still resolve their original pixels and date while direct v2 needs proof',async()=>{
 for(const row of legacy.images){
  const preview=await study.resolveStudyImage(row.url);assert.equal(preview.src,row.url);assert.equal(preview.download,row.url);assert.match(preview.meta,/Updated 28 Oct 2026/);
  assert.equal(study.studyImagePreview(manifest,row.url,base,{proof,proofSHA256:proofHash}),null);
 }
 assert.equal(study.studyImagePreview(manifest,entries[0].displayMaster.url,base),null);
 const preview=study.studyImagePreview(manifest,entries[0].displayMaster.url,base,{proof,proofSHA256:proofHash});assert.equal(preview.height,1100);assert.equal(preview.download,entries[0].download.url);
});
