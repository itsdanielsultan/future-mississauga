import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {buildingMapProfiles} from '../public/building-map-profiles.js';
const root=new URL('../public/',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const catalogue=JSON.parse(read('data/building-catalogue.json')).entries;
const features=JSON.parse(read('data/building-features.json'));
test('featured buildings open individual pages with a verified location, real-world view and sourced roles',()=>{
  const cards = new Map([...read('model.html').matchAll(/<article class="building-card" data-building="([^"]+)"[\s\S]*?<\/article>/g)].map(match=>[match[1],match[0]]));
  for(const [id,feature] of Object.entries(features)){
    const entry=catalogue.find(row=>row.id===id);
    assert(entry && entry.image, id);
    assert(!['city-massing','project-model','site-location','neighbourhood'].includes(entry.imageKind),id);
    const page=read('building-'+id+'.html');
    assert(page.includes('<h1>')&&page.includes('id="realTitle"')&&page.includes('id="teamTitle"'),id);
    for(const [markup,picture] of [[page,feature.displayImage],[cards.get(id),feature.cardImage]]){
      const tag=[...markup.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]).find(image=>image.includes('src="'+picture.url+'"'));
      assert(tag,id+' shows its registered authored model');
      assert(tag.includes('width="'+picture.width+'"')&&tag.includes('height="'+picture.height+'"'),id+' uses the model image aspect ratio');
    }
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
  const gallery=read('gallery.html');
  const selector=gallery.match(/<select\b[^>]*id="galleryArea"[^>]*>([\s\S]*?)<\/select>/)[1];
  const options=[...selector.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)];
  const showPlace=read('gallery.js').match(/function showPlace\(\) \{[\s\S]*?\n\}/)[0];
  const available=new Set(catalogue.filter(row=>features[row.id]).map(row=>row.areaId));
  const registered=gallery.match(/<a id="placeBuildings" data-areas="([^"]+)"/)[1];
  assert.deepEqual(registered.split(' ').sort(),[...available].sort());
  for(const [,id,title] of options){
    const name=title.replaceAll('&amp;','&');
    const controls=new Map();
    const $=key=>{
      if(!controls.has(key))controls.set(key,{dataset:{areas:registered}});
      return controls.get(key);
    };
    vm.runInNewContext(showPlace+';showPlace()',{$,area:{value:id,selectedOptions:[{textContent:name}]}});
    assert.equal($('#galleryTitle').textContent,id==='all'?'Image gallery':name);
    if(id==='all')continue;
    assert.equal($('#placeMap').href,'explore.html?district='+encodeURIComponent(id));
    assert.equal($('#placeBuildings').hidden,!available.has(id));
    if(available.has(id))assert.equal($('#placeBuildings').href,'model.html?area='+encodeURIComponent(name));
  }
  const directory = read('model.html');
  const included = [...directory.matchAll(/data-building="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(included.sort(), Object.keys(features).sort());
  assert(!directory.includes('id="showAllBuildings"'));
  assert(!features['fairview-neighbourhood']&&!features['port-credit-marina']);
  assert.match(read('reference-updates.html'),/id="rise-at-stride"[^>]*data-archive-study hidden/);
});

test('every published study has an illustrated directory link and an addressable detail page',()=>{
  for(const [file,sectionClass] of [['review-renders.html','render-project'],['reference-updates.html','model-change']]){
    const html=read(file);
    const sections=[...html.matchAll(new RegExp('<section class="'+sectionClass+'" id="([^"]+)"([^>]*)>','g'))]
      .filter(match=>!match[2].includes('data-archive-study')).map(match=>match[1]);
    const cards=[...html.matchAll(/<a data-study-link="([^"]+)"[^>]*href="#([^"]+)"[^>]*><img src="([^"]+)"/g)];
    assert.deepEqual(cards.map(card=>card[1]).sort(),sections.sort(),file);
    for(const [,id,anchor,image] of cards){
      assert.equal(id,anchor);
      assert(existsSync(new URL(image,root)),image);
      if(sectionClass==='render-project') assert(features[id],id+' needs a building profile');
    }
    assert(!html.includes('About the studies'));
  }
});

test('Superior belongs to its local directory and uses the citywide scene that contains its model',()=>{
  const entry=catalogue.find(row=>row.id==='ergocentric-275-superior');
  assert.equal(entry.area,'Heartland & Gateway');
  assert(entry.links.find(link=>link.kind==='city').url.includes('district=citywide'));
  assert(!read('model.html').includes('David Lasker'));
  const detail=read('building-ergocentric-275-superior.html');
  const caption=detail.match(/<figcaption>(.*?)<\/figcaption>/s)[1];
  assert.match(caption,/Photograph reference by <a[^>]*>[^<]*David Lasker/);
  assert.match(caption,/roof follow the City/);
  assert(!/<dt>[^<]*photographer/i.test(detail));
});
