// Optional studies are explicit, lazy and recoverable. No source is hidden until
// its replacement is loaded and actually visible in the chosen scenario.
export function shouldLoadRefinement(asset,{referenceStudies=false,selectedStudyProjectId=null}={}){
 return !asset.localOptional||referenceStudies||asset.projectId===selectedStudyProjectId;
}
export async function loadModelAsset(loader,url,resolveURL=x=>x,fetcher=globalThis.fetch){
 if(!/\.glb\.gz(?:[?#]|$)/i.test(url))return loader.loadAsync(url);
 const response=await fetcher(resolveURL(url));
 if(!response.ok)throw new Error('Optional model unavailable: '+response.status+' '+url);
 let bytes=new Uint8Array(await response.arrayBuffer());
 const glb=()=>bytes.length>=12&&bytes[0]===0x67&&bytes[1]===0x6c&&bytes[2]===0x54&&bytes[3]===0x46;
 if(!glb()){
  if(bytes[0]!==0x1f||bytes[1]!==0x8b)throw new Error('Expected GLB or gzip data: '+url);
  if(typeof DecompressionStream!=='function')throw new Error('This browser cannot decode the optional gzip model. The municipal baseline remains available.');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 if(!glb())throw new Error('Decoded optional model is not a GLB: '+url);
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
export function createOptionalRefinementLoader({load,commit,dispose,isCurrent}){
 const pending=new Map(),loaded=new Set();
 return {has:id=>loaded.has(id),load(asset){
  if(loaded.has(asset.id))return Promise.resolve({loaded:true,cached:true});
  if(pending.has(asset.id))return pending.get(asset.id);
  const task=Promise.resolve().then(()=>load(asset)).then(async result=>{
   if(!isCurrent()){dispose(result);return {loaded:false,stale:true};}
   await commit(asset,result);loaded.add(asset.id);return {loaded:true,cached:false};
  }).finally(()=>pending.delete(asset.id));
  pending.set(asset.id,task);return task;
 }};
}
