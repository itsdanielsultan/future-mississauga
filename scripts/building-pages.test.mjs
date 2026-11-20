import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {buildingMapProfiles} from '../public/building-map-profiles.js';
const root=new URL('../public/',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const catalogue=JSON.parse(read('data/building-catalogue.json')).entries;
const features=JSON.parse(read('data/building-features.json'));
test('featured buildings open individual pages with a verified location, real-world view and sourced roles',()=>{
  for(const [id,feature] of Object.entries(features)){
    const entry=catalogue.find(row=>row.id===id);
    assert(entry && entry.image, id);
    assert(!['city-massing','project-model','site-location','neighbourhood'].includes(entry.imageKind),id);
    const page=read('building-'+id+'.html');
    assert(page.includes('<h1>')&&page.includes('id="realTitle"')&&page.includes('id="teamTitle"'),id);
    assert(feature.place?.query && feature.place?.source && feature.photoPage?.url,id);
    assert(page.includes('https://www.google.com/maps/search/?') && page.includes('https://maps.apple.com/?'),id);
    for(const photo of feature.photos||[]){
      assert(photo.credit && photo.source && photo.licence && photo.licenceURL,id);
      if(!/^https?:/.test(photo.url))assert(existsSync(new URL(photo.url,root)),photo.url);
    }
    const profileLinks=(buildingMapProfiles[id==='mcity-m5'?'mcity-5':entry.projectId]||[]).map(row=>row[0]);
    assert(profileLinks.includes(id) || (['mcity-m1','mcity-m2'].includes(id) && profileLinks.includes('mcity-pair')),id);
  }
});
test('gallery returns to the same district and the directory has an explicit showcase boundary',()=>{
  assert.match(read('gallery.js'),/galleryTitle.*?district\.name/);
  const directory = read('model.html');
  const included = [...directory.matchAll(/data-building="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(included.sort(), Object.keys(features).sort());
  assert(!directory.includes('id="showAllBuildings"'));
  assert(!features['fairview-neighbourhood']&&!features['port-credit-marina']);
  assert.match(read('reference-updates.html'),/id="rise-at-stride"[^>]*data-archive-study hidden/);
});
