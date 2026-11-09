import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assetURL} from '../public/asset-delivery.js';
import {deliveryPaths} from '../public/asset-delivery-map.js';
import {normalizeCleanMedia} from '../public/clean-media.js';
import {previewDownloadURL} from '../public/image-preview.js';
import {isDeliveredImageURL,prepareImageLinks,saveManagedImage,installManagedImageDownloads} from '../public/file-actions.js';
const base='https://futuremississauga.com/',pub=new URL('../public/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('data/presentation-media-20261109.json',pub)));
const rows=manifest.images.map(row=>normalizeCleanMedia(row,base));
const assets=manifest.images.flatMap(row=>[row.displayMaster,row.download]);
const savedFetch=globalThis.fetch,savedLocation=globalThis.location;
globalThis.location={href:base,origin:new URL(base).origin};
globalThis.fetch=async path=>{try{return new Response(fs.readFileSync(new URL(path,pub)));}catch{return new Response('',{status:404});}};
const {mediaCatalog,indexMedia,resolveMedia}=await import('../public/media-catalog.js?image-delivery-test');
await mediaCatalog;globalThis.fetch=savedFetch;

test('ten approved full-resolution PNGs resolve exactly while their source metadata stays immutable',()=>{
 assert.equal(assets.length,10);
 assert.deepEqual(Object.keys(deliveryPaths).filter(path=>path.startsWith('gallery/revision-20261109/')).sort(),assets.map(asset=>asset.url).sort());
 const before=structuredClone(rows),index=indexMedia({images:[],currentPictures:rows},base);
 for(const row of rows)for(const role of ['displayMaster','download']){
  const asset=row[role],filename=asset.url.split('/').at(-1),hosted='https://assets.futuremississauga.com/assets/'+asset.sha256+'/'+filename;
  assert.equal(assetURL(asset.url),hosted);
  assert.equal(assetURL(asset.url+'?edition=reviewed'),hosted);
  assert.equal(index.get(new URL(asset.url,base).href),row);
  assert.equal(index.get(hosted),row);
 }
 assert.deepEqual(rows,before);
 const historical='https://github.com/itsdanielsultan/future-mississauga/releases/download/older/accepted.png';assert.equal(assetURL(historical),historical);
 assert.equal(assetURL('gallery/unlisted.png'),'gallery/unlisted.png');
});

test('hosted metadata lookup and credited fallback accept only exact pinned image destinations',async()=>{
 for(const entry of manifest.images){
  const hosted=assetURL(entry.displayMaster.url),row=await resolveMedia(hosted);
  assert.equal(row.identity,entry.identity);assert.equal(row.displayMaster.sha256,entry.displayMaster.sha256);
  const download=assetURL(entry.download.url);assert(isDeliveredImageURL(download));
  assert.equal(previewDownloadURL({dataset:{previewDownload:download}},hosted,base),download);
 }
 for(const url of ['https://assets.futuremississauga.com/assets/'+ '0'.repeat(64) +'/unknown.png',assetURL(assets[0].url)+'?unexpected=1','https://example.com/picture.png']){
  assert.equal(isDeliveredImageURL(url),false);
  assert.equal(previewDownloadURL({dataset:{previewDownload:url}},'fallback.png',base),'fallback.png');
 }
});

test('static fallback links use approved hosted URLs and retain native catalogue paths separately',()=>{
 const html=fs.readFileSync(new URL('index.html',pub),'utf8');let count=0;
 for(const match of html.matchAll(/(?:href|data-preview-download)="([^"]+)"/g)){
  if(!match[1].startsWith('https://assets.futuremississauga.com/'))continue;
  assert(assets.some(asset=>assetURL(asset.url)===match[1]),match[1]);count++;
 }
 assert.equal(count,7);
 assert(assets.every(asset=>asset.url.startsWith('gallery/revision-20261109/')));
 assert(!/href="gallery\/revision-20261109\/[^"\n]+\.png"/.test(html));
});

test('hosted download enhancement preserves a clear accessible action and exact URL',()=>{
 const source=assets.find(asset=>asset.role==='nativeSceneWithAppendedCreditFooter').url;
 const attrs={},classes=new Set(),anchor={href:assetURL(source),dataset:{},textContent:'Download PNG ↓',matches:()=>false,querySelector:()=>null,closest:selector=>selector==='figure'?{querySelector:()=>({textContent:'Downtown'})}:null,hasAttribute:()=>false,setAttribute:(key,value)=>attrs[key]=value,classList:{add:value=>classes.add(value)}};
 prepareImageLinks({querySelectorAll:()=>[anchor]});
 assert.equal(anchor.href,assetURL(source));assert.equal(attrs['aria-label'],'Download Downtown PNG');assert(classes.has('file-download'));
});


test('managed downloads verify exact bytes before saving and defer blob URL cleanup',async()=>{
 const asset=assets.find(asset=>asset.role==='nativeSceneWithAppendedCreditFooter'),body=fs.readFileSync(new URL(asset.url,pub));
 const callbacks=[],calls=[],saved=[];let removed=0,blob;
 const doc={body:{append:node=>saved.push(node)},createElement:()=>({click(){calls.push('click');},remove(){removed++;}})};
 const urlAPI={createObjectURL:value=>{blob=value;calls.push('create');return 'blob:verified-image';},revokeObjectURL:url=>calls.push('revoke:'+url)};
 await saveManagedImage(asset.url,{doc,urlAPI,fetcher:async(url,options)=>{assert.equal(url,assetURL(asset.url));assert.equal(options.credentials,'omit');return new Response(body);},defer:(fn,delay)=>callbacks.push({fn,delay})});
 assert.deepEqual(calls,['create','click']);assert.equal(removed,1);assert.equal(saved[0].download,asset.url.split('/').at(-1));
 assert.equal(saved[0].href,'blob:verified-image');assert.equal(blob.type,'image/png');assert.equal(blob.size,asset.bytes);
 assert.equal(callbacks.length,1);assert(callbacks[0].delay>=1000);callbacks[0].fn();assert.equal(calls.at(-1),'revoke:blob:verified-image');
 for(const response of [new Response('unavailable',{status:503}),new Response('wrong image bytes')]){
  await assert.rejects(saveManagedImage(asset.url,{doc,urlAPI,fetcher:async()=>response}));
 }
 assert.equal(saved.length,1,'failed downloads must never claim to save a file');
});

test('delegated download handler installs once and leaves modified or unrelated clicks alone',async()=>{
 const listeners=[],doc={addEventListener:(name,fn)=>listeners.push({name,fn})};
 installManagedImageDownloads(doc);installManagedImageDownloads(doc);assert.equal(listeners.length,1);
 let prevented=0;
 const anchor={href:assetURL(assets[0].url),hasAttribute:()=>true};
 for(const modifier of ['metaKey','ctrlKey','shiftKey','altKey'])await listeners[0].fn({button:0,[modifier]:true,preventDefault:()=>prevented++,target:{closest:()=>anchor}});
 await listeners[0].fn({button:1,preventDefault:()=>prevented++,target:{closest:()=>anchor}});
 await listeners[0].fn({button:0,preventDefault:()=>prevented++,target:{closest:()=>({...anchor,href:'https://example.com/image.png'})}});
 assert.equal(prevented,0);
});
