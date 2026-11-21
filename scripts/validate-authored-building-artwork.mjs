import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const recipe=new URL('./editions/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const receiptHashes={
  'building-profiles':'39c1d9a3fe5abc349187493ad1ef3f74b7b2cfec941bbb0c8d2e623f26aa8c5d',
  'landmark-plates':'bf7599759ee4aa6d227901c2ae611424d4b9d8e7ef93490352fff3c08aa63471'
};
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  switch (bytes.toString('ascii',12,16)) {
    case 'VP8 ': return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
    case 'VP8L': {
      assert.equal(bytes[20],0x2f);
      const packed=bytes.readUInt32LE(21);
      return [(packed&0x3fff)+1,((packed>>>14)&0x3fff)+1];
    }
    case 'VP8X': return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
    default: throw new Error('Unsupported WebP frame');
  }
}

export async function validateAuthoredBuildingArtwork(site,{active=false}={}) {
  const publicJSON=name=>json(join(site,'data',name+'.json'));
  const features=active?await publicJSON('building-features'):null;
  const directory=await publicJSON('directory-pictures-20261121');
  const catalogue=active?await publicJSON('building-catalogue'):null;
  const byId=entries=>new Map(entries.map(row=>[row.id,row]));
  const pictures=byId(directory.entries),cards=catalogue&&byId(catalogue.entries);
  const modelHashes=new Map();
  async function image(asset, url, size) {
    assert.equal(asset.url,url);
    const bytes=await readFile(join(site,url));
    assert.equal(hash(bytes),asset.sha256,url+' bytes diverge from the render receipt');
    assert.deepEqual([asset.width,asset.height],size,url+' registered dimensions');
    assert.deepEqual(webpSize(bytes),size,url+' intrinsic dimensions');
  }
  async function sources(current,original) {
    assert.deepEqual(current,original,'accepted authored model bindings');
    for (const source of current) {
      assert.match(source.sha256,/^[0-9a-f]{64}$/);
      if(source.type==='original-model') {assert(source.sourceKey);continue;}
      assert.equal(source.type,'public-model');
      if(!modelHashes.has(source.url)){
        const archived=/^https:\/\/raw\.githubusercontent\.com\/itsdanielsultan\/future-mississauga\/[a-f0-9]{40}\/(model-assets\/[\w/.-]+)$/.exec(source.url);
        const path=archived?new URL('../'+archived[1],import.meta.url):join(site,source.url);
        modelHashes.set(source.url,hash(await readFile(path)));
      }
      assert.equal(modelHashes.get(source.url),source.sha256,source.url+' original model bytes');
    }
  }
  for (const [name,quantity,previous] of [['building-profiles',30,'studies'],['landmark-plates',8,'revisions']]) {
    const raw=await readFile(new URL('20261121/'+name+'.json',recipe));
    assert.equal(hash(raw),receiptHashes[name],name+' dated source and picture receipt');
    const records=JSON.parse(raw);
    const archived=await json(new URL('20261120/buildings/'+previous+'.json',recipe));
    assert.equal(Object.keys(records).length,quantity);
    assert.deepEqual(Object.keys(records).sort(),Object.keys(archived).sort(),name+' exact original IDs');
    const isProfile=name==='building-profiles';
    const root='gallery/edition-20261121/';
    for (const [id,r] of Object.entries(records)) {
      const ref=archived[id];
      assert.equal(r.triangles,ref.triangles,id+' triangle count');
      assert(Array.isArray(r.camera)&&r.camera.length===3&&r.camera.every(Number.isFinite),id+' camera');
      if(id!=='aldo-1422-study')assert.deepEqual(r.camera,ref.camera,id+' original camera');
      await sources(isProfile?r.modelInputs:[r.source],isProfile?ref.modelInputs:[ref.source]);
      if(!isProfile)assert.equal(r.credit,ref.credit,id+' attribution');
      const folder=isProfile?'buildings':'building-revisions';
      const cardFolder=isProfile||['benares-visitor-centre','bradley-barn'].includes(id)?'buildings':'building-revisions';
      const full=isProfile?r.displayImage:r.image;
      await image(full,root+folder+'/'+id+'.webp',[1800,1350]);
      await image(r.cardImage,root+cardFolder+'/cards/'+id+'.webp',[640,480]);
      if(!isProfile)assert.deepEqual(pictures.get(id)?.image,r.cardImage,id+' landmark directory thumbnail');
      if(!active)continue;
      if(isProfile||features[id]){
        assert.deepEqual(features[id].displayImage,full,id+' public full-sized picture');
        assert.deepEqual(features[id].cardImage,r.cardImage,id+' public authored thumbnail');
      }
      assert.deepEqual(cards.get(id)?.image,r.cardImage,id+' current catalogue binding');
    }
  }
  return {profiles:30,landmarks:8,files:76};
}
