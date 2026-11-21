import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {serveMedia} from '../cloudflare/media-worker.mjs';

const bytes=Buffer.from('a signed, accessible city image');
const key=createHash('sha256').update(bytes).digest('hex');
const image={key,bytes:bytes.length,type:'image/png'};
const path='/gallery/edition-20261121/signed-region.png';
const worker=serveMedia({[path]:image},null,{[key]:image},[key]);
function bindings(ranges, sendLength=true){
 let reads=0;
 return {get reads(){return reads},MEDIA:{get(){throw Error('Unexpected R2 read')}},ASSETS:{async fetch(request){
  assert.equal(new URL(request.url).pathname,'/_city-originals/'+key+'.png');
  reads+=1;
  const slice=request.headers.get('Range')?.match(/^bytes=(\d+)-(\d+)$/);
  if(ranges&&slice){
   const start=+slice[1],end=+slice[2],length=end-start+1;
   return new Response(bytes.subarray(start,end+1),{status:206,headers:{...(sendLength ? {'Content-Length':length} : {}),'Content-Range':`bytes ${start}-${end}/${bytes.length}`}});
  }
  const data=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=4)controller.enqueue(bytes.subarray(i,i+4));controller.close()}});
  return new Response(data,{headers:sendLength ? {'Content-Length':bytes.length} : {}});
 }}};
}
for(const sendLength of [true,false])for(const ranges of [true,false])test('a static print preserves named, immutable, conditional and ranged downloads, server-side range support '+ranges+', response Content-Length '+sendLength,async()=>{
 const env=bindings(ranges,sendLength);
 for(const address of [path,'/media/sha256/'+key]){
  const request=(method='GET',headers={})=>worker.fetch(new Request('https://site.example'+address,{method,headers}),env);
  const head=await request('HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('ETag'),'"'+key+'"');
  assert.equal((await request('GET',{'If-None-Match':'"'+key+'"'})).status,304);
  const received=await request();assert.deepEqual(Buffer.from(await received.arrayBuffer()),bytes);
  const part=await request('GET',{Range:'bytes=5-13'});
  assert.equal(part.status,206);assert.equal(part.headers.get('Content-Range'),`bytes 5-13/${bytes.length}`);
  assert.deepEqual(Buffer.from(await part.arrayBuffer()),bytes.subarray(5,14));
  assert.equal((await request('GET',{Range:'bytes=900-999'})).status,416);
 }
 assert.equal(env.reads,4);
});
