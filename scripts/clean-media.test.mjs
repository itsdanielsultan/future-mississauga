import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ACTIVE_PICTURE_IDENTITIES,ACTIVE_NEIGHBOURHOOD_IDENTITIES,normalizeCleanMedia,mediaPreviewInfo,mediaScenarioLabel} from '../public/clean-media.js';
import {studyImagePreview} from '../public/neighbourhood-media.js';
import {renderImageAttribution,updateCleanImageCaption} from '../public/image-preview.js';

const pub=new URL('../public/',import.meta.url),base='https://futuremississauga.com/';
const read=file=>JSON.parse(fs.readFileSync(new URL(file,pub),'utf8'));
const history=read('data/labelled-image-assets.json');
const beforeFetch=globalThis.fetch;
globalThis.location={href:base,origin:new URL(base).origin};
globalThis.fetch=async()=>new Response(JSON.stringify(history));
const {mediaCatalog,indexMedia,integrateCurrentPictures,integrateCurrentNeighbourhoods,refreshCatalogPictures}=await import('../public/media-catalog.js?clean-v2-tests');
await mediaCatalog;globalThis.fetch=beforeFetch;

// Deliberately synthetic unit-test data. Never written as a public asset manifest.
function fixture(identity='wide/clarkson-future.png'){
 const folder='gallery/test-only/'+identity.replaceAll('/','-').replace('.png','');
 const asset=(name,width,height,digit,mimeType)=>({url:folder+'/'+name,dimensions:[width,height],bytes:100,sha256:digit.repeat(64),mimeType});
 const displayMaster={...asset('clean.png',3840,2400,'a','image/png'),role:'cleanNativeScene',captionBaked:false};
 const download={...asset('download.png',3840,2700,'b','image/png'),role:'nativeSceneWithAppendedCreditFooter',sceneDimensions:[3840,2400],sceneBounds:[0,0,3840,2400],footerBounds:[0,2400,3840,2700],sceneSourceSHA256:displayMaster.sha256,allScenePixelsExact:true,sceneCrop:false,sceneResize:false};
 const responsivePreviews=[1200,3200].flatMap((width,i)=>['image/avif','image/jpeg'].map((mimeType,j)=>({...asset('scene-'+width+(j?'.jpg':'.avif'),width,Math.round(2400*width/3840),String(i*2+j+1),mimeType),role:'responsivePreview',crop:false,captionBaked:false,lossyEncoding:true,resized:true,sourceSHA256:displayMaster.sha256})));
 const timestamp='2026-11-02T01:30:00.123456+00:00';
 const scene=history.images.find(row=>row.kind+'/'+row.file===identity);
 const area=scene?.area||(identity.startsWith('neighbourhood/')?'Fairview':'Clarkson'),scenario=identity.startsWith('neighbourhood/')?'existing':identity.match(/-(existing|construction|future)\.png$/)?.[1]||'future';
 const geographicScope=identity.startsWith('neighbourhood/')?'neighbourhood':identity==='wide/citywide-future.png'?'whole_municipality':'named_district_scene';
 const requiredModelCredits=identity==='wide/citywide-future.png'?['275 Superior Boulevard photo reference: David Lasker/Cityscape Photography · davidlaskerphotography.com']:area==='Clarkson'&&scenario==='future'?['Architectural massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario. Independent city placement and visualisation by Future Mississauga.']:[];
 return {schema:'future-mississauga-current-native-media/v2',identity,title:area,scenario,displayMaster,download,responsivePreviews,nativeSceneDimensions:[3840,2400],sourceFreezeState:'FINAL_FROZEN',sourceSceneSHA256:'f'.repeat(64),historicalURLsRebound:false,renderTimestampUTC:timestamp,
  caption:{title:area,area,creator:'Daniel Sultan',scenario,geographicScope,cityCredit:'City of Mississauga · Ontario data',openStreetMap:true,sourcesURL:base+'sources.html',requiredModelCredits,fullCredits:[],renderTimestampUTC:timestamp,sourceDates:'Mixed; source dates remain separate from the actual render timestamp.'}};
}

test('the clean-gallery allowlist is exactly the 57 active wide/social identities, with Fairview separate',()=>{
 assert.deepEqual([...ACTIVE_PICTURE_IDENTITIES].sort(),history.images.map(row=>row.kind+'/'+row.file).sort());
 assert.equal(ACTIVE_PICTURE_IDENTITIES.length,57);
 assert.deepEqual(ACTIVE_NEIGHBOURHOOD_IDENTITIES,['neighbourhood/fairview/before','neighbourhood/fairview/after']);
 for(const identity of ACTIVE_PICTURE_IDENTITIES)assert.equal(normalizeCleanMedia(fixture(identity),base).identity,identity);
 for(const identity of ['wide/east-credit-future.png','portraits/malton-future.png','wide/unknown.png','study/275-superior.png'])assert.throws(()=>normalizeCleanMedia(fixture(identity),base),/identity/);
 assert.throws(()=>normalizeCleanMedia(fixture(ACTIVE_NEIGHBOURHOOD_IDENTITIES[0]),base),/identity/);
});

test('clean master and appended download retain separate dimensions and exact scene proof',()=>{
 const input=fixture(),row=normalizeCleanMedia(input,base);
 assert.equal(row.displayMaster.height,2400);assert.equal(row.download.height,2700);
 assert.equal(row.cleanPresentation.sceneSourceSHA256,row.displayMaster.sha256);
 assert.deepEqual(row.cleanPresentation.footerBounds,[0,2400,3840,2700]);
 assert.equal(row.renderInfo.renderTimestampUTC,input.renderTimestampUTC);assert.equal(row.renderInfo.renderDate,'2026-11-01');
 const preview=mediaPreviewInfo(row);
 assert.equal(preview.src,input.displayMaster.url);assert.equal(preview.download,input.download.url);assert.equal(preview.height,2400);
 assert.equal(preview.meta,'Rendered 1 Nov 2026 · 4K PNG · 0.0 MB');assert.doesNotMatch(preview.meta,/Mixed|source dates|3840|2400/);assert.equal(mediaScenarioLabel(row),'Future scenario');
 assert.equal(preview.attribution.cityCredit,input.caption.cityCredit);assert.equal(preview.attribution.openStreetMap,true);
});

test('crop, upscaling, false equality, footer gaps/overlaps and mismatched hashes are rejected',()=>{
 for(const mutate of [
  x=>x.download.sceneBounds=[0,1,3840,2400],x=>x.download.footerBounds=[0,2399,3840,2700],x=>x.download.footerBounds=[0,2401,3840,2700],
  x=>x.download.footerBounds=[0,2400,3800,2700],x=>x.download.sceneDimensions=[3840,2300],x=>x.download.dimensions=[3840,2400],
  x=>x.nativeSceneDimensions=[1920,1200],x=>x.nativeSceneDimensions=[3840,2400,1],x=>x.displayMaster.captionBaked=true,x=>x.download.sceneCrop=true,x=>x.download.sceneResize=true,
  x=>x.download.allScenePixelsExact=false,x=>x.download.sceneSourceSHA256='e'.repeat(64),x=>x.download.url=x.displayMaster.url,
  x=>x.responsivePreviews[0].dimensions=[5000,3125],x=>x.responsivePreviews[0].dimensions=[1200,740],x=>x.responsivePreviews[0].sourceSHA256='e'.repeat(64),
  x=>x.responsivePreviews[0].crop=true,x=>x.responsivePreviews[0].captionBaked=true,x=>x.responsivePreviews[0].resized=false,x=>x.responsivePreviews.pop()
 ]){const input=fixture();mutate(input);assert.throws(()=>normalizeCleanMedia(input,base));}
});

test('small native scenes get proportional previews without upscaling',()=>{
 const input=fixture(ACTIVE_NEIGHBOURHOOD_IDENTITIES[0]);input.nativeSceneDimensions=[1800,1100];input.displayMaster.dimensions=[1800,1100];
 Object.assign(input.download,{dimensions:[1800,1300],sceneDimensions:[1800,1100],sceneBounds:[0,0,1800,1100],footerBounds:[0,1100,1800,1300]});
 for(const p of input.responsivePreviews){const width=p.dimensions[0]===1200?1200:1800;p.dimensions=[width,Math.round(1100*width/1800)];p.resized=width!==1800;}
 const row=normalizeCleanMedia(input,base,{neighbourhood:true});assert.equal(row.responsive.width,1800);assert.equal(row.responsive.height,1100);
});

test('unsafe captions, private URLs and missing mandatory photo-reference credit are rejected',()=>{
 const required='275 Superior Boulevard photo reference: David Lasker/Cityscape Photography · davidlaskerphotography.com';
 for(const mutate of [x=>x.caption.title='<img src=x>',x=>x.caption.requiredModelCredits=['/Users/private/photo.jpg'],x=>x.caption.requiredModelCredits=[{}],
  x=>x.caption.sourcesURL='javascript:alert(1)',x=>x.displayMaster.url='file:///Users/private/scene.png',x=>x.download.url='https://user:secret@example.com/a.png',
  x=>x.caption.area='Downtown',x=>x.caption.scenario=x.scenario='existing',x=>x.caption.geographicScope='whole_municipality',x=>x.caption.renderTimestampUTC='2020-01-01T00:00:00Z',x=>x.renderTimestampUTC='unknown',x=>x.caption.fullCredits=[required]]){
  const input=fixture();mutate(input);assert.throws(()=>normalizeCleanMedia(input,base));
 }
 const input=fixture();input.caption.fullCredits=[required];input.caption.requiredModelCredits.push(required);
 assert(mediaPreviewInfo(normalizeCleanMedia(input,base)).attribution.requiredModelCredits.includes(required));
});

test('logical area, scenario and whole-city scope cannot be relabelled by a caption',()=>{
 for(const identity of ACTIVE_PICTURE_IDENTITIES){
  const input=fixture(identity);input.caption.scenario=input.scenario=input.scenario==='future'?'existing':'future';
  assert.throws(()=>normalizeCleanMedia(input,base),/area and scenario/);
 }
 for(const mutate of [x=>x.caption.area='Central Mississauga',x=>x.caption.geographicScope='named_district_scene',x=>x.title=x.caption.title='Central Mississauga',x=>x.caption.requiredModelCredits=[]]){
  const input=fixture('wide/citywide-future.png');mutate(input);assert.throws(()=>normalizeCleanMedia(input,base));
 }
 for(const identity of ACTIVE_NEIGHBOURHOOD_IDENTITIES){
  const input=fixture(identity),accepted=normalizeCleanMedia(input,base,{neighbourhood:true});
  assert.equal(accepted.caption.scenario,'existing');assert.equal(accepted.caption.comparisonState,identity.split('/').at(-1));
  assert.equal(mediaScenarioLabel(accepted),'Existing context · '+(identity.endsWith('/before')?'Before':'After'));
  input.caption.scenario=input.scenario='future';assert.throws(()=>normalizeCleanMedia(input,base,{neighbourhood:true}),/area and scenario/);
 }
 for(const stamp of ['2026-02-30T12:00:00Z','2026-11-02T24:00:00Z','2026-11-02T01:30:00-04:00']){
  const input=fixture();input.renderTimestampUTC=input.caption.renderTimestampUTC=stamp;
  assert.throws(()=>normalizeCleanMedia(input,base),/UTC/);
 }
});

test('only the exact accepted Airport camera package may declare its narrower office-core scope',()=>{
 const scope='Airport Corporate office core and immediate native context; not wholeairportoverview';
 const input=fixture('wide/airport-corporate-future.png');input.caption.geographicScope=scope;
 assert.throws(()=>normalizeCleanMedia(input,base),/geographic scope/);
 input.provenance={deliveryManifest:{sha256:'745a236ca60e9d68ac03d17d5a1d110dd0aadb40dd11555c87900bfe953e9033'}};
 const row=normalizeCleanMedia(input,base);assert.equal(row.caption.geographicScope,scope);
 assert.equal(row.renderInfo.sourceProofSHA256s.deliveryManifest,input.provenance.deliveryManifest.sha256);
 assert.doesNotMatch(mediaPreviewInfo(row).meta,/office core|wholeairport/);
 for(const mutate of [x=>x.provenance.deliveryManifest.sha256='0'.repeat(64),x=>x.caption.geographicScope='Airport overview']){
  const bad=structuredClone(input);mutate(bad);assert.throws(()=>normalizeCleanMedia(bad,base),/geographic scope/);
 }
 for(const identity of ['wide/dixie-applewood-future.png','wide/citywide-future.png']){
  const bad=fixture(identity);bad.caption.geographicScope=scope;bad.provenance=input.provenance;
  assert.throws(()=>normalizeCleanMedia(bad,base),/geographic scope/);
 }
});

test('new v2 pixel URLs preserve every legacy and prior-current identity without rebinding',()=>{
 const prior=read('data/downtown-media-20261101.json').images;
 const baseline=integrateCurrentPictures(history,prior,base),snapshot=structuredClone(baseline),oldIndex=indexMedia(baseline,base);
 const input=fixture('wide/downtown-future.png'),next=integrateCurrentPictures(baseline,[input],base),nextIndex=indexMedia(next,base);
 assert.deepEqual(baseline,snapshot);
 for(const [url,row]of oldIndex)assert.equal(nextIndex.get(url),row,url);
 const selected=refreshCatalogPictures(read('data/picture-assets.json'),next).images['downtown-future.png'];
 assert.equal(selected.width,3840);assert.equal(selected.height,2400);assert.equal(selected.download.height,2700);assert.equal(selected.url,input.download.url);
 assert.equal(selected.display.url,input.responsivePreviews[0].url);assert.equal(selected.displayMaster.url,input.displayMaster.url);
 assert.equal(selected.nativeOriginal,undefined);assert.equal(selected.presentationInfo,undefined);
 for(const url of oldIndex.keys()){
  const bad=fixture();bad.download.url=url+'?v=next#new';assert.throws(()=>integrateCurrentPictures(baseline,[bad],base),/new URLs/);
 }
 assert.throws(()=>integrateCurrentPictures(baseline,[input,input],base),/Duplicate/);
 assert.throws(()=>integrateCurrentPictures(baseline,[input,prior[0]],base),/identity/);
});

test('Fairview v2 cannot become current or preview without its separate accepted pair proof',()=>{
 const input=fixture(ACTIVE_NEIGHBOURHOOD_IDENTITIES[0]),manifest={schema:'future-mississauga-neighbourhood-media/v2',id:'fairview',images:[input]};
 const preview=studyImagePreview(manifest,input.download.url,base);
 assert.equal(preview,null);
 assert.equal(studyImagePreview(manifest,'assets/fairview-20261028/neighbourhood-before.png',base),null);
 const old=read('data/neighbourhood-media.json');assert.equal(studyImagePreview(old,old.images[0].url,base).src,old.images[0].url);
 assert.throws(()=>integrateCurrentNeighbourhoods(history,[input],base),/Fairview proof/);
 assert.throws(()=>integrateCurrentNeighbourhoods(history,[input,fixture(ACTIVE_NEIGHBOURHOOD_IDENTITIES[1])],base),/Fairview proof/);
 assert.throws(()=>integrateCurrentNeighbourhoods(history,[fixture()],base),/identity/);
});

function docHarness(){
 const node=tag=>({tag,children:[],style:{},setAttribute(){},append(...children){this.children.push(...children);},remove(){this.removed=true;},classList:{add(){}},textContent:'',replaceChildren(...children){this.children=children;},querySelector(){return null;},querySelectorAll(){return [];}});
 return {createElement:node,createTextNode:text=>({...node('#text'),textContent:text})};
}
test('compact visible attribution keeps required credits and one source link without metadata prose',()=>{
 const doc=docHarness(),container=doc.createElement('span'),input=fixture();
 input.caption.requiredModelCredits.push('275 Superior Boulevard photo reference: David Lasker/Cityscape Photography · davidlaskerphotography.com');
 const info=mediaPreviewInfo(normalizeCleanMedia(input,base));renderImageAttribution(container,info.attribution,doc);
 assert.equal(container.children.filter(n=>n.textContent==='Sources').length,1);
 assert(container.children.some(n=>n.textContent===input.caption.cityCredit));assert(container.children.some(n=>n.textContent==='© OpenStreetMap'));
 assert(container.children.some(n=>n.textContent===input.caption.requiredModelCredits.at(-1)));
 assert(container.children.every(n=>!n.textContent.includes('Mixed;')));
});

test('only the exact recognised Zeidler credit has compact visible wording; full metadata remains intact',()=>{
 const full='Architectural massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario. Independent city placement and visualisation by Future Mississauga.';
 const input=fixture();input.caption.requiredModelCredits=[full];input.caption.fullCredits=[full];
 const row=normalizeCleanMedia(input,base),snapshot=structuredClone(row);
 assert.deepEqual(mediaPreviewInfo(row).attribution.requiredModelCredits,['Massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario.']);
 assert.deepEqual(row,snapshot);assert.equal(row.caption.requiredModelCredits[0],full);assert.equal(row.caption.fullCredits[0],full);
 const unrelated=fixture();unrelated.caption.requiredModelCredits=[full,full+' Additional qualification.'];
 assert.equal(mediaPreviewInfo(normalizeCleanMedia(unrelated,base)).attribution.requiredModelCredits[1],unrelated.caption.requiredModelCredits[1]);
});

test('clean caption reuses its title region and preserves the separate download control',()=>{
 const previous=globalThis.document,doc=docHarness();globalThis.document=doc;
 try{
  const copy=doc.createElement('div'),title=doc.createElement('h3'),download=doc.createElement('a');download.href='original-download.png';
  copy.querySelector=()=>title;copy.querySelectorAll=()=>[download];
  const image={closest:selector=>selector==='.picture-card,.social-grid article'?{querySelector:()=>copy}:null};
  updateCleanImageCaption(image,normalizeCleanMedia(fixture(),base));
  assert.equal(copy.children[0],title);assert.equal(title.textContent,'Clarkson');assert.equal(copy.children.filter(n=>n===title).length,1);
  assert.equal(copy.children[1].textContent,'by Daniel Sultan');assert.equal(copy.children[2].textContent,'Future scenario');assert.equal(copy.children.at(-1),download);
 }finally{globalThis.document=previous;}
});

test('comparison has one shared caption outside the clipped images and clears it for older views',()=>{
 const previous=globalThis.document,doc=docHarness();globalThis.document=doc;
 try{
  const captions=[],panel={after:node=>captions.push(node)},image=()=>({closest:selector=>selector==='.picture-compare'?panel:null});
  const before=image(),after=image(),b=fixture('wide/clarkson-existing.png'),a=fixture();
  a.caption.requiredModelCredits.push('275 Superior Boulevard photo reference: David Lasker/Cityscape Photography · davidlaskerphotography.com');
  updateCleanImageCaption(before,normalizeCleanMedia(b,base));updateCleanImageCaption(after,normalizeCleanMedia(a,base));
  assert.equal(captions.length,1);assert.equal(captions[0].children.length,3);
  assert.equal(captions[0].children[0].textContent,'Clarkson');
  assert.equal(captions[0].children[1].textContent,'by Daniel Sultan');
  const credits=captions[0].children[2].children;
  assert.equal(credits.filter(node=>node.textContent==='Sources').length,1);
  assert.equal(credits.filter(node=>node.textContent==='© OpenStreetMap').length,1);
  assert(credits.some(node=>node.textContent===a.caption.requiredModelCredits.at(-1)));
  const legacy={area:'Clarkson',sourceAttribution:{openStreetMap:true}};
  updateCleanImageCaption(before,legacy);updateCleanImageCaption(after,legacy);
  assert.equal(captions[0].removed,true);
 }finally{globalThis.document=previous;}
});

test('comparison key includes both scenarios even when the existing image arrives last',()=>{
 const previous=globalThis.document,doc=docHarness();globalThis.document=doc;
 try{
  const entries=read('data/presentation-media-20261109.json').images;
  const rows=['existing','future'].map(scenario=>normalizeCleanMedia(entries.find(row=>row.identity==='wide/downtown-'+scenario+'.png'),base));
  const snapshot=structuredClone(rows);
  for(const order of [[0,1],[1,0]]){
   const captions=[],panel={after:node=>captions.push(node)},images=rows.map(()=>({closest:selector=>selector==='.picture-compare'?panel:null}));
   for(const i of order)updateCleanImageCaption(images[i],rows[i]);
   assert.equal(captions.length,1);
   const key=captions[0].children.find(node=>node.className==='media-caption__key');
   const labels=key.children.flatMap(node=>node.children.filter(child=>child.tag==='#text').map(child=>child.textContent));
   for(const label of ['Existing','Under construction','Proposed','Status unverified'])assert.equal(labels.filter(value=>value===label).length,1);
   assert.deepEqual(rows,snapshot);
  }
 }finally{globalThis.document=previous;}
});

test('Updates keeps its dated story copy and two grid children while one source line refreshes',()=>{
 const previous=globalThis.document,doc=docHarness();globalThis.document=doc;
 try{
  const date=doc.createElement('time'),title=doc.createElement('h2'),prose=doc.createElement('p'),link=doc.createElement('a');
  date.textContent='1 November 2026';title.textContent='A closer look at M City';prose.textContent='The revised studies sit within the surrounding city.';link.href='explore.html?project=mcity-1-2';
  const copy=doc.createElement('div');copy.children=[date,title,prose,link];copy.append=node=>copy.children.push(node);
  copy.querySelector=selector=>selector==='.media-caption__credits'?copy.children.find(node=>node.className===selector.slice(1)):null;
  const image={closest:selector=>selector==='.update-story'?story:null,after(){assert.fail('caption must not become a third grid child');}};
  const story={children:[image,copy],querySelector:selector=>selector==='.update-story-copy'?copy:null};
  const row=normalizeCleanMedia(fixture('wide/downtown-future.png'),base);
  updateCleanImageCaption(image,row);updateCleanImageCaption(image,row);
  assert.deepEqual(story.children,[image,copy]);assert.deepEqual(copy.children.slice(0,4),[date,title,prose,link]);
  assert.equal(copy.children.length,5);assert.equal(title.textContent,'A closer look at M City');assert.equal(date.textContent,'1 November 2026');
  assert.equal(copy.children.at(-1).children.filter(node=>node.textContent==='Sources').length,1);
  assert(!copy.children.some(node=>node.className==='media-caption__scenario'));
 }finally{globalThis.document=previous;}
});


test('standalone construction preview keeps the dated scenario explicit without duplicating selector or card labels',async()=>{
 const {previewTitle}=await import('../public/image-preview.js');
 const row=normalizeCleanMedia(fixture('wide/downtown-skyline-construction.png'),base),info=mediaPreviewInfo(row);
 assert.equal(previewTitle(info),'Downtown · Dated construction');
 assert.equal(previewTitle(info,{views:true}),'Downtown');
 assert.equal(info.title,'Downtown');
 assert.equal(previewTitle(mediaPreviewInfo(normalizeCleanMedia(fixture('wide/downtown-future.png'),base))),'Downtown');
});


test('Dixie and Malton narrower scopes bind only their accepted revised-camera packages',()=>{
 for(const [identity,scope,sha] of [
  ['wide/dixie-applewood-future.png','InteriorDixie/Applewood district focus with immediate native context','2f091fc41b7116a86526f4db2e0ac37fb03d0fd083b70746267898af229d129f'],
  ['wide/malton-future.png','Malton district interior and immediate native context; tighter framing of the same focus','f6c42aac80bfe96e80bb6504b83a4b063259f430296ed8a801fe457383dda854']
 ]){
  const input=fixture(identity);input.caption.geographicScope=scope;input.provenance={deliveryManifest:{sha256:sha}};
  assert.equal(normalizeCleanMedia(input,base).caption.geographicScope,scope);
  for(const change of [x=>delete x.provenance,x=>x.provenance.deliveryManifest.sha256='0'.repeat(64),x=>x.caption.geographicScope+=' alternate']){
   const bad=structuredClone(input);change(bad);assert.throws(()=>normalizeCleanMedia(bad,base),/geographic scope/);
  }
  const unrelated=fixture('wide/erindale-future.png');unrelated.caption.geographicScope=scope;unrelated.provenance=input.provenance;
  assert.throws(()=>normalizeCleanMedia(unrelated,base),/geographic scope/);
 }
});
