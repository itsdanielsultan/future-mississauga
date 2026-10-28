import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';

// Exercise the real asynchronous entry point without constructing a WebGL renderer.
// The public API assignment has no loading behaviour and needs the full renderer,
// so the harness omits that line and supplies only the navigation dependencies.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const startup=app.split('resize();tick();')[1].split('// WebMCP')[0]
 .replace(/^window\.atlas=.*\n/m,'');
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
const scenarioHandler=app.match(/\$\('#scenarioSelect'\)\.onchange=e=>\{[^}]+\};/)[0];
const compareHandler=app.slice(app.indexOf("$('#compareToggle').onchange="),app.indexOf("$('#compareRange').oninput="));
function start({project='square-one-block22',district='downtown',scenario,area,waitForFocus=false}={}){
 const loaded=deferred(),focusBarrier=deferred(),focusEntered=deferred();
 const focused=[],areas=[],modes=[],elements=new Map(),query={district};
 if(project)query.project=project;if(scenario)query.scenario=scenario;if(area)query.context=area;
 const context={
  initialQuery:new URLSearchParams(query),scenarioInteractions:0,
  projects:[{id:'square-one-block22'}],focusRequest:0,current:null,
  window:{atlasReady:null},mode:'future',compare:false,split:.5,
  $:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);},
  syncCompare:()=>{},setMode:mode=>{context.mode=mode;modes.push(mode);},
  loadDistrict:async id=>{const request=++context.focusRequest;context.current={id};await loaded.promise;if(request===context.focusRequest)context.window.atlasReady=id;},
  focusProject:async p=>{context.focusRequest++;focused.push(p.id);focusEntered.resolve();if(waitForFocus)await focusBarrier.promise;},
  focusNeighbourhood:async()=>{context.focusRequest++;areas.push('fairview');focusEntered.resolve();if(waitForFocus)await focusBarrier.promise;},
 };
 // Use the actual UI handlers so the interaction counter cannot silently drift
 // from the startup replay guard while tests still pass.
 runInNewContext(scenarioHandler+compareHandler,context);
 const done=runInNewContext('(async()=>{'+startup+'})()',context);
 return {context,focused,areas,modes,elements,finish:loaded.resolve,done,
  focusEntered:focusEntered.promise,finishFocus:focusBarrier.resolve,
  chooseScenario:value=>context.$('#scenarioSelect').onchange({target:{value}}),
  chooseComparison:checked=>context.$('#compareToggle').onchange({target:{checked}})};
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
test('a scenario link restores its valid scenario after initial project focus',async()=>{
 const run=start({scenario:'existing'});run.finish();await run.done;
 assert.deepEqual(run.focused,['square-one-block22']);assert.deepEqual(run.modes,['existing']);
});
test('comparison replay uses the normal comparison controls at the midpoint',async()=>{
 const run=start({scenario:'comparison'});run.finish();await run.done;
 assert.equal(run.context.compare,true);assert.equal(run.context.split,.5);
 assert.equal(run.elements.get('#compareRange').value,50);
 assert.equal(run.elements.get('#compareToggle').checked,true);
 assert.equal(run.elements.get('#scenarioTag').textContent,'EXISTING CITY / FUTURE SCENARIO');
});
test('unknown URL scenarios do not change the displayed mode',async()=>{
 const run=start({scenario:'untrusted-mode'});run.finish();await run.done;
 assert.deepEqual(run.modes,[]);assert.equal(run.context.compare,false);
});
test('a scenario chosen while the initial district loads wins over URL replay',async()=>{
 const run=start({scenario:'existing'});run.chooseScenario('construction');run.finish();await run.done;
 assert.deepEqual(run.modes,['construction']);assert.equal(run.context.mode,'construction');
});
test('a comparison choice while project assets load wins over URL replay',async()=>{
 const run=start({scenario:'existing',waitForFocus:true});run.finish();await run.focusEntered;
 run.chooseComparison(true);run.finishFocus();await run.done;
 assert.equal(run.context.compare,true);assert.deepEqual(run.modes,[]);
});
test('a later district navigation during initial project focus prevents scenario replay',async()=>{
 const run=start({scenario:'existing',waitForFocus:true});run.finish();await run.focusEntered;
 run.context.focusRequest++;run.context.current={id:'port-credit'};run.context.window.atlasReady='port-credit';
 run.finishFocus();await run.done;
 assert.deepEqual(run.modes,[]);assert.equal(run.context.current.id,'port-credit');
});
test('a later project choice during initial focus prevents stale scenario replay',async()=>{
 const run=start({scenario:'construction',waitForFocus:true});run.finish();await run.focusEntered;
 run.context.focusRequest++;run.finishFocus();await run.done;
 assert.deepEqual(run.modes,[]);
});
test('a Fairview link focuses its context then restores scenario without requiring a project',async()=>{
 const run=start({project:null,district:'citywide',area:'fairview',scenario:'existing'});
 run.finish();await run.done;
 assert.deepEqual(run.areas,['fairview']);assert.deepEqual(run.focused,[]);assert.deepEqual(run.modes,['existing']);
});
test('Fairview and project startup increments are both included in the replay token',async()=>{
 const run=start({district:'citywide',area:'fairview',scenario:'existing'});run.finish();await run.done;
 assert.deepEqual(run.areas,['fairview']);assert.deepEqual(run.focused,['square-one-block22']);assert.deepEqual(run.modes,['existing']);
});

const focusAreaSource=app.slice(app.indexOf('async function focusNeighbourhood()'),app.indexOf('\nconst fairviewLink='));
function areaFocus({district='citywide',aspect=1,waitForLoad=false}={}){
 const loaded=deferred(),loads=[],urls=[],elements=new Map();let updates=0;
 const context={focusRequest:0,current:{id:district},window:{atlasReady:district},neighbourhoodAsset:{},
  THREE,camera:new THREE.PerspectiveCamera(35,aspect,.1,50000),
  controls:{target:new THREE.Vector3(),cursor:new THREE.Vector3(),update:()=>{}},
  defaultViewDirection:()=>new THREE.Vector3(1,.8,1).normalize(),
  setSelectedStudy:()=>{},settleControls:()=>{},invalidate:()=>{},wrap:{scrollIntoView:()=>{}},
  history:{replaceState:(_state,_title,url)=>urls.push(url)},updateNeighbourhood:()=>updates++,
  $:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);},
  loadDistrict:async(id,request)=>{loads.push(id);if(waitForLoad)await loaded.promise;if(request===context.focusRequest){context.current={id};context.window.atlasReady=id;}},
 };
 const done=runInNewContext('('+focusAreaSource+')()',context);
 return {context,loads,urls,done,finish:loaded.resolve,get updates(){return updates;}};
}
test('Fairview focus stays in ready Citywide and frames nearby detail on desktop and phone',async()=>{
 for(const aspect of [2,358/380,288/400]){
  const run=areaFocus({aspect});await run.done;
  assert.deepEqual(run.loads,[]);assert.equal(run.context.current.id,'citywide');
  assert.deepEqual(run.context.controls.target.toArray(),[-4550,85,250]);
  assert(run.context.camera.position.distanceTo(run.context.controls.target)<=2200);
  assert.deepEqual(run.urls,['explore.html?district=citywide&context=fairview']);assert.equal(run.updates,1);
 }
});
test('Fairview focus loads Citywide once from a district and rejects a stale completion',async()=>{
 const direct=areaFocus({district:'downtown'});await direct.done;
 assert.deepEqual(direct.loads,['citywide']);assert.equal(direct.context.current.id,'citywide');
 const stale=areaFocus({district:'downtown',waitForLoad:true});stale.context.focusRequest++;
 stale.context.current={id:'malton'};stale.context.window.atlasReady='malton';stale.finish();await stale.done;
 assert.deepEqual(stale.urls,[]);assert.equal(stale.updates,0);assert.equal(stale.context.current.id,'malton');
});
