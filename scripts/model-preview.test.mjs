import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {selectPreview,verifiedModelBytes,trustedModelURL} from '../public/model-preview-loading.js';
import {projectDetailsHTML} from '../public/project-cards.js';
import {CITY_DATA_TERMS_URL} from '../public/city-data-terms.js';
const root=new URL('../public/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('data/model-previews.json',root),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const assetFile=a=>a.repositoryFile?new URL('../'+a.repositoryFile,import.meta.url):new URL(a.url,root);

test('Preview routes select only exact registered IDs',()=>{
  for(const id of ['artform','mcity-m1','mcity-m2','mcity-pair'])assert.equal(selectPreview(manifest,id)?.id,id);
  for(const id of [null,'','ARTFORM','../../models/other','mcity-m1?download=1','__proto__'])assert.equal(selectPreview(manifest,id),null);
  assert.deepEqual(selectPreview(manifest,'artform').assets,['artform']);
  assert.deepEqual(selectPreview(manifest,'mcity-pair').assets,['mcity-m1','mcity-m2']);
});

test('Every download decodes to its pinned GLB and only reachable model geometry',async()=>{
  for(const asset of manifest.assets){
    const encoded=await readFile(assetFile(asset));
    assert.equal(encoded.length,asset.bytes);assert.equal(sha(encoded),asset.downloadSHA256);
    const decoded=await verifiedModelBytes(asset,async()=>new Response(encoded));
    assert.equal(sha(decoded),asset.sha256);assert.equal(decoded.length,asset.decodedBytes);
    const bytes=Buffer.from(decoded), json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.equal(json.images?.length||0,0);assert.equal(json.animations?.length||0,0);assert.equal(json.skins?.length||0,0);
    assert.equal(json.buffers.length,1);assert.equal(json.buffers[0].uri,undefined);
    const reachable=new Set();const walk=i=>{assert(!reachable.has(i));reachable.add(i);for(const c of json.nodes[i].children||[])walk(c);};
    for(const i of json.scenes[json.scene||0].nodes)walk(i);
    assert.equal(reachable.size,json.nodes.length,asset.id+': unreferenced recovery nodes');
    assert.equal(json.meshes.length,asset.meshCount ?? (asset.id==='artform'?165:asset.id==='mcity-m1'?166:173));
  }
});

test('Artform download preserves the exact accepted Rev03 bytes',async()=>{
  const a=manifest.assets.find(a=>a.id==='artform');
  assert.equal(a.sha256,'8bcba67694f6f80553a505ca037fa5bbc3451d7cadd11c554b9221625c50964e');
  assert.equal(a.sourceArchiveSHA256,'2a4bfb61e489aecc0eca530a6b0bdd19621d36a01c049f3a677ed40a0be1a54c');
  assert.match(a.representation,/Local model coordinates/);
});

test('Decoded HTTP responses are accepted only with matching decoded bytes',async()=>{
  const a=manifest.assets[0],encoded=await readFile(new URL(a.url,root)),decoded=gunzipSync(encoded);
  assert.equal(sha(await verifiedModelBytes(a,async()=>new Response(decoded))),a.sha256);
  decoded[decoded.length-1]^=1;
  await assert.rejects(verifiedModelBytes(a,async()=>new Response(decoded)),/integrity/);
});

test('HTTP errors, corrupt archives and substituted assets fail closed',async()=>{
  const a=manifest.assets[0];
  await assert.rejects(verifiedModelBytes(a,async()=>new Response('',{status:404})),/downloaded/);
  const data=await readFile(new URL(a.url,root));data[100]^=1;
  await assert.rejects(verifiedModelBytes(a,async()=>new Response(data)),/integrity/);
  const other=await readFile(new URL(manifest.assets[1].url,root));
  await assert.rejects(verifiedModelBytes(a,async()=>new Response(other)),/integrity/);
});

test('Only corresponding project cards gain standalone preview links',()=>{
  assert.match(projectDetailsHTML({id:'artform',name:'Artform'}),/model.html\?model=artform/);
  assert.match(projectDetailsHTML({id:'mcity-1-2',name:'M City'}),/model.html\?model=mcity-pair/);
  assert.doesNotMatch(projectDetailsHTML({id:'unrelated',name:'Other'}),/model.html/);
});

test('Credits distinguish local Artform and interpreted M City geometry',()=>{
  const art=selectPreview(manifest,'artform');assert.match(art.credit,/Studio JCI/);assert.match(art.credit,/EMBLEM/);
  assert.match(art.limits,/not a surveyed placement/);assert.match(art.limits,/Zoning maxima are not measured/);
  for(const view of manifest.views){assert.match(view.rights,/endorsement/);assert.ok(view.sources.length);assert.match(view.subtitle,/Approximate/);}
});

test('City-derived previews require the verified City terms, independent Artform does not',async()=>{
  assert.equal(CITY_DATA_TERMS_URL,'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data');
  for(const id of ['mcity-m1','mcity-m2'])assert.equal(manifest.assets.find(a=>a.id===id).cityDataTerms,true);
  assert.equal(Boolean(manifest.assets.find(a=>a.id==='artform').cityDataTerms),false);
  const credits=await readFile(new URL('downloads/Model-study-credits.txt',root),'utf8');
  assert.ok(credits.includes(CITY_DATA_TERMS_URL));
  assert.match(credits,/require recipients to agree/);
});

test('Only approved repository commit pins and local model paths may be fetched',async()=>{
  for(const url of ['https://other.example/model.glb','https://raw.githubusercontent.com/itsdanielsultan/future-mississauga/main/model-assets/20261025/avia-1.glb.gz','models/../private.glb','/models/test.glb','models/test.glb?url=other']){
    assert.equal(trustedModelURL(url),false);
    await assert.rejects(verifiedModelBytes({url},()=>{throw new Error('must not fetch');}),/address is unavailable/);
  }
  for(const asset of manifest.assets)assert.equal(trustedModelURL(asset.url),true,asset.id);
});

test('The approved five models remain separate and Avia includes its shared podium',()=>{
  for(const id of ['edge-1','edge-2','oro']){
    const view=selectPreview(manifest,id);assert.deepEqual(view.assets,[id]);
    assert.equal(manifest.assets.find(a=>a.id===id).cityDataTerms,false);
  }
  for(const id of ['avia-1','avia-2']){
    const view=selectPreview(manifest,id);assert.deepEqual(view.assets,[id,'avia-podium']);
    assert.match(view.downloadNote,/both the tower and shared podium/);
    assert.match(view.summary,/other tower is omitted/);
    assert.ok(view.assets.every(id=>manifest.assets.find(a=>a.id===id).cityDataTerms));
  }
  assert.match(selectPreview(manifest,'oro').subtitle,/Intended July 2020/);
  assert.equal(selectPreview(manifest,'brightwater'),null);
  assert.equal(selectPreview(manifest,'mason'),null);
});
