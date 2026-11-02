import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {previewDownloadURL,createResolvedPreview} from '../public/image-preview.js';

const base='https://futuremississauga.com/reference-updates.html';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const rows=JSON.parse(read('data/neighbourhood-media-20261102.json')).images;
const anchorFor=row=>({href:new URL(row.displayMaster.url,base).href,dataset:{previewDownload:row.download.url}});

test('declared downloads accept only same-origin PNGs or this repository’s immutable release PNG route',()=>{
 const fallback='unchanged-clean.png';
 for(const declared of [rows[0].download.url,'https://github.com/itsdanielsultan/future-mississauga/releases/download/native-v2/credited.png']){
  assert.equal(previewDownloadURL({dataset:{previewDownload:declared}},fallback,base),new URL(declared,base).href);
 }
 assert.equal(previewDownloadURL({dataset:{previewDownload:rows[0].download.url}},fallback,'http://127.0.0.1:4269/reference-updates.html'),new URL(rows[0].download.url,'http://127.0.0.1:4269/').href);
 for(const declared of ['javascript:alert(1)','data:image/png;base64,AA==','https://example.com/credited.png','https://futuremississauga.com.evil.test/credited.png','https://user:password@futuremississauga.com/credited.png','https://github.com/elsewhere/future-mississauga/releases/download/v2/credited.png','https://github.com/itsdanielsultan/future-mississauga/blob/main/credited.png','https://github.com:8443/itsdanielsultan/future-mississauga/releases/download/v2/credited.png','http://github.com/itsdanielsultan/future-mississauga/releases/download/v2/credited.png','/credited.jpg','/credited.png?redirect=elsewhere','/credited.png#fragment','http://[']){
  assert.equal(previewDownloadURL({dataset:{previewDownload:declared}},fallback,base),fallback,declared);
 }
 assert.equal(previewDownloadURL(null,fallback,base),fallback);
});

test('the actual shared resolver keeps explicit credited fallback and gives accepted catalogue/study metadata precedence',async()=>{
 let resolve,row=null,study=null;
 const previous=globalThis.location;globalThis.location={href:base};
 try{
  vm.runInNewContext(read('image-experience.js').replace(/^import .*;\n/gm,''),{
   installImagePreviews(fn){resolve=fn},previewDownloadURL,updateCleanImageCaption(){},
   resolveMedia:async()=>row,mediaPreviewInfo:value=>value,resolveStudyImage:async()=>study,
   installSocialPreview(){},installDocumentPreviews(){},installResponsiveImages:async()=>{},
   document:{querySelector(){return null}}
  });
  for(const record of rows){
   const anchor=anchorFor(record),image={src:new URL(record.responsivePreviews.find(p=>p.mimeType==='image/avif').url,base).href};
   const info=await resolve(image,anchor);
   assert.equal(info.src,anchor.href);assert.equal(info.download,new URL(record.download.url,base).href);
   row={src:'accepted-clean.png',download:'accepted-credit.png'};assert.equal(await resolve(image,anchor),row);row=null;
   study={src:'accepted-study.png',download:'accepted-study-credit.png'};assert.equal(await resolve(image,anchor),study);study=null;
   anchor.dataset.previewDownload='javascript:alert(1)';assert.equal((await resolve(image,anchor)).download,anchor.href);
  }
 }finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous}
});

test('the installed click handler preserves credited fallback when metadata fails and does not intercept modifiers',async()=>{
 const shown=[],listeners={},row=rows[0],anchor=anchorFor(row),section={querySelector:()=>({textContent:'Fairview'})};
 const image={src:new URL(row.responsivePreviews.find(p=>p.mimeType==='image/avif').url,base).href,alt:'Fairview before',dataset:{},naturalWidth:1800,naturalHeight:1100};
 image.closest=selector=>selector==='main img'?image:selector==='a,button'?anchor:selector==='main'?{}:selector==='article,section'?section:null;
 anchor.matches=selector=>selector==='a';anchor.querySelector=()=>image;
 const preview={dialog:{open:false,addEventListener(){}},show(info){this.dialog.open=true;shown.push(info)}};
 const source=read('image-preview.js').replace(/^import .*;\n/gm,'').replace(/^export \{.*;\n/gm,'').replace(/export function /g,'function ').replace('generic=createImagePreview()','generic=testPreview()');
 vm.runInNewContext(source+'\ninstallImagePreviews(async()=>{throw Error("catalogue unavailable")});',{
  document:{addEventListener(type,fn){listeners[type]=fn},querySelectorAll:()=>[]},location:{href:base},URL,Symbol,
  prepareImageLinks(){},isDirectDownload:()=>false,cityMapLinkForSection:()=>undefined,testPreview:()=>preview
 });
 const event=extra=>({target:image,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){},...extra});
 for(const extra of [{button:1},{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true}]){const e=event(extra);await listeners.click(e);assert.equal(e.defaultPrevented,false)}
 assert.equal(shown.length,0);
 const e=event();await listeners.click(e);assert.equal(e.defaultPrevented,true);assert.equal(shown.length,1);
 assert.equal(shown[0].src,anchor.href);assert.equal(shown[0].download,new URL(row.download.url,base).href);
});

test('late accepted metadata replaces a declared download within the same preview',async()=>{
 const shown=[],preview={dialog:{open:true,addEventListener(){}},show:info=>shown.push(info)};
 const anchor=anchorFor(rows[0]);
 await createResolvedPreview(preview)({src:anchor.href,download:previewDownloadURL(anchor,anchor.href,base)},async()=>({download:'accepted-credit.png'}),anchor);
 assert.equal(shown[0].download,new URL(rows[0].download.url,base).href);
 assert.equal(shown[1].download,'accepted-credit.png');assert.equal(shown[1].src,anchor.href);
});

test('exact three Fairview preview anchors declare their matching footer download without becoming download controls',()=>{
 let found=0;
 for(const name of ['reference-updates.html','updates.html']){
  const html=read(name);
  for(const row of rows){
   const tags=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]).filter(tag=>tag.includes('href="'+row.displayMaster.url+'"'));
   if(name==='updates.html'&&row.identity.endsWith('/before')){assert.equal(tags.length,0);continue}
   assert.equal(tags.length,1);found++;
   assert(tags[0].includes('data-preview-download="'+row.download.url+'"'));
   assert.doesNotMatch(tags[0],/\s(?:download|data-download)(?:\s|=|>)/);
  }
 }
 assert.equal(found,3);
});
