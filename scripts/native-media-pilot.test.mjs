import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertNativeMediaTransport} from './native-media-transport.mjs';
import {normalizeCleanMedia,mediaPreviewInfo,comparisonPair,matchedComparisonBinding} from '../public/clean-media.js';

const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/';
const read=file=>JSON.parse(fs.readFileSync(new URL(file,pub),'utf8'));
const native=read('data/native-media-20261102.json'),clarkson=native.images.filter(row=>row.identity.includes('/clarkson-')),entry=native.images.find(row=>row.identity==='wide/clarkson-future.png');
const fullFetcher=async path=>new Response(fs.readFileSync(new URL(path,pub),'utf8'));
// Exercise the accepted November 2 pilot independently of the later presentation
// overlay. A separate test below checks the complete current edition.
const fetcher=path=>path==='data/presentation-media-20261109.json'?Promise.resolve(new Response('',{status:404})):fullFetcher(path);
const previousFetch=globalThis.fetch;globalThis.fetch=fetcher;globalThis.location={href:base};
const {mediaCatalog,loadMediaCatalog,indexMedia,refreshCatalogPictures}=await import('../public/media-catalog.js?native-pilot-test');
const current=await mediaCatalog;globalThis.fetch=previousFetch;
const oldFetch=path=>path.includes('native-media')?Promise.resolve(new Response('',{status:404})):fetcher(path);

test('seven corrected Clarkson views retain 42 exact new pixel files and no private delivery paths',()=>{
 assert.equal(clarkson.length,7);assert.equal(clarkson.filter(row=>row.scenario==='future').length,5);assert.equal(clarkson.filter(row=>row.scenario==='existing').length,2);
 for(const row of clarkson){normalizeCleanMedia(row,base);assert.equal(row.caption.requiredModelCredits.length,row.scenario==='future'?1:0);}
 assert.doesNotMatch(JSON.stringify(native),/\/Users\/|\/private\/|\/tmp\/|file:\/\/|"path"/);
 assert.equal(entry.displayMaster.sha256,'0e57c858ebd2cec53de341d5b58abdec361f80b718835f800183dd36f710932d');
 assert.equal(entry.download.sha256,'e2ec6e3b595e85133160f310d187e5dd321575732aa725ec5860d5d1b99eede2');
 const assets=clarkson.flatMap(row=>[row.displayMaster,row.download,...row.responsivePreviews]);assert.equal(assets.length,42);
 assertNativeMediaTransport(native,pub,{rows:clarkson});
 assert.equal(assets.reduce((sum,a)=>sum+a.bytes,0),249304312);
 const row=normalizeCleanMedia(entry,base),preview=mediaPreviewInfo(row);
 assert.equal(preview.height,2400);assert.equal(row.download.height,2839);assert.equal(preview.meta,'Rendered 1 Nov 2026 · 4K PNG · '+(entry.download.bytes/1e6).toFixed(1)+' MB');
 assert.equal(preview.attribution.cityCredit,'City of Mississauga · Ontario data');assert.equal(preview.attribution.openStreetMap,false);
 assert.deepEqual(preview.attribution.requiredModelCredits,['Massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario.']);
 const noCredit=structuredClone(entry);noCredit.caption.requiredModelCredits=[];assert.throws(()=>normalizeCleanMedia(noCredit,base),/Zeidler/);
 assert.equal(preview.src,entry.displayMaster.url);assert.equal(preview.download,entry.download.url);
});

test('only three Clarkson Social cards select clean v2 pixels with separate downloads and visible credits',()=>{
 const html=fs.readFileSync(new URL('social.html',pub),'utf8'),cards=[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match=>match[0]);
 const current=cards.filter(card=>card.includes('gallery/native-20261102/portraits-clarkson-'));assert.equal(current.length,3);assert.equal(cards.length,24);
 for(const row of clarkson.filter(row=>row.identity.startsWith('portraits/'))){
  const card=current.find(card=>card.includes(row.displayMaster.url));assert(card,row.identity);
  assert(card.includes('class="image-link" href="'+row.displayMaster.url+'"'));assert(card.includes('class="save" href="'+row.download.url+'" download'));
  assert(card.includes('City of Mississauga · Ontario data'));assert.doesNotMatch(card,/Rendered|Earlier render|social-note/);
  assert.equal(card.includes('Massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario.'),row.scenario==='future');
 }
});

test('actual pilot selects Clarkson while all former URL identities retain their exact metadata',async()=>{
 const previous=await loadMediaCatalog(oldFetch,{baseURL:base}),oldIndex=indexMedia(previous,base),newIndex=indexMedia(current,base);
 for(const [url,row]of oldIndex)assert.deepEqual(newIndex.get(url),row,url);
 const input=read('data/picture-assets.json'),before=refreshCatalogPictures(structuredClone(input),previous),after=refreshCatalogPictures(structuredClone(input),current);
 assert.equal(after.images['clarkson-future.png'].displayMaster.url,entry.displayMaster.url);
 for(const row of native.images.filter(row=>row.identity.startsWith('wide/'))){
  const selected=after.images[row.identity.split('/')[1]];
  assert.equal(selected.displayMaster.sha256,row.displayMaster.sha256,row.identity);
  assert.equal(selected.url,row.download.url,row.identity);
  assert.equal(selected.caption.scenario,row.scenario,row.identity);
 }
 const updated=new Set(native.images.filter(row=>row.identity.startsWith('wide/')).map(row=>row.identity.split('/')[1]));
 for(const [name,row]of Object.entries(before.images))if(!updated.has(name))assert.deepEqual(after.images[name],row,name);
 assert.deepEqual(refreshCatalogPictures(structuredClone(after),current),after,'repeated refresh remains stable');
 assert(comparisonPair(after,'clarkson').every(row=>row.cleanPresentation&&row.comparisonProof));
 assert(comparisonPair(after,'clarkson').every(row=>row.responsive.width===3200&&row.responsive.height===2000));
 const missingProof=await loadMediaCatalog(path=>path.includes('matched-pairs/')?Promise.resolve(new Response('',{status:404})):fetcher(path),{baseURL:base});
 assert.deepEqual(comparisonPair(refreshCatalogPictures(structuredClone(input),missingProof),'clarkson'),comparisonPair(before,'clarkson'),'no shared proof keeps the old matched pair');
 const changedProof=structuredClone(read(native.comparisonProofs[0].url));changedProof.shared.camera.orthoScale++;
 const tampered=await loadMediaCatalog(path=>path.includes('matched-pairs/')?Promise.resolve(new Response(JSON.stringify(changedProof))):fetcher(path),{baseURL:base});
 assert.deepEqual(comparisonPair(refreshCatalogPictures(structuredClone(input),tampered),'clarkson'),comparisonPair(before,'clarkson'),'the actual proof bytes must match the pinned digest');
 const stalled=await loadMediaCatalog(path=>path.includes('matched-pairs/')?new Promise(()=>{}):fetcher(path),{baseURL:base,currentTimeoutMs:5});
 assert.equal(refreshCatalogPictures(structuredClone(input),stalled).images['clarkson-future.png'].displayMaster.url,entry.displayMaster.url,'a slow comparison proof does not strand the clean gallery');
 assert.deepEqual(comparisonPair(refreshCatalogPictures(structuredClone(input),missingProof),'downtown'),comparisonPair(before,'downtown'),'Downtown also retains its old pair without its own exact proof');
 const unavailable=await loadMediaCatalog(path=>path.includes('native-media')?Promise.reject(new Error('offline')):fetcher(path),{baseURL:base});
 assert.deepEqual(refreshCatalogPictures(structuredClone(input),unavailable),before);
 const invalid=structuredClone(native);invalid.images[0].download.sceneSourceSHA256='0'.repeat(64);
 const rejected=await loadMediaCatalog(path=>path.includes('native-media')?Promise.resolve(new Response(JSON.stringify(invalid))):fetcher(path),{baseURL:base});
 assert.deepEqual(refreshCatalogPictures(structuredClone(input),rejected),before);
});

test('later presentation selection preserves every native pixel identity and updates only its five logical views',async()=>{
 const revision=read('data/presentation-media-20261109.json'),active=await loadMediaCatalog(fullFetcher,{baseURL:base});
 const historicalIndex=indexMedia(current,base),activeIndex=indexMedia(active,base);
 for(const [url,row] of historicalIndex){
  // Comparison bindings describe the active pair. Pixel metadata, attribution
  // and render provenance remain exact when a former active row is archived.
  const {comparisonProof:priorBinding,...prior}=row;
  const {comparisonProof:activeBinding,...retained}=activeIndex.get(url);
  assert.deepEqual(retained,prior,url);
 }
 const latest=new Map(revision.images.map(row=>[row.identity,row]));
 const pictures=refreshCatalogPictures(read('data/picture-assets.json'),active);
 for(const original of native.images.filter(row=>row.identity.startsWith('wide/'))){
  const expected=latest.get(original.identity)||original,selected=pictures.images[original.identity.split('/')[1]];
  assert.equal(selected.displayMaster.sha256,expected.displayMaster.sha256,original.identity);
  assert.equal(selected.url,expected.download.url,original.identity);
  assert.equal(selected.caption.scenario,expected.scenario,original.identity);
 }
 assert.equal(latest.size,5);
 assert(comparisonPair(pictures,'downtown').every(row=>row.comparisonProof.proofID===revision.comparisonProofs[0].proofID));
});

test('shared native proof binds different native dimensions to equal comparison derivatives',()=>{
 const rows=native.images.map(row=>normalizeCleanMedia(row,base)),reference=native.comparisonProofs[0],proof=read(reference.url);
 const binding=matchedComparisonBinding(rows,proof,reference.sha256);
 assert.equal(binding.nativePixelDimensionsEqual,false);assert.deepEqual(binding.responsiveDimensions,[3200,2000]);
 for(const mutate of [p=>p.checks.lightingParametersExactlyEqual=false,p=>p.checks.normalizedCameraFramingEqual=false,p=>p.checks.nativePixelDimensionsEqual=true,p=>p.members[0].cleanPNG.sha256='0'.repeat(64),p=>p.members[1].responsiveImages[2].sha256='0'.repeat(64),p=>p.shared.aspectRatio.numerator=16,p=>p.commonResponsiveFormats.find(x=>x.dimensions[0]===3200).memberSHA256.reverse()]){
  const invalid=structuredClone(proof);mutate(invalid);assert.throws(()=>matchedComparisonBinding(rows,invalid,reference.sha256));
 }
});
