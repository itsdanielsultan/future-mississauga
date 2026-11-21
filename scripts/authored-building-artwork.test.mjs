import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {validateAuthoredBuildingArtwork} from './validate-authored-building-artwork.mjs';

const site=fileURLToPath(new URL('../public/',import.meta.url));
const parse=async path=>JSON.parse(await readFile(path,'utf8'));
const edition=name=>new URL('./editions/20261121/'+name+'.json',import.meta.url);

test('all November 21 authored buildings retain their registered sources and exact delivered images',async()=>{
  assert.deepEqual(await validateAuthoredBuildingArtwork(site),{profiles:30,landmarks:8,files:76});
});

test('a correctly sized but unrelated card is rejected at the catalogue entry that advertises it',async t=>{
  const root=await mkdtemp(join(tmpdir(),'fm-authored-art-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const folder of ['gallery','models'])await symlink(join(site,folder),join(root,folder));
  const data=join(root,'data');
  await mkdir(data);
  const features=await parse(join(site,'data/building-features.json'));
  const catalogue=await parse(join(site,'data/building-catalogue.json'));
  const cards=new Map(catalogue.entries.map(entry=>[entry.id,entry]));
  for(const name of ['building-profiles','landmark-plates']){
    for(const [id,row] of Object.entries(await parse(edition(name)))){
      const image=row.displayImage??row.image;
      if(features[id])Object.assign(features[id],{displayImage:image,cardImage:row.cardImage});
      cards.get(id).image=row.cardImage;
    }
  }
  await symlink(join(site,'data/directory-pictures-20261121.json'),join(data,'directory-pictures-20261121.json'));
  await writeFile(join(data,'building-features.json'),JSON.stringify(features));
  const cataloguePath=join(data,'building-catalogue.json');
  await writeFile(cataloguePath,JSON.stringify(catalogue));
  assert.deepEqual(await validateAuthoredBuildingArtwork(root,{active:true}),{profiles:30,landmarks:8,files:76});
  cards.get('aldo-1422-study').image=cards.get('mcity-m1').image;
  await writeFile(cataloguePath,JSON.stringify(catalogue));
  await assert.rejects(validateAuthoredBuildingArtwork(root,{active:true}),/aldo-1422-study current catalogue binding/);
});

test('November 20 Aldo URLs keep the original bytes verified from the previous public deployment',async()=>{
  const hashes={
    'gallery/edition-20261120/buildings/aldo-1422-study.webp':'8c421ccf63357d4e408aef2afc0fb49b4cdeddc358da3c4dafac56169e95daca',
    'gallery/edition-20261120/buildings/cards/aldo-1422-study.webp':'3c1324a5b6d01560972afd5c0df6a728e7033dfe43668ac3df8fba3d2b3e455b',
    'downloads/edition-20261120/aldo-1422-study-review.pdf':'a6985db90edeb2e17dde7e7e73ede62122bdfea9a983e9df8081b51ab6881423'
  };
  for(const [path,digest] of Object.entries(hashes)){
    assert.equal(createHash('sha256').update(await readFile(join(site,path))).digest('hex'),digest,path);
  }
});
