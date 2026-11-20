import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mediaPreviewInfo} from '../public/clean-media.js';
const base='https://futuremississauga.com/';
const read=file=>JSON.parse(fs.readFileSync(new URL('../public/data/'+file,import.meta.url),'utf8'));
const history=read('labelled-image-assets.json'),native=read('native-media-20261102.json');
const savedFetch=globalThis.fetch,savedLocation=globalThis.location;
globalThis.location={href:base,origin:new URL(base).origin};
globalThis.fetch=async()=>new Response(JSON.stringify(history));
const {integrateCurrentPictures,integratePostingDownloads,indexMedia,mediaCatalog}=await import('../public/media-catalog.js?posting-download-tests');
await mediaCatalog;globalThis.fetch=savedFetch;globalThis.location=savedLocation;
const identities=['portraits/clarkson-existing.png','portraits/cooksville-future.png'];
const originalEntry=id=>structuredClone(native.images.find(row=>row.identity===id));
const current=()=>integrateCurrentPictures(history,identities.map(originalEntry),base);
const sceneURLs=row=>[row.displayMaster.url,row.preview.url,row.responsive.url,...row.responsivePreviews.map(a=>a.url)];
const key=url=>new URL(url,base).href;

// Synthetic posting assets only. No candidate file or publication manifest is read.
function posting(entry=originalEntry(identities[0]),edition='one'){
 const result=structuredClone(entry);
 result.download={url:'gallery/test-only/posting/'+edition+'/'+entry.identity.split('/')[1],dimensions:[3600,4500],bytes:123,sha256:'a'.repeat(64),mimeType:'image/png',role:'nativeSceneOnExpandedWhiteCanvas',sceneDimensions:[3240,4050],sceneBounds:[180,0,3420,4050],footerBounds:[0,4050,3600,4500],sideMarginsPx:[180,180],sceneSourceSHA256:result.displayMaster.sha256,allScenePixelsExact:true,sceneCrop:false,sceneResize:false,sceneOverlay:false};
 result.provenance={...result.provenance,postingLayout:{sha256:(edition==='two'?'c':'b').repeat(64)}};
 return result;
}

test('posting selects only the new download while every historical URL keeps its original record',()=>{
 const catalog=current(),snapshot=structuredClone(catalog),before=indexMedia(catalog,base),entry=posting(),input=structuredClone(entry);
 const old=catalog.currentPictures.find(r=>r.identity===entry.identity);
 old.comparisonProof={proofID:'retained-independent-proof',unmodified:true};snapshot.currentPictures.find(r=>r.identity===entry.identity).comparisonProof=structuredClone(old.comparisonProof);
 const next=integratePostingDownloads(catalog,[entry],base),row=next.currentPictures.find(r=>r.identity===entry.identity),index=indexMedia(next,base);
 assert.deepEqual(catalog,snapshot);assert.deepEqual(entry,input);assert.equal(next.images,catalog.images);
 assert.deepEqual(next.previousDownloadEditions,[old]);assert.equal(index.get(key(old.download.url)),old);
 for(const url of sceneURLs(old))assert.equal(index.get(key(url)),row);
 assert.equal(index.get(key(entry.download.url)),row);assert.equal(mediaPreviewInfo(row).download,entry.download.url);
 for(const [url,record] of before)if(record!==old||url===key(old.download.url))assert.equal(index.get(url),record,url);
 assert.equal(row.comparisonProof,old.comparisonProof);assert.deepEqual(row.displayMaster,old.displayMaster);assert.deepEqual(row.responsivePreviews,old.responsivePreviews);
 assert.deepEqual(row.caption,old.caption);assert.equal(row.renderInfo.renderTimestampUTC,old.renderInfo.renderTimestampUTC);
 assert.equal(row.renderInfo.sourceProofSHA256s.postingLayout,'b'.repeat(64));
 assert.equal(next.currentPictures.find(r=>r.identity===identities[1]),catalog.currentPictures.find(r=>r.identity===identities[1]));
});

test('later posting editions archive only their download URLs without reclaiming shared scene URLs',()=>{
 const catalog=current(),firstEntry=posting(),first=integratePostingDownloads(catalog,[firstEntry],base),firstRow=first.currentPictures.find(r=>r.identity===firstEntry.identity);
 const second=integratePostingDownloads(first,[posting(firstEntry,'two')],base),row=second.currentPictures.find(r=>r.identity===firstEntry.identity),index=indexMedia(second,base);
 assert.equal(second.previousDownloadEditions.length,2);
 assert.equal(index.get(key(catalog.currentPictures[0].download.url)),catalog.currentPictures[0]);
 assert.equal(index.get(key(firstRow.download.url)),firstRow);
 assert.equal(index.get(key(row.download.url)),row);for(const url of sceneURLs(row))assert.equal(index.get(key(url)),row);
 assert.equal(firstRow.renderInfo.sourceProofSHA256s.postingLayout,'b'.repeat(64));assert.equal(row.renderInfo.sourceProofSHA256s.postingLayout,'c'.repeat(64));
});

test('posting rejects duplicate identities, missing current clean scenes and missing proof hashes',()=>{
 const catalog=current(),entry=posting();
 assert.throws(()=>integratePostingDownloads(catalog,[],base),/empty/);
 assert.throws(()=>integratePostingDownloads(catalog,[entry,entry],base),/Duplicate/);
 assert.throws(()=>integratePostingDownloads(history,[entry],base),/exactly one current/);
 const duplicates={...catalog,currentPictures:[...catalog.currentPictures,catalog.currentPictures[0]]};
 assert.throws(()=>integratePostingDownloads(duplicates,[entry],base),/exactly one current/);
 const noClean=structuredClone(catalog);delete noClean.currentPictures[0].cleanPresentation;
 assert.throws(()=>integratePostingDownloads(noClean,[entry],base),/current clean portrait/);
 for(const proof of [undefined,{}, {sha256:'not-a-hash'}, {sha256:'A'.repeat(64)}]){
  const changed=posting();changed.provenance.postingLayout=proof;assert.throws(()=>integratePostingDownloads(catalog,[changed],base),/proof hash/);
 }
 assert.throws(()=>integratePostingDownloads(catalog,[originalEntry(identities[0])],base),/expanded portrait/);
 const corrupt=posting();corrupt.download.sceneBounds[0]=179;assert.throws(()=>integratePostingDownloads(catalog,[corrupt],base),/bounds/);
});

test('posting cannot change any scene asset, caption, date, credit or existing source proof',()=>{
 const mutations=[
  x=>x.displayMaster.url+='-changed',x=>x.displayMaster.bytes++,x=>{x.displayMaster.sha256='d'.repeat(64);x.download.sceneSourceSHA256=x.displayMaster.sha256;for(const p of x.responsivePreviews)p.sourceSHA256=x.displayMaster.sha256;},
  x=>x.responsivePreviews[0].url+='-changed',x=>x.responsivePreviews[0].bytes++,x=>x.responsivePreviews[0].sha256='d'.repeat(64),
  x=>x.caption.creator='Another creator',x=>x.caption.sourceDates='A different source edition',x=>x.caption.requiredModelCredits.push('Another architectural source'),x=>x.caption.fullCredits.push('An additional source statement'),x=>x.caption.openStreetMap=!x.caption.openStreetMap,
  x=>{x.title=x.caption.title='A changed title';},x=>{x.renderTimestampUTC=x.caption.renderTimestampUTC='2026-11-13T12:00:00Z';},x=>x.sourceSceneSHA256='d'.repeat(64),
  x=>x.provenance.sceneProof.sha256='d'.repeat(64),x=>delete x.provenance.sceneProof,x=>x.provenance.unrelatedProof={sha256:'d'.repeat(64)}
 ];
 const catalog=current(),before=structuredClone(catalog);
 for(const mutate of mutations){const entry=posting();mutate(entry);assert.throws(()=>integratePostingDownloads(catalog,[entry],base),/cannot change scene/);assert.deepEqual(catalog,before);}
});

test('new downloads cannot collide with history, current scenes, prior downloads or another posting',()=>{
 const catalog=current(),before=indexMedia(catalog,base),old=catalog.currentPictures[0];
 const urls=[old.download.url,...sceneURLs(old),catalog.currentPictures[1].download.url,history.images[0].download.url,history.images.find(r=>r.aliases.length)?.aliases[0]].filter(Boolean);
 for(const url of urls)for(const suffix of ['', '?posting=new#revision']){
  const entry=posting();entry.download.url=url+suffix;assert.throws(()=>integratePostingDownloads(catalog,[entry],base),/new URL|distinct URLs|separate assets/);
 }
 const first=integratePostingDownloads(catalog,[posting()],base),reused=posting(undefined,'two');reused.download.url=old.download.url;
 assert.throws(()=>integratePostingDownloads(first,[reused],base),/new URL/);
 const a=posting(),b=posting(originalEntry(identities[1]));b.download.url=a.download.url;
 assert.throws(()=>integratePostingDownloads(catalog,[a,b],base),/new URL/);
 assert.deepEqual([...indexMedia(catalog,base)],[...before]);
 const poisoned={...catalog,previousDownloadEditions:[{...old,download:{...old.download,url:old.displayMaster.url}}]};
 assert.throws(()=>indexMedia(poisoned,base),/Previous download URL/);
});

test('posting batches are atomic and the generic scene-edition collision rule stays strict',()=>{
 const catalog=current(),snapshot=structuredClone(catalog),first=posting(),second=posting(originalEntry(identities[1]));second.caption.creator='Changed';
 assert.throws(()=>integratePostingDownloads(catalog,[first,second],base),/cannot change scene/);assert.deepEqual(catalog,snapshot);
 assert.throws(()=>integrateCurrentPictures(catalog,[first],base),/new URLs/);
 const accepted=integratePostingDownloads(catalog,[first,posting(originalEntry(identities[1]))],base);
 assert.equal(accepted.previousDownloadEditions.length,2);assert.equal(accepted.currentPictures.length,catalog.currentPictures.length);
});

test('an independently integrated new scene can receive a posting without changing earlier editions',()=>{
 const catalog=integratePostingDownloads(current(),[posting()],base),newScene=originalEntry(identities[0]);
 for(const asset of [newScene.displayMaster,newScene.download,...newScene.responsivePreviews])asset.url='gallery/test-only/new-scene/'+asset.url.split('/').at(-1);
 newScene.displayMaster.sha256='8'.repeat(64);newScene.download.sceneSourceSHA256=newScene.displayMaster.sha256;for(const asset of newScene.responsivePreviews)asset.sourceSHA256=newScene.displayMaster.sha256;
 newScene.sourceSceneSHA256='7'.repeat(64);newScene.renderTimestampUTC=newScene.caption.renderTimestampUTC='2026-11-13T12:00:00Z';
 const next=integrateCurrentPictures(catalog,[newScene],base),before=indexMedia(next,base),withPosting=integratePostingDownloads(next,[posting(newScene,'two')],base),after=indexMedia(withPosting,base);
 const oldCurrent=next.currentPictures.find(row=>row.identity===newScene.identity),newCurrent=withPosting.currentPictures.find(row=>row.identity===newScene.identity);
 for(const [url,row] of before)assert.equal(after.get(url),row===oldCurrent&&sceneURLs(row).some(value=>key(value)===url)?newCurrent:row);
 assert.equal(newCurrent.renderInfo.renderTimestampUTC,newScene.renderTimestampUTC);assert.equal(newCurrent.renderInfo.sourceSceneSHA256,newScene.sourceSceneSHA256);
});
