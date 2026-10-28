import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pictureProvenance,shortDate,cityMapLinkForSection} from '../public/image-provenance.js';

const json = path => JSON.parse(fs.readFileSync(new URL('../public/'+path,import.meta.url)));
const pictures = json('data/picture-assets.json');
const catalog = json('data/labelled-image-assets.json');

test('a reframed camera keeps the older model date distinct from its render date',()=>{
  const row = pictures.images['downtown-future.png'];
  const shown = pictureProvenance(row.renderInfo,row.width);
  assert.match(shown.meta,/Rendered 23 Oct 2026/);
  assert.match(shown.sourceEdition,/21 Oct 2026/);
  assert.doesNotMatch(shown.sourceEdition,/23 Oct|25 Oct|27 Oct|28 Oct/);
  assert.equal(shown.notice,'');
});

test('a refreshed Lakeview render still identifies its source model edition',()=>{
  const row = pictures.images['lakeview-future.png'];
  const shown = pictureProvenance(row.renderInfo,row.width);
  assert.match(shown.meta,/Rendered 22 Oct 2026/);
  assert.match(shown.sourceEdition,/21 Oct 2026/);
});

test('retained Clarkson views expose the earlier-view notice without inventing a model date',()=>{
  const row = pictures.images['clarkson-future.png'];
  assert.equal(row.renderInfo.sourceModelDate,null);
  const shown = pictureProvenance(row.renderInfo,row.width);
  assert.match(shown.meta,/Rendered 29 Sept? 2026/);
  assert.equal(shown.sourceEdition,'Earlier model version');
  assert.match(shown.notice,/earlier view.*later model changes/);
  assert.doesNotMatch(shown.sourceEdition,/Visual Polish|2026-09-26/);
});

test('presentation and catalogue dates never become render or model dates',()=>{
  for(const renderInfo of [undefined,null,{}, {edition:'Presentation refresh 2026-10-28',reviewDate:'2026-10-25',publishedOn:'2026-10-28',modelReviewDate:'2026-10-27'}]){
    const shown=pictureProvenance(renderInfo,6144);
    assert.equal(shown.meta,'6K PNG');assert.equal(shown.sourceEdition,'');assert.equal(shown.notice,'');
  }
  for(const invalid of ['2026-02-30','2026-13-01','2026-01-00','28 October 2026',new Date('2026-10-28')])assert.equal(shortDate(invalid),'');
  assert.match(shortDate('2024-02-29'),/29 Feb 2024/);
  assert.equal(pictureProvenance({sourceEdition:'Unverified source 2026-10-28'},1800).sourceEdition,'Model date not recorded');
});

test('all labelled wide views show the same provenance as the gallery originals',()=>{
  for(const row of catalog.images.filter(row=>row.kind==='wide')){
    const original=pictures.images[row.file];
    assert.deepEqual(pictureProvenance(row.renderInfo,row.download.width),pictureProvenance(original.renderInfo,original.width),row.file);
  }
  const wide=catalog.images.filter(row=>row.kind==='wide'&&row.renderInfo?.state==='retained-earlier');
  const social=catalog.images.filter(row=>row.kind==='portraits'&&row.renderInfo?.state==='retained-earlier');
  assert.equal(wide.length,4);assert.equal(social.length,2);
  for(const row of social)assert.match(pictureProvenance(row.renderInfo,row.download.width).notice,/earlier view/);
});

test('catalog URL refresh and aliases preserve original render lineage',async()=>{
  const previousFetch=globalThis.fetch,previousLocation=globalThis.location;
  globalThis.fetch=async()=>new Response(JSON.stringify(catalog));
  globalThis.location={href:'https://futuremississauga.com/'};
  try{
    const {refreshPictureAssets,resolveMedia}=await import('../public/media-catalog.js?test=image-provenance');
    const refreshed=await refreshPictureAssets(structuredClone(pictures));
    for(const row of catalog.images.filter(row=>row.kind==='wide')){
      const before=pictures.images[row.file],after=refreshed.images[row.file];
      assert.deepEqual(after.renderInfo,before.renderInfo,row.file);
      for(const [key,value]of Object.entries(before))if(!['url','sha256','bytes','display','displayMaster','download','sourceAttribution'].includes(key))assert.deepEqual(after[key],value,row.file+': '+key);
      assert.equal(after.url,row.download.url);assert.equal(after.sha256,row.download.sha256);
      const alias=await resolveMedia(row.aliases[0]);
      assert.deepEqual(alias.renderInfo,before.renderInfo,row.file);
    }
  }finally{globalThis.fetch=previousFetch;if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
});

const section=(id,hrefs,previewExplore)=>({id,dataset:{previewExplore},querySelectorAll:()=>hrefs.map(href=>({getAttribute:()=>href}))});
const base='https://futuremississauga.com/reference-updates.html';
test('generic previews use only an existing city route for that exact study',()=>{
  const href='explore.html?district=heartland&project=sgm-maritz-6710';
  assert.equal(cityMapLinkForSection(section('sgm-maritz-6710',[href]),base),href);
  assert.equal(cityMapLinkForSection(section('gala-gateway',[href]),base),'');
  assert.equal(cityMapLinkForSection(section('',[href]),base),'');
  assert.equal(cityMapLinkForSection(section('sgm-maritz-6710',['explore.html?district=heartland','model.html?model=sgm-maritz-6710']),base),'');
  assert.equal(cityMapLinkForSection(section('sgm-maritz-6710',['https://other.example/'+href]),base),'');
  assert.equal(cityMapLinkForSection(null,base),'');
});

test('a neighbourhood context uses an explicit matching section link, never a guessed project ID',()=>{
  const href='explore.html?district=citywide&context=fairview';
  assert.equal(cityMapLinkForSection(section('fairview-neighbourhood',[href],href),base),href);
  assert.equal(cityMapLinkForSection(section('fairview-neighbourhood',[href]),base),'');
  assert.equal(cityMapLinkForSection(section('fairview-neighbourhood',[],href),base),'');
  assert.equal(cityMapLinkForSection(section('fairview-neighbourhood',[href],'explore.html?district=citywide&context=other'),base),'');
  assert.equal(cityMapLinkForSection(section('fairview-neighbourhood',['https://other.example/'+href],'https://other.example/'+href),base),'');
});

test('actual study markup retains one exact city route per mapped study',()=>{
  const projects=json('data/projects.json');let count=0;
  for(const page of ['review-renders.html','reference-updates.html']){
    const html=fs.readFileSync(new URL('../public/'+page,import.meta.url),'utf8');
    for(const match of html.matchAll(/<section class="(?:render-project|model-change)" id="([^"]+)"([^>]*)>([\s\S]*?)<\/section>/g)){
      const explicit=match[2].match(/data-preview-explore="([^"]+)"/)?.[1].replaceAll('&amp;','&');
      const hrefs=[...match[3].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(item=>item[1].replaceAll('&amp;','&'));
      const mapped=hrefs.filter(href=>href.startsWith('explore.html?'));
      if(!mapped.length){assert.equal(cityMapLinkForSection(section(match[1],hrefs),base),'');continue;}
      assert.equal(mapped.length,1,match[1]);
      const target=cityMapLinkForSection(section(match[1],hrefs,explicit),base);assert.equal(target,mapped[0]);
      const params=new URL(target,base).searchParams;
      if(params.has('project'))assert.ok(projects.some(project=>project.id===params.get('project')),match[1]);
      else{assert.equal(params.get('context'),'fairview');assert.equal(params.get('district'),'citywide');}
      count++;
    }
  }
  assert.equal(count,26);
});
