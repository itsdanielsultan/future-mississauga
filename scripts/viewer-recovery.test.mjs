import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {shouldLoadRefinement} from '../public/refinement-loading.js';

// Run the real handlers with deferred network/encoding work. These tests cover
// state transitions that synchronous source assertions cannot establish.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function element(){return {hidden:false,disabled:false,style:{},attributes:{},children:[],textContent:'',
 setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
 replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},
 classList:{toggle(){}},click(){}};}
function dom(){const elements=new Map();return {elements,$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);}};}

function exportHarness(){
 const {$}=dom(),fonts=deferred(),encoding=deferred(),metadata=deferred(),events=[],urls=[];
 const output={width:0,height:0,getContext:()=>({fillRect(){},fillText(){},drawImage(){events.push('copy');}}),
  toBlob(callback){events.push('encode');encoding.promise.then(callback);}};
 const context={$,exporting:false,contextLost:false,current:{id:'downtown',name:'Downtown'},window:{atlasReady:'downtown'},
  selectedStudyProjectId:null,projectById:new Map(),compare:false,mode:'future',exportImageURL:null,
  document:{fonts:{load:()=>fonts.promise},createElement:type=>type==='canvas'?output:element(),createTextNode:text=>text},
  clearExportImage(){},render(){events.push('render');},canvas:{width:600,height:400},
  presentationLayout:()=>({height:60,scale:1}),exportCreditLines:()=>['City of Mississauga'],displayedSources:{osm:false},
  drawPresentationFooter(){},projectNorth:()=>null,THREE,camera:{},controls:{target:{}},
  withPNGMetadata:()=>{events.push('metadata');return metadata.promise;},
  URL:{createObjectURL:blob=>{urls.push(blob);return 'blob:test';}}};
 runInNewContext(section("$('#exportBtn').onclick=async()=>{",'function drawFrame(){'),context);
 return {context,$,fonts,encoding,metadata,events,urls,start:()=>$('#exportBtn').onclick()};
}

for(const stage of ['fonts','encoding','metadata'])test(`context loss during ${stage} never offers a blank PNG or re-enables Save`,async()=>{
 const run=exportHarness(),done=run.start();
 if(stage!=='fonts'){run.fonts.resolve();await settle();assert.deepEqual(run.events.slice(0,2),['render','copy']);}
 if(stage==='metadata'){run.encoding.resolve({png:true});await settle();assert(run.events.includes('metadata'));}
 run.context.contextLost=true;
 run.fonts.resolve();run.encoding.resolve({png:true});run.metadata.resolve({tagged:true});await done;
 assert.equal(run.urls.length,0);assert.equal(run.$('#exportBtn').disabled,true);
 assert.equal(run.context.exporting,false);assert.match(run.$('#exportStatus').textContent,/could not be saved/);
 if(stage==='fonts')assert.deepEqual(run.events,[]);
});

test('a healthy export renders immediately before copying the non-preserved WebGL buffer',async()=>{
 const run=exportHarness(),done=run.start();run.fonts.resolve();await settle();
 assert.deepEqual(run.events,['render','copy','encode']);
 run.encoding.resolve({png:true});await settle();run.metadata.resolve({tagged:true});await done;
 assert.equal(run.urls.length,1);assert.equal(run.$('#exportBtn').disabled,false);
 assert.equal(run.$('#exportStatus').children[0],'Image ready.');
});

function districtHarness(){
 const {$}=dom(),base=deferred(),optional=deferred(),errors=[],invalidations=[],id='streetsville';
 const context={$,THREE,current:null,model:null,context:null,contextLost:false,exporting:false,loadToken:0,focusRequest:0,mode:'future',
  districts:[{id,name:'Streetsville',bounds:[0,0,10,10]}],notes:{},treeDataCache:{},window:{atlasReady:null,dispatchEvent(){}},
  document:{baseURI:'https://local.invalid/',querySelectorAll:()=>[],createTextNode:text=>text,createElement:()=>element()},
  wrap:$('#sceneWrap'),controls:{enabled:true},surroundingCity:{setDistrict(){}},contextAssets:{},
  loadModelAsset:async(_loader,url)=>{if(url===`models/${id}.glb`)await base.promise;return {scene:new THREE.Group()};},
  loader:{},versionedTreeURL:x=>x,assetVersions:new Map(),modelAssetVersions:{sha256:{}},URL,DOMException,
  visibleAttribution:{registerAsset(){},refresh(){}},refinementData:{assets:[],constructionEvidence:[]},
  transitLayers:{assets:[]},landscapeLayers:{assets:[]},splitSourceOverlaps:()=>[],overrides:{},
  addTrees:async()=>{},adoptContextModelVisibility(){},dispose(){},scene:new THREE.Group(),
  addArchitecturalEdges:()=>({layers:[]}),makeMarkers(){},applyVisibility(){},renderProjects(){},
  showStudyLoadStatus(){},cancelCameraFlight(){},setSelectedStudy(){},closeModelSearch(){},reset(){},updateTransit(){},
  ensureOptionalRefinements:()=>optional.promise,invalidate:()=>invalidations.push(context.window.atlasReady),history:{replaceState(){}},CustomEvent:class{},
  console:{error:error=>errors.push(error)}};
 runInNewContext(section('async function loadDistrict(', 'const optionalRefinementLoaders='),context);
 return {context,$,base,optional,errors,invalidations,start:()=>context.loadDistrict(id)};
}

test('committed municipal scene is interactive while optional studies are still loading',async()=>{
 const run=districtHarness(),done=run.start();run.base.resolve();await settle();assert.deepEqual(run.errors,[]);
 assert.equal(run.context.window.atlasReady,'streetsville');assert.equal(run.context.controls.enabled,true);
 assert.equal(run.$('#exportBtn').disabled,false);assert.equal(run.$('#sceneWrap').attributes['aria-busy'],'false');
 assert(run.invalidations.includes('streetsville'),'committed baseline requests a frame before optional downloads finish');
 assert.equal(run.$('#loading').style.display,'none');run.optional.resolve();await done;
});

test('district completion preserves the context-loss recovery overlay and disabled controls',async()=>{
 const run=districtHarness(),done=run.start();
 run.context.contextLost=true;run.$('#loading').textContent='Waiting to reconnect';
 run.$('#loading').children=['Reload map'];run.$('#loading').style.display='grid';
 run.base.resolve();await settle();assert.deepEqual(run.errors,[]);
 assert.equal(run.context.window.atlasReady,'streetsville');assert.equal(run.context.controls.enabled,false);
 assert.equal(run.$('#exportBtn').disabled,true);assert.equal(run.$('#loading').style.display,'grid');
 assert.equal(run.$('#loading').textContent,'Waiting to reconnect');assert.deepEqual(run.$('#loading').children,['Reload map']);
 run.optional.resolve();await done;assert.equal(run.context.controls.enabled,false);
});

test('a failed district finishes busy state and leaves an actionable retry',async()=>{
 const run=districtHarness(),done=run.start();run.base.reject(new Error('offline'));await done;
 assert.equal(run.context.window.atlasReady,null);assert.equal(run.context.controls.enabled,false);
 assert.equal(run.$('#sceneWrap').attributes['aria-busy'],'false');assert.equal(run.$('#exportBtn').disabled,true);
 assert.equal(run.$('#loading').style.display,'grid');assert.equal(run.$('#loading').children.at(-1).textContent,'Try again');
});

test('late optional failure cannot undo Return to current view or restore its retry notice',async()=>{
 const {$}=dom(),pending=deferred(),model={},messages=[];
 const manager={has:()=>false,load:()=>pending.promise};
 const context={$,model,loadToken:1,current:{id:'downtown',bounds:[0,0,10,10]},window:{atlasReady:'downtown'},
  studyStatusRequest:0,selectedStudyProjectId:'mcity',draftToggle:{checked:false},
  optionalRefinementLoaders:new WeakMap([[model,manager]]),refinementData:{assets:[{id:'m1',projectId:'mcity',localOptional:true}]},
  shouldLoadRefinement,showStudyLoadStatus:(message,retry=false)=>messages.push({message,retry}),
  studyNotice:{},studyNoticeText:{},console:{warn(){}}};
 runInNewContext(section('async function ensureOptionalRefinements(){','function modelDownloads(p)'),context);
 runInNewContext(section('function setSelectedStudy(project){','leaveStudyButton.onclick='),context);
 const done=context.ensureOptionalRefinements();assert.match(messages.at(-1).message,/Loading/);
 context.setSelectedStudy(null);$('#modelSearchStatus').textContent='Current view restored.';
 pending.reject(new Error('offline'));await done;
 assert.equal(messages.at(-1).message,'');assert.equal(messages.at(-1).retry,false);
 assert.equal($('#modelSearchStatus').textContent,'Current view restored.');assert.equal(context.studyNotice.hidden,true);
});
