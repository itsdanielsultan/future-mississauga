import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {assetURL} from '../public/asset-delivery.js';
import {pictureProvenance} from '../public/image-provenance.js';
import {mediaPreviewInfo,comparisonPair} from '../public/clean-media.js';
import {buildGalleryCatalogue,filterGallery,galleryViews} from '../public/gallery-catalogue.js';

const read=path=>fs.readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
const pictures=JSON.parse(read('data/picture-assets.json'));
const districts=JSON.parse(read('data/districts.json'));
const catalog=JSON.parse(read('data/labelled-image-assets.json'));

test('the finite gallery keeps every supplied image reachable with accurate view identities and original actions',()=>{
  const rows=buildGalleryCatalogue(districts,pictures.images);
  assert.deepEqual(new Set(rows.map(row=>row.file)),new Set(Object.keys(pictures.images)));
  assert.equal(filterGallery(rows).visible.length,rows.length);
  for(const entry of rows){
    const row=pictures.images[entry.file],info=mediaPreviewInfo({...row,viewTitle:entry.viewTitle,area:entry.area});
    assert.equal(info.src,row.displayMaster.url,entry.file);
    assert.equal(info.download,row.download.url,entry.file);
    assert.match(info.meta,/Rendered \d+ \w+ 2026 · \dK PNG/,entry.file);
    assert.equal(entry.area,districts.find(d=>d.id===entry.district).name);
    assert.equal(entry.file,entry.district+galleryViews[entry.view].suffix);
  }
  assert.equal(rows.find(row=>row.view==='landmark').viewTitle,'Absolute World');
  assert.equal(rows.find(row=>row.view==='junction').viewTitle,'City Centre interchange');
});

test('gallery filters reveal every match from the whole collection and handle empty results',()=>{
 const rows=buildGalleryCatalogue(districts,pictures.images);
 const downtown=filterGallery(rows,{area:'downtown'});
 assert(downtown.visible.length>6);assert.equal(downtown.hasMore,false);
 assert(downtown.visible.every(row=>row.district==='downtown'));
 assert.equal(filterGallery(rows,{search:'absolute world'}).visible[0].view,'landmark');
 assert(filterGallery(rows,{view:'close'}).visible.every(row=>row.type==='close'));
 assert.equal(filterGallery(rows,{search:'not a real place'}).visible.length,0);
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
  for(const preserved of ['media-preview__meta','media-preview__view','aria-label="Close picture"','media-preview__download','media-preview__explore','media-preview__credits'])assert.ok(source.includes(preserved),preserved);
  assert.match(source,/opener\?\.focus\(\{preventScroll:true\}\)/,'close returns focus');
  assert.match(source,/e\.key!==\x27Tab\x27/,'keyboard focus stays inside the open dialog');
});


test('the home gallery has no residual generic version notice or image-limit disclosures',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/pictureDateNote|Three Clarkson views|retain their earlier editions|About this view|Dates and model limits|About this comparison/i);
  assert.match(html,/href="gallery.html"/);assert.match(read('gallery.html'),/id="galleryGrid"/);assert.match(read('gallery.html'),/id="perspectives"/);assert.match(read('compare.html'),/id="pictureCompare"/);
});


test('the city viewer has no generic district subtitle or filler fallback',()=>{
 const html=read('explore.html'),app=read('app.js');
 assert.doesNotMatch(html+app,/districtNote|From parking lots to a connected downtown|A waterfront village with a growing new edge|Explore the changing city/);
 assert.doesNotMatch(app,/const notes=\{citywide:/);
 assert.match(html,/id="districtTitle"/);assert.match(html,/id="viewerInstructions"/);assert.match(html,/id="contextNote"/);
});
