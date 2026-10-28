import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {studyImagePreview} from '../public/neighbourhood-media.js';
import {cityMapLinkForSection} from '../public/image-provenance.js';
import {CITY_DATA_TERMS_URL} from '../public/city-data-terms.js';

const root=new URL('../public/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('data/ergocentric-media.json',root)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='https://futuremississauga.com/reference-updates.html';
const html=fs.readFileSync(new URL('reference-updates.html',root),'utf8');
const section=html.match(/<section class="model-change" id="ergocentric-275-superior">[\s\S]*?<\/section>/)?.[0];

test('only the approved credited frontage PNGs are public, with exact dimensions and byte pins',()=>{
  const expected={before:'202359a6313abb18f011a6d49c08646d06b31ce65e7ae420a5bc50c11bad4d0d',after:'a8cf3366ea6dd27e8219c80f265fda1cc684396bfb48c424826fa2adf8abc5fd'};
  assert.deepEqual(fs.readdirSync(new URL('assets/ergocentric-20261028/',root)).sort(),['275-Superior-frontage-after.png','275-Superior-frontage-before.png']);
  assert.equal(manifest.images.length,2);
  for(const row of manifest.images){
    const bytes=fs.readFileSync(new URL(row.url,root));
    assert.equal(sha(bytes),expected[row.role]);assert.equal(row.sha256,expected[row.role]);assert.equal(row.bytes,bytes.length);
    assert.equal(row.width,1800);assert.equal(row.height,1348);
    assert.equal(bytes.readUInt32BE(16),row.width);assert.equal(bytes.readUInt32BE(20),row.height);
  }
  assert.equal(manifest.images[0].sourceModelSHA256,'bf875a9dc869bfe22727103a3e4658c3417acd43a109848867bc00a1dea5239a');
  assert.equal(manifest.images[1].sourceModelSHA256,'c3bf9ec74a0d8cf57fc96cb8230b1dc2f59cbacd9163c9deff3881adfb9f632e');
});

test('the study retains exact photography credit, link and City terms beside the views',()=>{
  assert.ok(section);assert.match(section,/Photography reference: <a href="https:\/\/davidlaskerphotography\.com\/">David Lasker\/Cityscape Photography<\/a>/);
  assert.ok(section.includes(CITY_DATA_TERMS_URL));assert.equal(manifest.cityDataTermsURL,CITY_DATA_TERMS_URL);
  assert.match(section,/Model: Daniel Sultan \/ Future Mississauga/);
  assert.match(section,/<details class="reference-about">[\s\S]*photograph’s date is unknown[\s\S]*roof and rear remain unchanged/);
  assert.equal((section.match(/class="file-download"/g)||[]).length,2);
  for(const row of manifest.images){assert.ok(section.includes('<a href="'+row.url+'"><div'));assert.ok(section.includes('href="'+row.url+'" download data-download'));}
});

test('275 Superior reflects the corrected scope without a static-only claim or public reference photo',()=>{
  assert.equal(manifest.originalPhotographPublic,false);
  assert.equal(manifest.scopeDecisionSHA256,'b9033f35f87d1bd9a3c3a668a46ae066a59c84921452592d7b4eb385f7607324');
  assert.doesNotMatch(section+JSON.stringify(manifest),/Static image study|static-only|not added to the interactive|no source photograph, interactive viewer/i);
  for(const row of manifest.images){
    const preview=studyImagePreview(manifest,row.url,base);
    assert.match(preview.meta,/Updated 28 Oct 2026/);assert.doesNotMatch(preview.meta,/Rendered/);
    assert.equal(preview.sourceEdition,'Facade study');
    assert.equal(preview.src,row.url);assert.equal(preview.download,row.url);
  }
  assert.ok(html.indexOf('id="fairview-neighbourhood"')<html.indexOf('id="ergocentric-275-superior"'));
  assert.ok(html.indexOf('id="ergocentric-275-superior"')<html.indexOf('id="sgm-maritz-6710"'));
});

test('275 Superior study and image previews open its exact Citywide model location',()=>{
  const hrefs=[...section.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
  const city='explore.html?district=citywide&project=ergocentric-275-superior';
  assert.ok(hrefs.includes('model.html?model=ergocentric-275-superior'));
  assert.equal(hrefs.filter(href=>href===city).length,1);
  assert.equal(cityMapLinkForSection({id:manifest.sectionId,querySelectorAll:()=>hrefs.map(href=>({getAttribute:()=>href}))},base),city);
  assert.doesNotMatch(section,/district=heartland/);
});
