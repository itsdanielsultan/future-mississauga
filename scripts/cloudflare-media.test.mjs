import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serveMedia} from '../cloudflare/media-worker.mjs';
const file={key:'abcdef',type:'application/pdf',bytes:6};
const handler=serveMedia({'/downloads/book.pdf':file});
function mock() {
  const calls=[];
  const env={MEDIA:{async get(key,options){calls.push(key);const bytes=new TextEncoder().encode('abcdef');const r=options?.range;return {size:6,body:r?bytes.slice(r.offset,r.offset+r.length):bytes};}},
    ASSETS:{fetch(request){return new Response(new URL(request.url).pathname);}}};
  const fetch=(path='/downloads/book.pdf',options)=>handler.fetch(new Request('https://preview.test'+path,options),env);
  return {calls,fetch};
}
test('a large download uses one read and supports browser byte ranges',async()=>{
  for(const [range,result,responseRange] of [['bytes=1-3','bcd','bytes 1-3/6'],['bytes=-2','ef','bytes 4-5/6'],['bytes=4-','ef','bytes 4-5/6']]){
    const m=mock();const r=await m.fetch(undefined,{headers:{range}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),responseRange);assert.equal(await r.text(),result);assert.equal(m.calls.length,1);
  }
});
test('invalid ranges, HEAD, writes, conditional matches and unlisted keys do not read R2',async()=>{
  const m=mock();
  for(const [options,code] of [[{headers:{range:'bytes=10-12'}},416],[{headers:{range:'bytes=-0'}},416],[{method:'HEAD'},200],[{method:'POST'},405],[{headers:{'if-none-match':'W/"abcdef"'}},304]])assert.equal((await m.fetch(undefined,options)).status,code);
  assert.equal(await (await m.fetch('/')).text(),'/index.html');assert.equal(await (await m.fetch('/unknown')).text(),'/unknown');assert.equal(m.calls.length,0);
});
test('changed range validators get a full response with the original public content type',async()=>{
 const m=mock(),r=await m.fetch(undefined,{headers:{range:'bytes=1-2','if-range':'"earlier"'}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.equal(await r.text(),'abcdef');assert.equal(m.calls.length,1);
});

test('the undated atlas follows the current edition while dated links retain their original bytes', async () => {
  const old = '/downloads/Future-Mississauga-Atlas.pdf';
  const latest = '/downloads/edition-20261120/Mississauga-Atlas.pdf';
  const handler = serveMedia({[old]:file}, latest);
  const env = {MEDIA:{get:async()=>({size:6,body:'abcdef'})}};
  const current = await handler.fetch(new Request('https://preview.test'+old), env);
  assert.equal(current.status, 307);
  assert.equal(current.headers.get('location'), 'https://preview.test'+latest);
  const archive = await handler.fetch(new Request('https://preview.test'+old+'?edition=c9f219e7094e834a'), env);
  assert.equal(archive.status, 200);
  assert.equal(await archive.text(), 'abcdef');
});
