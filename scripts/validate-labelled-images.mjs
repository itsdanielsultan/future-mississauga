import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const load=async(root,name)=>JSON.parse(await readFile(join(root,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function validateLabelledImages(root,{structureOnly=false}={}){
 const raw=await readFile(join(root,'data/labelled-image-assets.json'));
 const manifest=JSON.parse(raw),wide=(await load(root,'data/picture-assets.json')).images,portrait=(await load(root,'data/social-pictures.json')).images;
 const districts=await load(root,'data/districts.json');
 assert.equal(manifest.schema,'future-mississauga-labelled-images/v1');assert.equal(manifest.targetCommit,'c585aa0023aa53b8d1da1fe033073c00580a055f');assert(!manifest.stagingOnly);
 assert.equal(manifest.imageCount,57);assert.equal(manifest.images.length,57);assert.equal(new Set(manifest.images.map(r=>r.kind+'/'+r.file)).size,57);
 const assets=new Map();let cleared=0;
 function asset(a,tag){
  assert(/^[a-z0-9-]+\.(png|avif|jpg)$/.test(a.file));assert.equal(a.url,'https://github.com/itsdanielsultan/future-mississauga/releases/download/'+tag+'/'+a.file);
  assert(/^[0-9a-f]{64}$/.test(a.sha256));assert(a.bytes>0&&a.bytes<100000000);assert(a.width>0&&a.height>0);
  if(assets.has(a.url)){const previous=assets.get(a.url);for(const key of ['width','height','bytes','sha256'])assert.equal(a[key],previous[key]);}else assets.set(a.url,a);
 }
 for(const r of manifest.images){
  assert(['wide','portraits'].includes(r.kind));const original=r.kind==='wide'?wide[r.file]:portrait.find(p=>p.file===r.file);assert(original);
  const preview=r.kind==='wide'?original.display.url:original.preview;
  assert.deepEqual(r.aliases.slice(0,3),[preview,original.displayMaster.url,original.url]);assert.equal(r.aliases.length,4);assert(r.aliases[3].startsWith('https://github.com/itsdanielsultan/future-mississauga/releases/download/pictures-labelled-'));assert.deepEqual(r.renderInfo,original.renderInfo);assert.deepEqual(r.sourceAttribution,original.sourceAttribution);
  const district=r.renderInfo.renderKey.split('/')[1];assert.equal(r.title,districts.find(d=>d.id===district).name);assert.equal(r.area,r.title);
  for(const a of [r.displayMaster,r.download]){
   asset(a,manifest.releaseTags[r.kind]);assert.equal(a.format,'image/png');assert.equal(a.width,original.displayMaster.width);assert.equal(a.height,original.displayMaster.height);assert.equal(a.sourceSHA256,original.displayMaster.nativeSourceSHA256);assert.notEqual(a.sha256,original.displayMaster.sha256);
  }
  if(!r.sourceAttribution.openStreetMap){cleared++;assert.equal(r.displayMaster.sha256,r.download.sha256);assert.equal(r.displayMaster.url,r.download.url);}
  for(const [tier,w] of [['preview',r.kind==='wide'?1200:810],['responsive',r.kind==='wide'?3200:1620]]){
   const a=r[tier];asset(a,manifest.releaseTags.previews);assert.equal(a.format,'image/avif');assert.equal(a.width,w);assert.equal(a.height,Math.round(r.displayMaster.height*w/r.displayMaster.width));assert.equal(a.sourceSHA256,r.displayMaster.sha256);assert.equal(a.quality,72);assert.equal(a.chroma,'4:4:4');
  }
 }
 assert.equal(cleared,9);const og=manifest.sharePreview;asset(og,manifest.releaseTags.previews);assert.equal(og.format,'image/jpeg');assert.equal(og.width,1200);assert.equal(og.height,750);assert.equal(og.sourceSHA256,manifest.images.find(r=>r.kind==='wide'&&r.file==='downtown-future.png').displayMaster.sha256);
 assert.equal(manifest.assetCount,220);assert.equal(assets.size,220);
 assert(!/\/Users\/|\/private\/|file:\/\/|\/var\/|\/tmp\//.test(JSON.stringify(manifest)));
 if(!structureOnly){
  const proof=await load(root,'data/labelled-media-integrity.json');
  assert.equal(proof.schema,'future-mississauga-labelled-public-byte-proof/v1');assert.equal(proof.status,'PASS');assert.equal(proof.manifestSHA256,sha(raw));
  assert.equal(proof.assets.length,220);assert.equal(new Set(proof.assets.map(a=>a.url)).size,220);
  for(const a of assets.values()){const p=proof.assets.find(p=>p.url===a.url);assert(p&&p.publicHTTPVerified&&p.published);for(const key of ['url','bytes','sha256','width','height'])assert.equal(p[key],a[key]);}
 }
 return {labelledViews:57,nativePNGs:105,smallAVIFs:57,highDensityAVIFs:57,sharePreviewJPEG:1,sourceClearViews:9,originalMastersPreserved:true,publicBytesVerified:!structureOnly};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await validateLabelledImages(resolve(process.argv[2]||'public'),{structureOnly:process.argv.includes('--structure-only')}),null,2));
