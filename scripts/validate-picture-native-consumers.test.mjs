import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,symlink,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCleanMedia} from '../public/clean-media.js';
import {validatePictureMedia,validateRefinedPictureStructure,validateNativeSocialCard,validateNativeSharePreviews} from './validate-picture-media.mjs';

const site=fileURLToPath(new URL('../public/',import.meta.url));
const json=async path=>JSON.parse(await readFile(join(site,path),'utf8'));
const native=await json('data/native-media-20261102.json');
const rows=native.images.map(row=>normalizeCleanMedia(row,'https://futuremississauga.com/'));
const page=await readFile(join(site,'social.html'),'utf8');
const cards=page.match(/<article\b[\s\S]*?<\/article>/g);

test('the build validates all current native cards and retained historical image proofs',async()=>{
 const result=await validatePictureMedia(site);
 assert.equal(result.entries.length,33);assert.equal(result.portraitGallery.nativePortraitRecords,24);
 assert.equal(result.publicationEvidence,'PUBLISHER_PUBLIC_BYTE_PROOF_VERIFIED');
});

test('current card validation rejects stale pixels, crossed actions, dimensions and duplicate cards',()=>{
 const row=rows.find(row=>row.identity==='portraits/downtown-landmark-future.png');
 const card=validateNativeSocialCard(cards,row);
 const corruptions=[
  card.replace(row.preview.url,'gallery/old-thumbnail.avif'),
  card.replace('class="image-link" href="'+row.displayMaster.url,'class="image-link" href="'+row.download.url),
  card.replace('class="save" href="'+row.download.url,'class="save" href="'+row.displayMaster.url),
  card.replace(' download aria-label=',' aria-label='),
  card.replace('class="image-link"','download class="image-link"'),
  card.replace('data-display-width="3240"','data-display-width="1200"'),
  card.replace('data-osm="true"','data-osm="false"'),
  card.replace('href="https://www.openstreetmap.org/copyright"','href="sources.html"'),
 ];
 for(const changed of corruptions)assert.throws(()=>validateNativeSocialCard([changed],row));
 assert.throws(()=>validateNativeSocialCard([card,card],row),/Exactly one/);
});

test('current source credits remain required for Clarkson and Lakeview',()=>{
 for(const [identity,credit] of [
  ['portraits/clarkson-future.png','Massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario.'],
  ['portraits/lakeview-future.png','Contains information licensed under the Open Government Licence – Ontario.'],
 ]){
  const row=rows.find(row=>row.identity===identity),card=validateNativeSocialCard(cards,row);
  assert.throws(()=>validateNativeSocialCard([card.replace(credit,'')],row),/required model credit/);
 }
});

test('share metadata must use the exact current native JPEG for both services',async()=>{
 const row=rows.find(row=>row.identity==='wide/downtown-future.png');
 const old=await json('data/share-preview-20261101.json');
 await assert.rejects(validateNativeSharePreviews(site,[page.replace(/<meta property="og:image" content="[^"]+"/,'<meta property="og:image" content="https://futuremississauga.com/'+old.url+'"')],row));
 await assert.rejects(validateNativeSharePreviews(site,[page.replace(/<meta name="twitter:image"[^>]+>/,'')],row),/share metadata/);
});

test('homepage share uses the exact presentation JPEG while other pages retain the native edition',async()=>{
 const home=await readFile(join(site,'index.html'),'utf8'),explore=await readFile(join(site,'explore.html'),'utf8');
 const original=rows.find(row=>row.identity==='wide/downtown-future.png');
 const revision=await json('data/presentation-media-20261109.json');
 const revised=normalizeCleanMedia(revision.images.find(row=>row.identity==='wide/downtown-future.png'),'https://futuremississauga.com/');
 const options={edition:'revision-20261109'};
 await validateNativeSharePreviews(site,[home],revised,options);
 await validateNativeSharePreviews(site,[page,explore],original);
 await assert.rejects(validateNativeSharePreviews(site,[home],original));
 await assert.rejects(validateNativeSharePreviews(site,[page,explore],revised,options));
 for(const change of [
  row=>{row.displayMaster.sha256='0'.repeat(64);},
  row=>{row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200).bytes++;},
  row=>{row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200).height++;},
  row=>{row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200).sha256='0'.repeat(64);},
  row=>{row.responsivePreviews.find(a=>a.format==='image/jpeg'&&a.width===1200).url='https://example.com/other.jpg';},
 ]){const changed=structuredClone(revised);change(changed);await assert.rejects(validateNativeSharePreviews(site,[home],changed,options));}
 await assert.rejects(validateNativeSharePreviews(site,[home.replace('property="og:image:height" content="750"','property="og:image:height" content="800"')],revised,options),/metadata height/);
});

async function changedData(name,mutate,check){
 const temporary=await mkdtemp(join(tmpdir(),'fm-native-validator-'));
 try{
  for(const entry of await readdir(site))if(entry!=='data')await symlink(join(site,entry),join(temporary,entry));
  await mkdir(join(temporary,'data'));
  for(const entry of await readdir(join(site,'data')))if(entry!==name)await symlink(join(site,'data',entry),join(temporary,'data',entry));
  const value=await json('data/'+name);mutate(value);await writeFile(join(temporary,'data',name),JSON.stringify(value));
  await check(temporary);
 }finally{await rm(temporary,{recursive:true,force:true});}
}

test('the current catalogue must retain every logical identity exactly once',async()=>{
 await changedData('native-media-20261102.json',value=>value.images.pop(),path=>assert.rejects(validateRefinedPictureStructure(path),/historical 57 logical views/));
});

test('native consumers do not bypass the historical source-attribution guard',async()=>{
 await changedData('refined-media-manifest.json',value=>{value.entries[0].sourceAttribution.openStreetMap=!value.entries[0].sourceAttribution.openStreetMap;},path=>assert.rejects(validateRefinedPictureStructure(path),/Expected values to be strictly deep-equal/));
});
