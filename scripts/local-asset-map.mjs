import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';

// Explicit, local-only preview mapping. No source paths enter public metadata.
export async function loadLocalAssetMap(path){
  if(!path)return new Map();
  const manifest=JSON.parse(await readFile(path,'utf8'));
  if(manifest.schema!=='future-mississauga-local-asset-map/v1'||!Array.isArray(manifest.assets)||![12,36,84].includes(manifest.assets.length))throw Error('Expected one accepted 12-, 36- or 84-file image map.');
  const namespace=manifest.assets.length===84?/^gallery\/refreshed-20261113(?:-v2)?\/[a-zA-Z0-9-]+\.(png|jpg|avif)$/:/^gallery\/missing-areas-20261113\/[a-zA-Z0-9-]+\.(png|jpg|avif)$/;
  const result=new Map();
  for(const asset of manifest.assets){
    if(!namespace.test(asset.url)||result.has(asset.url)||!isAbsolute(asset.path)||!Number.isSafeInteger(asset.bytes)||asset.bytes<=0||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Invalid local asset map entry.');
    const info=await stat(asset.path);if(!info.isFile()||info.size!==asset.bytes)throw Error('Local asset size mismatch.');
    const hash=createHash('sha256');for await(const chunk of createReadStream(asset.path))hash.update(chunk);
    if(hash.digest('hex')!==asset.sha256)throw Error('Local asset hash mismatch.');
    result.set(asset.url,{path:asset.path,bytes:asset.bytes});
  }
  return result;
}
