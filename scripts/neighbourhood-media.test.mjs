import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {neighbourhoodPreview} from '../public/neighbourhood-media.js';

const root=new URL('../public/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('data/neighbourhood-media.json',root)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='https://futuremississauga.com/reference-updates.html';

test('Fairview publishes only the exact two approved clean comparison PNGs',()=>{
  const expected={before:'8bad7e1a8834dafe30b4527f0fe4de50c6f3473b5901a8bab3e4ac6f85db9f92',after:'47e4f43794d0ecd5c5611f01eb8fddd5a975a22aa972226d7f632c0361ceacd1'};
  assert.deepEqual(fs.readdirSync(new URL('assets/fairview-20261028/',root)).sort(),['neighbourhood-after.png','neighbourhood-before.png']);
  assert.deepEqual(manifest.images.map(row=>row.role),['before','after']);
  for(const row of manifest.images){
    const bytes=fs.readFileSync(new URL(row.url,root));
    assert.equal(sha(bytes),expected[row.role]);assert.equal(row.sha256,expected[row.role]);assert.equal(row.bytes,bytes.length);
    assert.equal(bytes.readUInt32BE(16),row.width);assert.equal(bytes.readUInt32BE(20),row.height);
    assert.equal(row.width,1800);assert.equal(row.height,1100);
  }
});

test('before and after bind the same base and ground, with the existing-home addition only in after',()=>{
  const sources=Object.fromEntries(manifest.sources.map(row=>[row.id,row.sha256]));
  assert.equal(sources.baseline,'d04be9339c14c9642f062590644ab41210d60d4aba08114bff6059d489f36d8e');
  assert.equal(sources.ground,'b651eb70905ff8ab20fee30aecbdf23db6ebc7a63e4dfa606fd4391b5037fa46');
  assert.equal(sources.addition,'f55d9fbad30e7392cab90928c181e2404602cbc640098dcb6c44de33f7a0cdb2');
  assert.deepEqual(manifest.images[0].sourceModelSHA256s,[sources.baseline,sources.ground]);
  assert.deepEqual(manifest.images[1].sourceModelSHA256s,[sources.baseline,sources.ground,sources.addition]);
  assert.equal(manifest.images[0].additionVisible,false);assert.equal(manifest.images[1].additionVisible,true);
  assert.equal(manifest.geometryMutation,false);
  assert.equal(manifest.renderScope.runtimeVegetationOverlays,false);assert.equal(manifest.renderScope.runtimeDetailedBuildingOverlays,false);
  assert.equal(manifest.sourceAttribution.openStreetMap,false);
  assert.match(manifest.renderProofSHA256,/^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.matchedPresentation.cameraPositionBlender,[-380,-700,535]);
  assert.deepEqual(manifest.matchedPresentation.lightFrom,[-850,-420,380]);
});

test('Fairview preview reports the study update and varying source dates without inventing a render date',()=>{
  assert.equal(manifest.renderDate,null);assert.equal(manifest.sourceGeometryDate,null);
  for(const row of manifest.images){
    const preview=neighbourhoodPreview(manifest,row.url,base);
    assert.match(preview.meta,/Updated 28 Oct 2026/);assert.doesNotMatch(preview.meta,/Rendered/);
    assert.equal(preview.sourceEdition,'Source geometry dates vary.');assert.equal(preview.osm,false);
    assert.equal(preview.download,row.url);assert.equal(preview.src,row.url);
    assert.match(preview.description,/Existing homes.*added.*Citywide model/);
    assert.equal(neighbourhoodPreview(manifest,'https://other.example/'+row.url,base),null);
  }
  assert.equal(neighbourhoodPreview(manifest,'assets/other-study.png',base),null);
  assert.equal(neighbourhoodPreview(null,manifest.images[0].url,base),null);
});

test('the Fairview study offers previews and separate download icons and opens the exact neighbourhood',()=>{
  const html=fs.readFileSync(new URL('reference-updates.html',root),'utf8');
  const section=html.match(/<section class="model-change" id="fairview-neighbourhood"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);assert.match(section,/data-preview-explore="explore.html\?district=citywide&amp;context=fairview"/);
  assert.equal((section.match(/class="file-download"/g)||[]).length,2);
  assert.equal((section.match(/<img /g)||[]).length,2);
  for(const row of manifest.images){
    assert.ok(section.includes('<a href="'+row.url+'"><div class="image-frame"><img'));
    assert.ok(section.includes('href="'+row.url+'" download data-download'));
  }
  assert.doesNotMatch(section,/project=edge-oro|render-proof|SHA256|275|OpenStreetMap|vegetation overlays/);
});
