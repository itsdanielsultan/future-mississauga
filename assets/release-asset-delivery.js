import {releaseImageAssets} from './release-asset-map.js?v=20261113-delivery2';

const releaseRoot='https://github.com/itsdanielsultan/future-mississauga/releases/download/';
export function createReleaseAssetResolver({assets,baseURI=()=>globalThis.document?.baseURI||'https://futuremississauga.com/'}){
 const paths=new Map();
 for(const row of assets){
  if(!/^gallery\/(?:missing-areas-20261113|refreshed-20261113|refreshed-20261113-v2)\/[a-zA-Z0-9-]+\.(?:png|jpg|avif)$/.test(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256)||!row.path.includes('-'+row.sha256.slice(0,12)+'.')||!Number.isSafeInteger(row.bytes)||row.bytes<=0)throw Error('Invalid release image identity');
  const name=row.path.split('/').pop(),url=new URL(row.url);
  if(url.href!==row.url||!row.url.startsWith(releaseRoot)||!/^neighbourhood-images-2026-11-13-[a-z0-9-]+$/.test(url.pathname.split('/')[5])||url.pathname.split('/').length!==7||url.pathname.split('/').pop()!==name||url.search||url.hash||url.username||url.password)throw Error('Invalid image release destination');
  if(paths.has(row.path))throw Error('Duplicate release image identity');
  paths.set(row.path,row.url);
 }
 return value=>{
  if(typeof value!=='string')return value;
  let base,url;try{base=new URL(typeof baseURI==='function'?baseURI():baseURI);url=new URL(value,base);}catch{return value;}
  if(!['http:','https:'].includes(url.protocol)||!([base.origin,'https://futuremississauga.com','https://futuremississauga.ca'].includes(url.origin))||[...url.searchParams.keys()].some(key=>key!=='edition'))return value;
  const target=paths.get(url.pathname.slice(1));
  return target?target+url.hash:value;
 };
}
export const releaseAssetURL=createReleaseAssetResolver({assets:releaseImageAssets});
