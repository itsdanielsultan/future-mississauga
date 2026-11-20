import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {projectDetailsHTML} from '../public/project-cards.js';
import {selectPreview} from '../public/model-preview-loading.js';
const read=name=>JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url)));
const catalogue=read('model-previews'),projects=read('projects');
const previews=project=>[...projectDetailsHTML(project).matchAll(/href="model\.html\?model=([^"]+)"/g)].map(match=>match[1]);
test('M5 city card opens its released standalone subject view',()=>{
 const project=projects.find(project=>project.id==='mcity-5'),before=JSON.stringify(project),html=projectDetailsHTML(project);
 assert.deepEqual(previews(project),['mcity-m5']);
 assert.match(html,/<a href="model\.html\?model=mcity-m5">Open model preview →<\/a>/);
 assert.equal(JSON.stringify(project),before);assert.equal(selectPreview(catalogue,'mcity-m5').assets[0],'mcity-m5-v6');
});
test('every released standalone model is reachable from its city card without exposing held models',()=>{
 const covered=new Set(),routes=new Set();
 for(const project of projects)for(const id of previews(project)){
  const view=selectPreview(catalogue,id);assert(view,project.id+' resolves a released preview');routes.add(id);
  if(view.projectId)assert.equal(view.projectId,project.id,'subject route');
  for(const assetID of view.assets){const asset=catalogue.assets.find(asset=>asset.id===assetID);assert(asset,assetID);assert(existsSync(new URL(asset.repositoryFile?'../'+asset.repositoryFile:'../public/'+asset.url,import.meta.url)),assetID+' public model');covered.add(assetID);}
 }
 const allReleased=new Set(catalogue.views.flatMap(view=>view.assets));assert.deepEqual([...covered].sort(),[...allReleased].sort());
 assert.deepEqual([...routes].sort(),['artform','avia-1','avia-2','edge-1','edge-2','ergocentric-275-superior','harborn-50-60','mcity-m5','mcity-pair','oro','port-credit-26-park','sgm-maritz-6710','voya']);
 for(const id of ['panoramic','panoramic-tower','mcity-m6','mcity-m7','mcity-m8','unreleased-model'])assert.deepEqual(previews({id,name:id}),[]);
});
