import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {runInNewContext} from 'node:vm';
import {OHN_VERSION,restorePreOHNVersions} from './offshore-context-scope.mjs';
register('./recovery-three-loader.mjs',import.meta.url);
const THREE=await import('../public/vendor/three.module.js');
const {GLTFLoader}=await import('../public/vendor/addons/loaders/GLTFLoader.js');
const {prepareOffshoreContext,isPreparedOffshore,usesOHNOffshore,OHN_ASSET_URL,OHN_SOURCE,OHN_CREDIT}=await import('../public/offshore-context.js');
const {createVisibleAttribution,exportCreditLines}=await import('../public/source-attribution.js');
const {applyModelVisibility}=await import('../public/model-visibility.js');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const json=path=>JSON.parse(read(path)),app=read('app.js').toString();
const source=read(OHN_ASSET_URL),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const load=()=>new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');
const meshes=root=>{const rows=[];root.traverse(object=>{if(object.isMesh)rows.push(object);});return rows;};
const prepare=root=>prepareOffshoreContext(THREE,root,{district:'lakeview',url:OHN_ASSET_URL,sha256:OHN_VERSION.sha256});
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('hex');
const geometryState=mesh=>({geometry:mesh.geometry,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,bytes(a.array)])),index:bytes(mesh.geometry.index.array)});
const materialState=material=>({material,color:material.color.toArray(),roughness:material.roughness,metalness:material.metalness,opacity:material.opacity,map:material.map});

test('OHN binds one exact accepted source only to Lakeview without changing existing version records',()=>{
 assert.equal(source.length,5668);assert.equal(hash(source),OHN_VERSION.sha256);assert.equal(OHN_ASSET_URL,OHN_VERSION.url);
 const versions=json('data/model-asset-versions.json'),context=json('data/context-assets.json');
 assert.deepEqual(context.lakeview,['models/lakeview-context.glb',OHN_ASSET_URL]);
 assert.deepEqual(Object.entries(context).filter(([,urls])=>urls.includes(OHN_ASSET_URL)).map(([id])=>id),['lakeview']);
 assert.equal(versions.sha256[OHN_ASSET_URL],OHN_VERSION.sha256);
 const original=structuredClone(versions),restored=restorePreOHNVersions(versions);
 assert.deepEqual(versions,original,'fixture restoration never mutates input');
 assert.equal(Object.keys(restored.sha256).length,Object.keys(versions.sha256).length-1);
 for(const [url,pin]of Object.entries(restored.sha256))assert.equal(pin,versions.sha256[url]);
 for(const changed of [undefined,'0'.repeat(64)]){const bad=structuredClone(versions);bad.sha256[OHN_ASSET_URL]=changed;assert.throws(()=>restorePreOHNVersions(bad),/exact reviewed OHN version/);}
 const extra=structuredClone(versions);extra.sha256['models/unreviewed-context.glb']='f'.repeat(64);
 assert.equal(restorePreOHNVersions(extra).sha256['models/unreviewed-context.glb'],'f'.repeat(64),'unrelated additions remain subject to old frozen fingerprints');
});

test('actual decoded OHN geometry, identity transform and intrinsic PBR survive preparation byte for byte',async()=>{
 const {scene}=await load(),[mesh]=meshes(scene);assert.equal(meshes(scene).length,1);
 scene.updateMatrixWorld(true);const geometry=geometryState(mesh),material=materialState(mesh.material),extras=structuredClone(mesh.userData);
 assert.equal(mesh.geometry.attributes.position.count,93);assert.equal(mesh.geometry.index.count/3,91);
 assert.deepEqual(mesh.matrixWorld.toArray(),new THREE.Matrix4().toArray());
 assert.equal(prepare(scene),true);assert(isPreparedOffshore(mesh));assert(usesOHNOffshore(mesh.userData));
 assert.deepEqual(geometryState(mesh),geometry);assert.deepEqual(materialState(mesh.material),material);
 assert.deepEqual(mesh.matrixWorld.toArray(),new THREE.Matrix4().toArray());
 for(const [key,value]of Object.entries(extras))assert.deepEqual(mesh.userData[key],value,'original extra '+key);
 for(const [key,value]of Object.entries(OHN_SOURCE))assert.deepEqual(mesh.userData[key],value,'source metadata '+key);
 assert.deepEqual([mesh.castShadow,mesh.receiveShadow,mesh.renderOrder],[false,false,-1]);
 assert.deepEqual([mesh.material.depthWrite,mesh.material.depthTest,mesh.material.flatShading,mesh.material.side],[false,true,true,THREE.DoubleSide]);
 assert.equal(mesh.material.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
 assert.equal(prepare(scene),true);assert.equal(meshes(scene).length,1,'repeat preparation adds no mesh');
 assert.deepEqual(geometryState(mesh),geometry);assert.deepEqual(materialState(mesh.material),material);
 const native=json('data/model-asset-versions.json').sha256['models/lakeview-context.glb'];
 assert.equal(hash(read('models/lakeview-context.glb')),native,'retained native context file still matches its pinned version');
});

for(const [name,change]of [
 ['district',(_root,b)=>{b.district='port-credit';}],['hash',(_root,b)=>{b.sha256='0'.repeat(64);}],
 ['translated parent',root=>{root.position.x=1;}],['scaled mesh',root=>{meshes(root)[0].scale.y=2;}],
 ['extra mesh',root=>{root.add(meshes(root)[0].clone());}],['wrong source',root=>{meshes(root)[0].userData.sourceSHA256='0'.repeat(64);}],
 ['wrong revision',root=>{meshes(root)[0].userData.sourceAssetRevision='offshore-margin-v1';}],
 ['status tint',root=>{meshes(root)[0].material.color.set('#ff0000');}],
 ['shader hook',root=>{meshes(root)[0].material.onBeforeCompile=()=>{};}],
 ['missing indices',root=>{meshes(root)[0].geometry.setIndex(null);}]
])test('OHN rejects '+name+' without accepting the mesh',async()=>{
 const {scene}=await load(),binding={district:'lakeview',url:OHN_ASSET_URL,sha256:OHN_VERSION.sha256};change(scene,binding);
 assert.throws(()=>prepareOffshoreContext(THREE,scene,binding),/Offshore source/);
 for(const mesh of meshes(scene))assert.equal(isPreparedOffshore(mesh),false);
});

test('unrelated assets receive no preparation and cannot opt out through copied metadata',async()=>{
 const {scene}=await load(),mesh=meshes(scene)[0],before=materialState(mesh.material);
 assert.equal(prepareOffshoreContext(THREE,scene,{district:'port-credit',url:'models/port-credit-context.glb',sha256:'unrelated'}),false);
 assert.equal(isPreparedOffshore(mesh),false);assert.deepEqual(materialState(mesh.material),before);
 assert.equal(usesOHNOffshore({...OHN_SOURCE,sourceAssetSHA256:'0'.repeat(64)}),false);
 assert.equal(usesOHNOffshore({...OHN_SOURCE,sourceSHA256:'0'.repeat(64)}),false);
 assert.equal(usesOHNOffshore({...OHN_SOURCE,sourceAssetRevision:'v1'}),false);
});

function creditScene(root){
 const scene=new THREE.Scene();scene.add(root);scene.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),centre=box.getCenter(new THREE.Vector3());
 const camera=new THREE.PerspectiveCamera(45,1,1,20000);camera.position.copy(centre).add(new THREE.Vector3(0,6000,0));camera.up.set(0,0,-1);camera.lookAt(centre);camera.updateMatrixWorld();
 return {scene,camera,attribution:createVisibleAttribution({THREE,scene,camera,regions:[]})};
}
test('actual water credits follow all three scenarios, hidden material/parent, camera and unload',async()=>{
 const {scene:root}=await load();prepare(root);const mesh=meshes(root)[0],{scene,camera,attribution}=creditScene(root);
 for(const mode of ['existing','construction','future']){
  const data=attribution.update(mode);assert.deepEqual(data.designCredits,[OHN_CREDIT]);assert.deepEqual(data.creditLinks,[{label:OHN_SOURCE.sourceDataset,url:OHN_SOURCE.sourceURL}]);assert.equal(data.osm,false);
  const lines=exportCreditLines(data);assert.equal(lines.filter(line=>line===OHN_CREDIT).length,1);assert(lines.some(line=>line.includes(OHN_SOURCE.sourceCredits[1])));
 }
 for(const hidden of [root,mesh]){hidden.visible=false;assert.deepEqual(attribution.update().designCredits,[]);hidden.visible=true;}
 mesh.material.opacity=0;assert.deepEqual(attribution.update().creditLinks,[]);mesh.material.opacity=1;
 mesh.material.visible=false;assert.deepEqual(attribution.update().designCredits,[]);mesh.material.visible=true;
 const position=camera.position.clone();camera.position.x+=30000;camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,0,-1)));assert.deepEqual(attribution.update().designCredits,[]);
 camera.position.copy(position);camera.lookAt(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));assert.deepEqual(attribution.update().designCredits,[OHN_CREDIT]);
 scene.remove(root);attribution.refresh();assert.deepEqual(attribution.update().designCredits,[]);assert.deepEqual(attribution.update().creditLinks,[]);
});

test('visible OHN provider/link reaches the actual map credit DOM and saved-image notice',async()=>{
 const {scene:root}=await load();prepare(root);const {attribution}=creditScene(root);
 const element=()=>({children:[],hidden:false,append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
 const credit=element(),state={visibleDesignCredit:credit,visibleCreditKey:'',displayedSources:{},URL,document:{querySelectorAll:()=>[],createTextNode:text=>({textContent:text}),createElement:()=>element()}};
 const start=app.indexOf('function syncVisibleAttribution('),end=app.indexOf('const assetVersions=',start);
 runInNewContext(app.slice(start,end),state);state.syncVisibleAttribution(attribution.update());
 assert.equal(credit.hidden,false);assert(credit.children.some(child=>child.href===OHN_SOURCE.sourceURL&&child.textContent===OHN_SOURCE.sourceDataset));
 assert.equal(credit.children.map(child=>child.textContent).join(''),OHN_CREDIT);
 root.visible=false;state.syncVisibleAttribution(attribution.update());assert.equal(credit.hidden,true);assert.deepEqual(credit.children,[]);
 const page=read('sources.html').toString(),licences=read('licenses/CREDITS.md').toString();
 for(const text of [OHN_SOURCE.sourceURL,OHN_SOURCE.licenceURL,OHN_SOURCE.sourceCredits[1]])assert(page.includes(text),text);
 assert(licences.includes(OHN_CREDIT));assert(licences.includes(OHN_SOURCE.sourceCredits[1]));
});

// Execute the real asynchronous district attachment and scenario code. Only
// unrelated network packages/UI are fixtures; OHN decoding and preparation are real.
function districtHarness({holdOffshore=false}={}){
 const elements=new Map(),element=()=>({hidden:false,disabled:false,checked:true,style:{},textContent:'',children:[],setAttribute(){},classList:{toggle(){}},replaceChildren(...v){this.children=v;},append(v){this.children.push(v);}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const errors=[],requests=[],disposed=[],parsed=[],gates=[];
 const dispose=root=>{if(!root)return;root.removeFromParent();root.traverse(object=>{if(object.isMesh){disposed.push(object);object.geometry.dispose();object.material.dispose();}});};
 const state={$,THREE,prepareOffshoreContext,isPreparedOffshore,applyModelVisibility,current:null,model:null,context:null,framedProject:null,contextLost:false,exporting:false,loadToken:0,focusRequest:0,mode:'future',
  districts:[{id:'lakeview',name:'Lakeview',bounds:[0,0,5000,5000]},{id:'streetsville',name:'Streetsville',bounds:[0,0,10,10]}],treeDataCache:{},window:{atlasReady:null,dispatchEvent(){}},
  document:{baseURI:'https://local.invalid/',querySelectorAll:()=>[],createTextNode:text=>text,createElement:element},wrap:$('#sceneWrap'),controls:{enabled:true,target:new THREE.Vector3()},camera:new THREE.PerspectiveCamera(),
  surroundingCity:{enabled:true,setDistrict(){}},contextAssets:json('data/context-assets.json'),citywideDetail:{clear(){}},localNeighbourhood:{clear(){}},syncCameraCoverage(){},updateNeighbourhood(){},getHarbornTerrainContract:async()=>null,
  loadModelAsset:async(_loader,url)=>{requests.push(url);if(url===OHN_ASSET_URL){const asset=await load();parsed.push(asset.scene);if(holdOffshore)await new Promise(resolve=>gates.push(resolve));return asset;}return {scene:new THREE.Group()};},
  loader:{},versionedTreeURL:url=>url,assetVersions:new Map(),modelAssetVersions:json('data/model-asset-versions.json'),URL,DOMException,visibleAttribution:{registerAsset(){},refresh(){}},refinementData:{assets:[],constructionEvidence:[]},transitLayers:{assets:[]},landscapeLayers:{assets:[]},splitSourceOverlaps:()=>[],overrides:{},addTrees:async()=>{},adoptContextModelVisibility(){},dispose,scene:new THREE.Scene(),appearance:{register(){}},makeMarkers(){},renderProjects(){},showStudyLoadStatus(){},cancelCameraFlight(){},setSelectedStudy(){},closeModelSearch(){},reset(){},updateTransit(){},ensureOptionalRefinements:async()=>{},invalidate(){},history:{replaceState(){}},CustomEvent:class{},console:{error:error=>errors.push(error)},
  draftToggle:{checked:false},selectedStudyProjectId:null,modelMeshes:[],treeMeshes:[],detailMeshes:[],markers:[],projectById:new Map(),transitGroup:{},markerGroup:{},syncStatusLegend(){}};
 runInNewContext(app.slice(app.indexOf('let visibilityCacheKey='),app.indexOf('let statusLegendSignature=')),state);
 runInNewContext(app.slice(app.indexOf('async function loadDistrict('),app.indexOf('const neighbourhoodAsset=')),state);
 return {state,errors,requests,disposed,parsed,gates};
}
test('actual district lifecycle retains one OHN mesh in all modes, removes it inland, and loads one on return',async()=>{
 const run=districtHarness(),{state}=run;await state.loadDistrict('lakeview');assert.deepEqual(run.errors,[]);assert.equal(state.window.atlasReady,'lakeview');
 let [mesh]=meshes(state.context).filter(isPreparedOffshore);assert(mesh);assert.equal(run.requests.filter(url=>url===OHN_ASSET_URL).length,1);const before=materialState(mesh.material),geometry=geometryState(mesh);
 for(const mode of ['existing','construction','future','existing']){state.applyVisibility(mode);assert.equal(mesh.visible,true);assert.equal(meshes(state.scene).filter(isPreparedOffshore).length,1);assert.deepEqual(materialState(mesh.material),before);assert.deepEqual(geometryState(mesh),geometry);}
 await state.loadDistrict('streetsville');assert.deepEqual(run.errors,[]);assert.equal(meshes(state.scene).filter(isPreparedOffshore).length,0);assert.equal(run.disposed.filter(row=>row===mesh).length,1);
 await state.loadDistrict('lakeview');assert.deepEqual(run.errors,[]);const current=meshes(state.scene).filter(isPreparedOffshore);assert.equal(current.length,1);assert.notEqual(current[0],mesh);assert.equal(run.requests.filter(url=>url===OHN_ASSET_URL).length,2);
});

test('a late OHN request after leaving Lakeview cannot attach water or retain its resources',async()=>{
 const run=districtHarness({holdOffshore:true}),{state}=run;const old=state.loadDistrict('lakeview');
 while(!run.gates.length)await new Promise(resolve=>setImmediate(resolve));
 const mesh=meshes(run.parsed[0])[0];await state.loadDistrict('streetsville');run.gates[0]();await old;
 assert.deepEqual(run.errors,[]);assert.equal(state.window.atlasReady,'streetsville');assert.equal(meshes(state.scene).filter(isPreparedOffshore).length,0);assert.equal(run.disposed.filter(row=>row===mesh).length,1);
});
