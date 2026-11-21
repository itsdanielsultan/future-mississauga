import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {projectDetailsHTML} from '../public/project-cards.js';

const root=new URL('../public/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
async function publicPages(directory=root){
 const entries=await readdir(directory,{withFileTypes:true}),pages=[];
 for(const entry of entries){
  if(entry.name==='vendor')continue;
  const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())pages.push(...await publicPages(url));
  else if(entry.name.endsWith('.html'))pages.push(url);
 }
 return pages;
}

test('public pages do not advertise 3D file or archive downloads',async()=>{
 for(const url of await publicPages()){
  const html=await readFile(url,'utf8');
  for(const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   assert.doesNotMatch(anchor[1],/\.(?:glb(?:\.gz)?|gltf|blend(?:\.zip)?|fbx|obj|stl)(?:[?#]|$)/i,url.pathname);
   if(/\.(?:zip|7z|tar(?:\.gz)?)(?:[?#]|$)/i.test(anchor[1])){
    assert.doesNotMatch(anchor[0],/\b(?:3d|models?|blender)\b/i,url.pathname);
   }
  }
 }
 const model=await read('model.html'),runtime=await read('model-preview.js');
 for(const script of model.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))if(script[1].trim()&&!script[0].includes('importmap'))assert.doesNotThrow(()=>new Script(script[1]),'model page bootstrap must parse');
 assert.doesNotMatch(model,/modelDownloads|compressedDownloads|downloadNote|Other download formats/);
 assert.doesNotMatch(runtime,/createObjectURL|\.download\s*=|modelDownloadAssets|download the model|model download/i);
 assert.doesNotMatch(await read('model-preview-loading.js'),/compressed download|model download|could not be downloaded/);
 const credits=await read('downloads/Model-study-credits.txt');
 assert.doesNotMatch(credits,/Download both the tower|DOWNLOAD IDENTITY/);
});

test('city-map project actions keep model previews without promising model files',async()=>{
 const projects=JSON.parse(await read('data/projects.json'));
 for(const project of projects){
  const html=projectDetailsHTML(project);
  assert.doesNotMatch(html,/model preview\s*(?:&amp;|&)\s*download/i,project.id);
  assert.doesNotMatch(html,/href=["'][^"']*\.(?:glb|blend)(?:\.gz)?["']/i,project.id);
 }
 for(const id of ['artform','sgm-maritz-6710','mcity-1-2']){
  assert.match(projectDetailsHTML({id,name:id}),/>Open model preview →<\/a>/);
 }
});

test('each interactive model has an addressable source note and complete downloadable credits',async()=>{
 const [model,notes,credits,data]=await Promise.all([
  'model.html','study-notes.html','downloads/Model-study-credits.txt','data/model-previews.json'
 ].map(read));
 const sidebar=model.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)[1];
 assert.doesNotMatch(sidebar,/<details\b/);
 assert.match(sidebar,/href="study-notes\.html#model-credits"/);
 assert.match(notes,/id="model-credits"/);
 const manifest=JSON.parse(data);
 const cityAssets=new Set(manifest.assets.filter(asset=>asset.cityDataTerms).map(asset=>asset.id));
 const encode=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#x27;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 for(const view of manifest.views){
  const opening='<article id="model-'+view.id+'">';
  assert.ok(notes.includes(opening),view.id);
  const article=notes.split(opening)[1].split('</article>')[0];
  for(const field of ['credit','summary','limits','rights']){
   if(!view[field])continue;
   assert.ok(article.includes(encode(view[field])),view.id+' '+field);
   assert.ok(credits.includes(view[field]),view.id+' '+field);
  }
  for(const source of [...view.sources,...(view.visibleReferenceCredit?[view.visibleReferenceCredit]:[])]){
   assert.ok(article.includes(encode(source.url)),view.id+' '+source.url);
   assert.ok(credits.includes(source.url),view.id+' '+source.url);
   if(source.note)assert.ok(article.includes(encode(source.note)),view.id+' '+source.note);
  }
  if(view.assets.some(id=>cityAssets.has(id)))assert.match(article,/City of Mississauga data terms/);
  assert.ok(article.includes('href="model.html?model='+view.id+'"'),view.id);
 }
 assert.match(credits,/OCTOBER 2026 RELEASE NOTICES/);
});

test('image, document, film and credit downloads remain available',async()=>{
 const [review,reference,film,downloads,model,map,image,document]=await Promise.all([
  'review-renders.html','reference-updates.html','film.html','downloads.html','model.html','app.js','image-preview.js','document-preview.js'
 ].map(read));
 assert.match(review,/\.pdf["']/);assert.match(review,/\.png["']/);
 assert.match(reference,/Download PNG/);
 const filmSource=film.match(/<source\b[^>]*src="([^"]+\.mp4)"/)?.[1];
 assert.ok(filmSource);
 assert.doesNotMatch(film,/<a\b[^>]*href="[^"]+\.mp4"[^>]*>/);
 assert.ok([...downloads.matchAll(/<a\b[^>]+>/g)].some(([tag])=>tag.includes('href="'+filmSource+'"')&&/\sdownload(?:\s|=|>)/.test(tag)));
 assert.match(model,/href="downloads\/Model-study-credits\.txt" download/);
 assert.match(map,/download\.textContent='Download PNG'/);
 assert.match(image,/download\.download=/);
 assert.match(document,/Download PDF/);
});
