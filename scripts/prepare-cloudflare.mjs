import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {constants,createReadStream} from 'node:fs';
import {mkdir,copyFile,readFile,writeFile,readdir,stat,lstat,mkdtemp,rm,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,relative,extname} from 'node:path';
import {validate} from './validate.mjs';
import {legacyAtlasPath} from '../cloudflare/media-worker.mjs';
const run = promisify(execFile);
async function copyReleaseFile(source, destination, size) {
  // Node falls back to a full copy on macOS. The system cp uses clonefile()
  // on APFS, so a staged render stays independent while sharing its blocks.
  if (process.platform === 'darwin' && size >= 64 * 1024) {
    await run('/bin/cp', ['-c', source, destination]);
  } else {
    await copyFile(source, destination, constants.COPYFILE_FICLONE);
  }
}
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const src=join(root,'public'), output=join(root,'.cloudflare-release');
const stage=await mkdtemp(join(root,'.cloudflare-stage-'));
const assets=join(stage,'assets'),media=join(stage,'media'), files={}, objects=new Map();
const maxBytes=25*1024**2, budget=8_000_000_000;
const mime={'.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf','.mp4':'video/mp4','.gz':'application/gzip','.jpg':'image/jpeg'};
let count=0, bytes=0;
async function visit(folder){
  for(const d of await readdir(folder,{withFileTypes:true})){
    const f=join(folder,d.name), path=relative(src,f);
    if(d.isDirectory()){await visit(f);continue;}
    assert(d.isFile(), 'Expected a public regular file: '+path);
    if(['.DS_Store','CNAME','.nojekyll'].includes(d.name))continue;
    const size=(await stat(f)).size, ext=extname(f);
    // Large archival images, PDFs, movies and models belong behind the private binding.
    if(size>maxBytes || (size>8_000_000 && Object.hasOwn(mime,ext))){
      const h=createHash('sha256');for await (const chunk of createReadStream(f))h.update(chunk);
      const key=h.digest('hex'), meta={key,bytes:size,type:mime[ext]||'application/octet-stream'};
      files['/'+path]=meta;
      if(!objects.has(key)){await copyReleaseFile(f,join(media,key),size);objects.set(key,meta);}
    }else{
      assert(size<=maxBytes);
      const target=join(assets,path);await mkdir(dirname(target),{recursive:true});
      if(path==='asset-delivery.js'){
        // Keep named resolver exports for consumers. Known local originals in this
        // complete build now resolve through this host, including its preview URL.
        const script=await readFile(f,'utf8');
        const old=script.match(/^export const assetURL = (?:value => releaseAssetURL\(cloudflareAssetURL\(value\)\)|createAssetResolver\(\{origin: assetOrigin, paths: deliveryPaths\}\));$/m)?.[0];
        assert(old,'Unrecognized public asset resolver');
        await writeFile(target,script.replace(old,'export const assetURL = value => value;'));
      }else await copyReleaseFile(f,target,size);
      count++;bytes+=size;
    }
  }
}
try{
  await validate(src,{enforcePublicationSize:false,target:'cloudflare'});
  await mkdir(media);await mkdir(assets);
  await visit(src);
  const r2Bytes=[...objects.values()].reduce((n,f)=>n+f.bytes,0);
  assert(count<=20000,'Workers Free file count exceeded');
  assert(r2Bytes<=budget,'Project storage budget exceeded');
  await writeFile(join(stage,'objects.json'),JSON.stringify(Object.fromEntries(objects),null,2));
  await writeFile(join(stage,'media-routes.json'),JSON.stringify(files,null,2));
  const downloads = await readFile(join(src, 'downloads.html'), 'utf8');
  const atlas = downloads.match(/href="(downloads\/edition-\d{8}\/Mississauga-Atlas\.pdf)"/)?.[1];
  assert(atlas && (await stat(join(src, atlas))).isFile(), 'Download directory must identify the current atlas');
  const source=await readFile(join(root,'cloudflare/media-worker.mjs'),'utf8');
  await writeFile(join(stage,'worker.mjs'),source+'\nexport default serveMedia('+JSON.stringify(files)+','+JSON.stringify('/'+atlas)+');\n');
  const config={name:'future-mississauga-preview',main:'worker.mjs',compatibility_date:'2026-11-01',workers_dev:true,assets:{directory:'./assets',binding:'ASSETS',html_handling:'none',not_found_handling:'none',run_worker_first:[legacyAtlasPath]},r2_buckets:[{binding:'MEDIA',bucket_name:'future-mississauga-media'}]};
  await writeFile(join(stage,'wrangler.json'),JSON.stringify(config,null,2)+'\n');
  const summary={staticFiles:count,staticBytes:bytes,r2Objects:objects.size,r2Bytes,maximumProjectStorage:budget,currentAtlas:'/'+atlas};
  await writeFile(join(stage,'inventory.json'),JSON.stringify(summary,null,2)+'\n');
  // Replace only directories made by this builder.
  if(await lstat(output).catch(()=>null)){
    assert(await stat(join(output,'inventory.json')));
    const old=await mkdtemp(join(root,'.cloudflare-stage-'));await rm(old,{recursive:true});await rename(output,old);
    try{await rename(stage,output);}catch(e){await rename(old,output);throw e;}
    await rm(old,{recursive:true});
  }else await rename(stage,output);
  console.log(summary);
}finally{await rm(stage,{recursive:true,force:true});}
