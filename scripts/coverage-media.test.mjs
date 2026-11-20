import {MEADOWVALE_IDENTITIES,MEADOWVALE_MANIFEST_SHA256} from '../public/meadowvale-media-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeCleanMedia,ACTIVE_PICTURE_IDENTITIES} from '../public/clean-media.js';
import {EAST_CREDIT_IDENTITIES,EAST_CREDIT_MANIFEST_SHA256} from '../public/east-credit-media-policy.js';
import {COVERAGE_IDENTITIES,COVERAGE_MANIFEST_SHA256} from '../public/coverage-media-policy.js';
import {buildGalleryCatalogue,filterGallery} from '../public/gallery-catalogue.js';
import {loadLocalAssetMap} from './local-asset-map.mjs';

const pub=new URL('../public/',import.meta.url),base='http://127.0.0.1:4194/';
const raw=await readFile(new URL('data/coverage-media-20261113.json',pub),'utf8'),manifest=JSON.parse(raw);
const eastRaw=await readFile(new URL('data/east-credit-media-20261113.json',pub),'utf8'),eastManifest=JSON.parse(eastRaw);
const savedFetch=globalThis.fetch;globalThis.location={href:base,origin:new URL(base).origin};
const fetcher=async path=>path==='data/coverage-media-20261113.json'?new Response(raw):path==='data/labelled-image-assets.json'?new Response('{"images":[]}'):new Response('',{status:404});
globalThis.fetch=fetcher;
const {mediaCatalog,loadMediaCatalog,integrateCoveragePictures,integrateEastCreditPictures,integrateMeadowvalePictures,refreshCatalogPictures,hasPublishedImageDelivery}=await import('../public/media-catalog.js?coverage-tests');
await mediaCatalog;globalThis.fetch=savedFetch;

test('the six accepted additions have their own pin and keep the original 57+2 identities separate',()=>{
  assert.equal(createHash('sha256').update(raw).digest('hex'),COVERAGE_MANIFEST_SHA256);
  assert.equal(ACTIVE_PICTURE_IDENTITIES.length,57);assert.equal(COVERAGE_IDENTITIES.length,6);
  for(const entry of manifest.images){
    assert(!ACTIVE_PICTURE_IDENTITIES.includes(entry.identity));
    assert.throws(()=>normalizeCleanMedia(entry,base),/identity/);
    const row=normalizeCleanMedia(entry,base,{coverage:true});
    assert.equal(row.coverageAddition,true);assert.equal(row.caption.area,entry.caption.area);
    assert.equal(row.renderInfo.sourceProofSHA256s.finalFrozenAdoption,manifest.finalFrozenAdoptionSHA256);
  }
});

test('adoption, accepted pixels, source credits, bounded scope and dates cannot drift',()=>{
  for(const mutate of [r=>r.originalSourceFreezeState='FINAL_FROZEN',r=>r.sourceFreezeState='TRIAL_FROZEN',r=>r.sourceSceneSHA256='0'.repeat(64),r=>r.provenance.finalFrozenAdoption.sha256='0'.repeat(64),r=>r.provenance.deliveryManifest.sha256='0'.repeat(64),r=>r.caption.requiredModelCredits=[],r=>r.caption.fullCredits=[],r=>r.caption.geographicScope='whole_municipality',r=>r.caption.renderTimestampUTC='2026-11-14T00:00:00Z',r=>r.download.sha256='0'.repeat(64),r=>r.responsivePreviews[0].sha256='0'.repeat(64)]){
    const row=structuredClone(manifest.images[0]);mutate(row);assert.throws(()=>normalizeCleanMedia(row,base,{coverage:true}));
  }
});

test('portrait adapter retains exact expanded canvas bounds and rejects overlap or rescaling',()=>{
  for(const entry of manifest.images.filter(row=>row.identity.startsWith('portraits/'))){
    const row=normalizeCleanMedia(entry,base,{coverage:true});
    assert.deepEqual(row.nativeSceneDimensions,[3240,4050]);assert.deepEqual(row.cleanPresentation.sceneBounds,[180,0,3420,4050]);
    assert.deepEqual(row.cleanPresentation.footerBounds,[0,4050,3600,4500]);assert.equal(row.cleanPresentation.sceneOverlay,false);
    for(const mutate of [r=>r.download.sideMarginsPx=[0,0],r=>r.download.sceneOverlay=true,r=>r.download.sceneResize=true,r=>r.download.sceneBounds=[0,0,3240,4050]]){
      const changed=structuredClone(entry);mutate(changed);assert.throws(()=>normalizeCleanMedia(changed,base,{coverage:true}));
    }
  }
});

test('public adoption requires complete delivery and a changed manifest is never adopted',async()=>{
  const local=await loadMediaCatalog(fetcher,{baseURL:base});assert.equal(local.currentPictures.length,6);
  const live=await loadMediaCatalog(fetcher,{baseURL:'https://futuremississauga.com/'});assert.equal(live.currentPictures?.length,hasPublishedImageDelivery(manifest)?6:undefined);
  const changed=await loadMediaCatalog(async path=>path==='data/coverage-media-20261113.json'?new Response(raw+' '):fetcher(path),{baseURL:base});assert.equal(changed.currentPictures,undefined);
});

test('new wide views enter the area catalogue without entering matched comparisons or lead selection',async()=>{
  const history={images:[]},catalogue=integrateCoveragePictures(history,manifest.images,base),pictures={images:{}};
  refreshCatalogPictures(pictures,catalogue);assert.equal(Object.keys(pictures.images).length,3);
  assert.equal(Object.keys(pictures.comparisonImages).length,0);
  const districts=JSON.parse(await readFile(new URL('data/districts.json',pub)));
  const cards=buildGalleryCatalogue(districts,pictures.images);assert.equal(cards.length,3);
  assert.equal(filterGallery(cards,{area:'lorne-park'}).visible[0].viewTitle,'Aldo Drive neighbourhood');
  assert.throws(()=>integrateCoveragePictures(history,manifest.images.slice(1),base),/six/);
  const social=await readFile(new URL('./fixtures/social-20261113.html',import.meta.url),'utf8');
  assert.equal((social.match(/<article /g)||[]).length,29);assert.equal((social.match(/data-recommended="true"/g)||[]).length,8);
  for(const entry of manifest.images.filter(row=>row.identity.startsWith('portraits/'))){assert(social.includes(entry.download.url));assert(social.includes(entry.displayMaster.url));}
});

test('local preview mapping refuses traversal, duplicate or unpinned file data',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fm-local-assets-'));
  try{
    const file=join(dir,'proof.png');await writeFile(file,'test');const pin=createHash('sha256').update('test').digest('hex');
    const assets=Array.from({length:36},(_,i)=>({url:`gallery/missing-areas-20261113/image-${i}.png`,path:file,bytes:4,sha256:pin}));
    const map=join(dir,'map.json');const save=async rows=>writeFile(map,JSON.stringify({schema:'future-mississauga-local-asset-map/v1',assets:rows}));
    await save(assets);assert.equal((await loadLocalAssetMap(map)).size,36);
    for(const mutate of [a=>a[0].url='../private.txt',a=>a[0].sha256='0'.repeat(64),a=>a[0].bytes=100,a=>a[1].url=a[0].url]){const rows=structuredClone(assets);mutate(rows);await save(rows);await assert.rejects(loadLocalAssetMap(map));}
  }finally{await rm(dir,{recursive:true,force:true});}
});


test('East Credit is a separately pinned pair with its final footer and source history intact',()=>{
  assert.equal(createHash('sha256').update(eastRaw).digest('hex'),EAST_CREDIT_MANIFEST_SHA256);
  assert.deepEqual(eastManifest.images.map(row=>row.identity).sort(),[...EAST_CREDIT_IDENTITIES].sort());
  assert.equal(COVERAGE_IDENTITIES.length,6);
  for(const entry of eastManifest.images){
    assert.throws(()=>normalizeCleanMedia(entry,base),/identity/);
    const row=normalizeCleanMedia(entry,base,{coverage:true});
    assert.equal(row.caption.title,'East Credit & Creditview');assert.equal(row.caption.subtitle,undefined);
    assert.equal(entry.originalSourceFreezeState,'FINAL_FROZEN');
    for(const mutate of [r=>r.originalSourceFreezeState='TRIAL_FROZEN',r=>r.provenance.sourcePackage.sha256='0'.repeat(64),r=>r.caption.subtitle='Neighbourhood context',r=>r.displayMaster.sha256='0'.repeat(64),r=>r.caption.openStreetMap=false]){const changed=structuredClone(entry);mutate(changed);assert.throws(()=>normalizeCleanMedia(changed,base,{coverage:true}));}
  }
  const catalogue=integrateEastCreditPictures(integrateCoveragePictures({images:[]},manifest.images,base),eastManifest.images,base);
  assert.equal(catalogue.currentPictures.length,8);
  assert.throws(()=>integrateEastCreditPictures({images:[]},eastManifest.images.slice(1),base),/pair/);
});

test('East Credit delivery stays independent and one damaged batch cannot replace the other',async()=>{
  const both=async path=>path==='data/east-credit-media-20261113.json'?new Response(eastRaw):fetcher(path);
  const local=await loadMediaCatalog(both,{baseURL:base});assert.equal(local.currentPictures.length,8);
  const live=await loadMediaCatalog(both,{baseURL:'https://futuremississauga.com/'}),publishedCount=(hasPublishedImageDelivery(manifest)?6:0)+(hasPublishedImageDelivery(eastManifest)?2:0);assert.equal(live.currentPictures?.length,publishedCount||undefined);
  const changed=await loadMediaCatalog(async path=>path==='data/east-credit-media-20261113.json'?new Response(eastRaw+' '):fetcher(path),{baseURL:base});assert.equal(changed.currentPictures.length,6);
  const social=await readFile(new URL('./fixtures/social-20261113.html',import.meta.url),'utf8');
  const entry=eastManifest.images.find(row=>row.identity.startsWith('portraits/'));
  const card=(social.match(/<article\b[\s\S]*?<\/article>/g)||[]).filter(card=>card.includes('data-district="east-credit-creditview"'));
  assert.equal(card.length,1);assert(card[0].includes(entry.displayMaster.url));assert(card[0].includes(entry.download.url));
  assert(card[0].includes('data-recommended="false"'));assert(!/class="image-link"[^>]* download/.test(card[0]));
});

test('every rendition needs a registered release destination before public activation',()=>{
 const destination=url=>'https://github.com/itsdanielsultan/future-mississauga/releases/download/neighbourhood-images-2026-11-13-v1/'+url.split('/').pop();
 for(const batch of [manifest,eastManifest]){
  assert.equal(hasPublishedImageDelivery(batch,value=>value),false);
  assert.equal(hasPublishedImageDelivery({...batch,publication:true},value=>value),false);
  assert.equal(hasPublishedImageDelivery(batch,destination),true);
  const absent=batch.images[0].download.url;
  assert.equal(hasPublishedImageDelivery(batch,url=>url===absent?url:destination(url)),false);
  assert.equal(hasPublishedImageDelivery(batch,url=>destination(url).replace('github.com','example.com')),false);
 }
});


test('the frozen Meadowvale pair retains exact source pixels and separate local/release activation',async()=>{
 const text=await readFile(new URL('data/meadowvale-media-20261113.json',pub),'utf8'),data=JSON.parse(text);
 assert.equal(createHash('sha256').update(text).digest('hex'),MEADOWVALE_MANIFEST_SHA256);
 assert.deepEqual(data.images.map(row=>row.identity).sort(),[...MEADOWVALE_IDENTITIES].sort());
 const result=integrateMeadowvalePictures({images:[]},data.images,base);assert.equal(result.currentPictures.length,2);
 for(const entry of data.images){const row=normalizeCleanMedia(entry,base,{coverage:true});assert.equal(row.caption.area,'Meadowvale Village');assert.equal(entry.originalSourceFreezeState,'FINAL_FROZEN');const altered=structuredClone(entry);altered.provenance.sourcePackage.sha256='0'.repeat(64);assert.throws(()=>normalizeCleanMedia(altered,base,{coverage:true}));}
 const get=async path=>path==='data/meadowvale-media-20261113.json'?new Response(text):fetcher(path);
 assert.equal((await loadMediaCatalog(get,{baseURL:base})).currentPictures.length,8);
 assert.throws(()=>integrateMeadowvalePictures({images:[]},data.images.slice(1),base),/pair/);
});
