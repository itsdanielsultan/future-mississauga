import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pictureProvenance} from '../public/image-provenance.js';

const read=path=>fs.readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const pictures=JSON.parse(read('data/picture-assets.json'));
const districts=JSON.parse(read('data/districts.json'));
const catalog=JSON.parse(read('data/labelled-image-assets.json'));

// Exercise the gallery's real event handlers and view configuration for every
// supplied picture, including views reachable only through the selector.
test('every gallery image opens with its title, date, PNG details and exact actions',async()=>{
  const source=read('gallery.js'),shows=[],controls=new Map();let buttons,views=[],changeView;
  const control=id=>{
    if(!controls.has(id))controls.set(id,{innerHTML:'',style:{},addEventListener(){},insertAdjacentHTML(_position,html){this.innerHTML+=html;}});
    return controls.get(id);
  };
  const preview={show(info){shows.push(info);},setViews(items,_selected,callback){views=items;changeView=callback;}};
  const document={querySelector:control,querySelectorAll(selector){
    assert.equal(selector,'[data-open]');
    const markup=read('index.html')+control('#galleryGrid').innerHTML+control('#perspectiveGrid').innerHTML;
    buttons=[...markup.matchAll(/<button\b([^>]*\bdata-open="[^"]+"[^>]*)>/g)].map(match=>({dataset:{open:match[1].match(/data-open="([^"]+)"/)[1],view:match[1].match(/data-view="([^"]+)"/)?.[1]}}));
    return buttons;
  }};
  await vm.runInNewContext('(async()=>{'+source.replace(/^import .*;\n/gm,'')+'})()',{
    document,pictureProvenance,fetch:async path=>({json:async()=>structuredClone(path.includes('picture-assets')?pictures:districts)}),
    refreshPictureAssets:async value=>value,createImagePreview:()=>preview,bindComparison(){}
  });
  assert.ok(buttons.length>15);
  for(const button of buttons){button.onclick();for(const item of views)changeView(item.value);}
  const imagesByURL=new Map(Object.entries(pictures.images).map(([file,row])=>[row.url,{file,row}]));
  assert.equal(new Set(shows.map(info=>info.download)).size,imagesByURL.size,'all catalogue pictures must be reachable');
  for(const info of shows){
    const {file,row}=imagesByURL.get(info.download);
    assert.ok(info.title,file);assert.equal(info.src,row.displayMaster.url,file);assert.equal(info.preview,row.display.url,file);
    assert.equal(info.meta,pictureProvenance(row.renderInfo,row.width).meta,file);
    assert.match(info.meta,/Rendered \d+ \w+ 2026 · \dK PNG/,file);
    assert.equal(info.width,row.width,file);assert.equal(info.height,row.height,file);
    assert.ok(districts.some(d=>d.name===info.title&&info.explore==='explore.html?district='+d.id),file);
    for(const removed of ['description','sourceEdition','notice','notes'])assert.equal(Object.hasOwn(info,removed),false,file+': '+removed);
  }
  for(const id of ['#galleryGrid','#perspectiveGrid'])assert.doesNotMatch(control(id).innerHTML,/<p\b|earlier|model version/i,id);
});

test('all wide, portrait and current Citywide display metadata contains only the actual image date and resolution',()=>{
  const current=JSON.parse(read('data/citywide-media-20261028.json')).image;
  for(const row of [...catalog.images,current]){
    const original=JSON.stringify(row),shown=pictureProvenance(row.renderInfo,row.download.width);
    assert.deepEqual(Object.keys(shown),['meta'],row.file);
    assert.match(shown.meta,/Rendered \d+ \w+ 2026 · \dK PNG/,row.file);
    assert.doesNotMatch(shown.meta,/source|model|earlier|change/i,row.file);
    assert.equal(JSON.stringify(row),original,'source metadata must remain intact');
  }
});

test('the shared dialog removes the caption and disclosure elements and their layout wrappers',()=>{
  const source=read('image-preview.js'),css=read('usability.css');
  assert.doesNotMatch(source,/About this image|media-preview__(?:details|description|edition|notice|notes)|info\.(?:description|sourceEdition|notice|notes)/);
  assert.doesNotMatch(css,/media-preview__(?:details|description|edition|notice|notes)/);
  for(const preserved of ['media-preview__meta','media-preview__view','aria-label="Close picture"','media-preview__download','media-preview__explore','Sources &amp; credits'])assert.ok(source.includes(preserved),preserved);
  assert.match(source,/opener\?\.focus\(\{preventScroll:true\}\)/,'close returns focus');
  assert.match(source,/e\.key!==\x27Tab\x27/,'keyboard focus stays inside the open dialog');
});


test('the home gallery has no residual generic version notice or image-limit disclosures',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/pictureDateNote|Three Clarkson views|retain their earlier editions|About this view|Dates and model limits|About this comparison/i);
  assert.match(html,/id="galleryGrid"/);assert.match(html,/id="perspectiveGrid"/);assert.match(html,/id="pictureCompare"/);
});


test('the city viewer has no generic district subtitle or filler fallback',()=>{
 const html=read('explore.html'),app=read('app.js');
 assert.doesNotMatch(html+app,/districtNote|From parking lots to a connected downtown|A waterfront village with a growing new edge|Explore the changing city/);
 assert.doesNotMatch(app,/const notes=\{citywide:/);
 assert.match(html,/id="districtTitle"/);assert.match(html,/id="viewerInstructions"/);assert.match(html,/id="contextNote"/);
});
