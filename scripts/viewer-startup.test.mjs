import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise the real asynchronous entry point without constructing a WebGL renderer.
// The public API assignment has no loading behaviour and needs the full renderer,
// so the harness omits that line and supplies only the navigation dependencies.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const startup=app.split('resize();tick();')[1].split('// WebMCP')[0]
 .replace(/^window\.atlas=.*\n/m,'');
function start({project='square-one-block22'}={}){
 let finish;const loaded=new Promise(resolve=>{finish=resolve;});
 const focused=[],context={
  initialQuery:new URLSearchParams({district:'downtown',project}),
  projects:[{id:'square-one-block22'}],focusRequest:0,current:null,
  window:{atlasReady:null},
  loadDistrict:async id=>{const request=++context.focusRequest;context.current={id};await loaded;if(request===context.focusRequest)context.window.atlasReady=id;},
  focusProject:async p=>{focused.push(p.id);},
 };
 const done=runInNewContext('(async()=>{'+startup+'})()',context);
 return {context,focused,finish,done};
}
test('an initial project link focuses after its district finishes loading',async()=>{
 const run=start();assert.deepEqual(run.focused,[]);run.finish();await run.done;
 assert.deepEqual(run.focused,['square-one-block22']);
});
test('a later district choice cancels the pending initial project focus',async()=>{
 const run=start();run.context.focusRequest++;run.context.current={id:'port-credit'};run.context.window.atlasReady='port-credit';run.finish();await run.done;
 assert.deepEqual(run.focused,[]);assert.equal(run.context.current.id,'port-credit');
});
test('a later search choice cancels the pending initial focus even in the same district',async()=>{
 const run=start();run.context.focusRequest++;run.context.window.atlasReady='downtown';run.finish();await run.done;
 assert.deepEqual(run.focused,[]);
});
