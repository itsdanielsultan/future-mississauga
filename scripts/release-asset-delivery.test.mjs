import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseAssetResolver} from '../public/release-asset-delivery.js';
import {assetURL} from '../public/asset-delivery.js';
import {assetOrigin,deliveryPaths} from '../public/asset-delivery-map.js';
const sha256='a'.repeat(64),file='wide-lorne-park-clean-'+sha256.slice(0,12)+'.png';
const row={path:'gallery/missing-areas-20261113/'+file,url:'https://github.com/itsdanielsultan/future-mississauga/releases/download/neighbourhood-images-2026-11-13-v1/'+file,sha256,bytes:123};
const resolve=assets=>createReleaseAssetResolver({assets,baseURI:'https://futuremississauga.com/'});
test('release images resolve only their exact registered source identity',()=>{
 const get=resolve([row]);
 assert.equal(get(row.path),row.url);
 assert.equal(get(row.path+'?edition=1#view'),row.url+'#view');
 for(const value of [row.path+'?unlisted=1','https://example.com/'+row.path,'gallery/old.png','data:image/png;base64,AA','models/a.glb',row.url,null])assert.equal(get(value),value);
});
test('release routing rejects changed hosts, tags, filenames and historical paths',()=>{
 for(const changed of [
  {...row,path:'gallery/native-20261102/'+file},
  {...row,url:row.url.replace('github.com','example.com')},
  {...row,url:row.url.replace('neighbourhood-images-2026-11-13-v1','old-release')},
  {...row,url:row.url+'?download=1'},
  {...row,sha256:'b'.repeat(64)},
  {...row,url:row.url.replace(file,'wrong.png')},
  {...row,bytes:0}
 ])assert.throws(()=>resolve([changed]));
 assert.throws(()=>resolve([row,row]),/Duplicate/);
});
test('all 290 existing CDN paths retain their original destinations',()=>{
 assert.equal(Object.keys(deliveryPaths).length,290);
 for(const [path,target] of Object.entries(deliveryPaths))assert.equal(assetURL(path),assetOrigin+'/'+target,path);
});
test('final Downtown scenes and revised footers use only registered immutable routes',()=>{
 for(const prefix of ['refreshed-20261113','refreshed-20261113-v2']){
  const next={...row,path:'gallery/'+prefix+'/'+file,url:row.url.replace('2026-11-13-v1','2026-11-13-downtown-v1')};
  assert.equal(resolve([next])(next.path),next.url);
 }
 assert.throws(()=>resolve([{...row,path:'gallery/refreshed-20261113-v3/'+file}]));
});
