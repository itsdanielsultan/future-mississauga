import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createResolvedPreview,createImagePreview} from '../public/image-preview.js';
const pub=new URL('../public/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,pub),'utf8');
const entry=read('image-entry.js');
const experienceImports=[...entry.matchAll(/import\(\s*(['"])\.\/image-experience\.js(?:\?[^'"]*)?\1\s*\)/g)];
assert.equal(experienceImports.length,1,'the entry must import the shared experience exactly once');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const page=read('review-renders.html');
const exterior=page.match(/href="([^"]+-study-exterior\.png)"/)[1];
const reviewPDF=page.match(/href="([^"]+-study-review\.pdf)"/)[1];
function harness(){
 const dependency=deferred(),listeners=new Map(),notices=[],opens=[],navigations=[];
 let installed=false,loads=0,reloads=0;
 const main={prepend:node=>notices.push(node)};
 const node=(tag='p')=>({tag,isConnected:true,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},append(...children){this.children.push(...children)},addEventListener(type,fn){this['on'+type]=fn},click(){this.onclick?.()}});
 const document={readyState:'loading',querySelector:s=>s==='main'?main:null,createElement:node,
  addEventListener(type,fn,options){listeners.set(type,[...listeners.get(type)||[],{fn,capture:options===true,once:options?.once}])},
  removeEventListener(type,fn,options){listeners.set(type,(listeners.get(type)||[]).filter(x=>x.fn!==fn||x.capture!==(options===true)))}};
 function control(kind='image',{explicit=false,icon=false,text='',gallery=false,excluded=false,href=kind==='pdf'?reviewPDF:exterior}={}){
  const a=node('a'),img=kind==='image'?node('img'):null;
  Object.assign(a,{href,textContent:text,matches:s=>s==='a'||(s.includes('.save')&&explicit),hasAttribute:k=>k==='data-document-preview'&&kind==='declared-pdf',querySelector:s=>s==='img'?img:s==='svg'&&icon?{}:null});
  const closest=s=>s==='main'?main:s==='dialog,.picture-compare,.site-brand'?(excluded?{}:null):s==='a,button'?a:s==='[data-download]'?(explicit?a:null):s==='[data-open]'?(gallery?a:null):s==='img'?img:null;
  a.closest=closest;if(img)img.closest=closest;
  a.click=()=>click(a);
  return {a,img,target:img||a,kind,explicit,gallery,excluded};
 }
 function click(target,options={}){
  const e={target,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...options};
  for(const row of [...listeners.get('click')||[]]){row.fn(e);if(e.stopped)break}
  if(!e.stopped&&installed&&!options.metaKey&&!options.ctrlKey&&!options.shiftKey&&!options.altKey&&e.button===0){
   const a=target.closest('a,button');
   if(!a.matches('.save')&&!/^Download\b/.test(a.textContent)&&!target.closest('[data-open]')&&!target.closest('dialog,.picture-compare,.site-brand')){e.preventDefault();opens.push(a.href)}
  }
  if(!e.defaultPrevented)navigations.push(target.closest('a,button').href);
  return e;
 }
 const context=vm.createContext({document,location:{href:'https://futuremississauga.com/review-renders.html',origin:'https://futuremississauga.com',reload(){reloads++}},URL,Symbol,
  loadExperience(){loads++;return dependency.promise.then(()=>{installed=true})}});
 const source=entry.replace(experienceImports[0][0],'loadExperience()');
 const run=()=>vm.runInContext(source,context);run();
 return {control,click,opens,navigations,notices,dependency,run,get loads(){return loads},get reloads(){return reloads},get captures(){return(listeners.get('click')||[]).length},ready(){document.readyState='interactive';for(const row of [...listeners.get('DOMContentLoaded')||[]]){if(row.once)document.removeEventListener('DOMContentLoaded',row.fn);row.fn()}}};
}
for(const kind of ['image','png','pdf'])test('first '+kind+' preview click queues while dependencies load and opens exactly once',async()=>{
 const h=harness(),c=h.control(kind);h.click(c.target);
 assert.equal(c.a.attrs['aria-busy'],'true');assert.equal(h.navigations.length,0);assert.equal(h.loads,0);
 h.ready();await tick();assert.equal(h.opens.length,0);assert.equal(h.navigations.length,0);
 h.dependency.resolve();await tick();assert.deepEqual(h.opens,[c.a.href]);assert.equal(c.a.attrs['aria-busy'],undefined);assert.equal(h.captures,0);
 h.click(c.target);assert.equal(h.opens.length,2);assert.equal(h.navigations.length,0);
});

test('rapid early clicks retain only the last preview and duplicate entry execution installs once',async()=>{
 const h=harness(),a=h.control('png'),b=h.control('pdf');h.run();assert.equal(h.captures,1);
 h.click(a.target);h.click(b.target);h.click(b.target);assert.equal(a.a.attrs['aria-busy'],undefined);
 h.ready();assert.equal(h.loads,1);h.dependency.resolve();await tick();assert.deepEqual(h.opens,[reviewPDF]);
});

test('downloads, gallery-owned controls, middle clicks and modifiers bypass preview capture',()=>{
 const h=harness();
 for(const options of [{explicit:true},{text:'Download PNG ↓'},{gallery:true},{excluded:true}]){
  const c=h.control('image',options);const e=h.click(c.target);assert.equal(e.defaultPrevented,false);assert.equal(c.a.attrs['aria-busy'],undefined);
 }
 for(const options of [{button:1},{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true}])assert.equal(h.click(h.control('png').target,options).defaultPrevented,false);
 assert.equal(h.opens.length,0);
});

test('module failure preserves preview intent, exposes reload recovery and leaves explicit downloads working',async()=>{
 const h=harness(),c=h.control('png');h.click(c.target);h.ready();h.dependency.reject(Error('module network failure'));await tick();
 assert.equal(c.a.attrs['aria-busy'],undefined);assert.equal(h.notices.length,1);assert.equal(h.notices[0].attrs.role,'alert');assert.equal(h.navigations.length,0);
 h.click(c.target);assert.equal(h.notices.length,1);assert.equal(h.navigations.length,0);
 h.click(h.control('png',{explicit:true}).target);assert.equal(h.navigations.length,1);
 h.notices[0].children[1].click();assert.equal(h.reloads,1);
});

test('a document preview with an arrow icon is still queued while a separate download bypasses it',()=>{
 const h=harness(),preview=h.control('declared-pdf',{icon:true,href:'https://futuremississauga.com/downloads/City-of-Mississauga-Open-Data-Terms.pdf'});
 assert.equal(h.click(preview.target).defaultPrevented,true);
 const download=h.control('pdf',{explicit:true,icon:true});assert.equal(h.click(download.target).defaultPrevented,false);
});

function previewHarness(){
 const events={},shown=[];let opens=0;
 const preview={dialog:{open:false,addEventListener:(type,fn)=>events[type]=fn},show(info){if(!this.dialog.open)opens++;this.dialog.open=true;shown.push(info)}};
 const show=createResolvedPreview(preview);
 return {show,shown,preview,get opens(){return opens},close(){preview.dialog.open=false;events.close()}};
}

test('the real linked image opens immediately and metadata updates the same dialog once',async()=>{
 const h=previewHarness(),metadata=deferred(),fallback={src:exterior,download:exterior,preview:exterior};
 const task=h.show(fallback,()=>metadata.promise,{});assert.deepEqual(h.shown,[fallback]);assert.equal(h.opens,1);
 metadata.resolve({meta:'PNG · 3K'});await task;assert.equal(h.shown.length,2);assert.equal(h.shown[1].src,exterior);assert.equal(h.opens,1);
});

test('failed metadata keeps the actual linked image and its dedicated download usable',async()=>{
 const h=previewHarness(),fallback={src:exterior,download:exterior};await h.show(fallback,()=>Promise.reject(Error('metadata unavailable')),{});
 assert.deepEqual(h.shown,[fallback]);assert.equal(h.opens,1);assert.equal(h.preview.dialog.open,true);
});

test('late metadata cannot reopen a closed dialog or replace a newer selection',async()=>{
 const h=previewHarness(),first=deferred();const task=h.show({src:'first.png'},()=>first.promise,{});h.close();first.resolve({src:'late.png'});await task;
 assert.equal(h.shown.length,1);assert.equal(h.preview.dialog.open,false);
 const old=deferred(),latest=deferred();const a=h.show({src:'old.png'},()=>old.promise,{}),b=h.show({src:'new.png'},()=>latest.promise,{});
 latest.resolve({src:'new-full.png'});await b;old.resolve({src:'old-full.png'});await a;
 assert.equal(h.shown.at(-1).src,'new-full.png');assert(!h.shown.some(x=>x.src==='old-full.png'));
});

test('all shared preview pages load capture before content and Social has one preview owner',()=>{
 const pages=['index.html','explore.html','social.html','sources.html','updates.html','review-renders.html','reference-updates.html','accuracy-review.html'];
 for(const name of pages){const html=read(name),tags=[...html.matchAll(/<script\s+src=(['"])image-entry\.js(?:\?[^'"]*)?\1><\/script>/g)];assert.equal(tags.length,1,name);assert(html.indexOf(tags[0][0])<html.indexOf('</head>'),name);assert.doesNotMatch(html,/<script[^>]+src="image-experience\.js/,name);}
 assert.match(read('image-experience.js'),/if\(document\.querySelector\('\.social-grid'\)\) installSocialPreview\(\)/);
 assert.doesNotMatch(read('social.js'),/installSocialPreview/);
 // Updating a cache token must leave the already-reviewed bootstrap code intact.
 const galleryEntry=read('gallery-entry.js').replace(/(['"]\.\/gallery\.js\?v=)[^'"]+(['"])/g,(_match,start,end)=>start+'20261102-coherent1'+end);
 assert.equal(createHash('sha256').update(galleryEntry).digest('hex'),'7dbe4cf707a971f53910824146f13d05ec7cefc3eb2cafee60838d99d88f8200');
});

// Cached gallery and refreshed shared entry can import different query editions.
test('preview labels remain unique across module query editions',async()=>{
 const previous=globalThis.document;
 const node=()=>({attrs:{},style:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(){},querySelector(){return node()}});
 globalThis.document={createElement:node,body:{append(){}}};
 try{
  const second=await import('../public/image-preview.js?preview-counter-regression');
  const a=createImagePreview().dialog,b=second.createImagePreview().dialog;
  assert.notEqual(a.attrs['aria-labelledby'],b.attrs['aria-labelledby']);
  assert.match(a.attrs['aria-labelledby'],/^picturePreview-\d+Title$/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
