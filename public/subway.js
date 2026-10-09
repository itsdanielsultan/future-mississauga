import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {createExistingStyleIndex,applyExistingStyle} from './existing-materials.js?v=20260926-soft-grey';
const $=s=>document.querySelector(s),frame=$('#subwayMap'),canvas=$('#subwayCanvas'),overlay=$('#routeOverlay');
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9ede5');
const camera=new THREE.PerspectiveCamera(35,1,3,70000);
let renderer,controls,dirty=true,ready=false,view='connection',routeId='sherway-dundas',mapData,model,versions=new Map();
const baseContext=new THREE.Group(),futureMeshes=[],labels=[];
const transitGroups={GO:new THREE.Group(),HML:new THREE.Group()};
// Page-only lake crop: the mapped coast is exact; the artificial offshore edge is a display extent.
const subwayWater={url:'models/subway-coastal-water.glb',sha256:'59b01e0f2a24a2fa1e44964a99140956790f313af7a6f78616e5b72eb61382dd'};
let replacedLakeMeshes=0;
const viewSettings={
 downtown:{target:[-5350,105,-300],position:[-3060,2000,1860],caption:'City Centre · a possible western destination'},
 cooksville:{target:[-3670,70,590],position:[-1000,1550,2560],caption:'Cooksville · connections with GO and the Hurontario corridor'},
 sherway:{target:[1410,48,-2858],position:[3500,1450,-850],caption:'Sherway · Toronto’s source massing meets the Mississauga model'},
 kipling:{target:[3144,55,-5676],position:[5300,1550,-3676],caption:'Kipling · the existing Line 2 terminal and Toronto neighbourhood context'},
 connection:{target:[-1400,100,-2250],position:[-1400,9500,9000],caption:'Whole connection · one continuous city view from City Centre to Kipling'}
};
function failure(error){console.error(error);$('#mapLoading').replaceChildren();const p=document.createElement('p');p.textContent='The 3D map could not load.';const b=document.createElement('button');b.textContent='Reload map';b.onclick=()=>location.reload();$('#mapLoading').append(p,b);$('#mapLoading').hidden=false;frame.setAttribute('aria-busy','false');}
async function read(name){const r=await fetch('data/'+name+'.json',{cache:'no-store'});if(!r.ok)throw Error('Map source unavailable: '+name);return r.json();}
function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide,...extra});}
function classify(data,overrides){const o=overrides[data.id]||{},s=(o.latestStatus||o.status||data.Status||'').toLowerCase();if(o.displayStatus==='Uncertain')return'Proposed';if(['Existing','Under Construction','Proposed'].includes(o.displayStatus))return o.displayStatus;if(/complet|occupied|existing|built/.test(s)&&!/part|unbuilt|incomplet|unverified/.test(s))return'Existing';if(/under.?construction|topped|partially.occupied/.test(s)||data.Status==='Under Construction')return'Under Construction';return data.Status==='Existing'?'Existing':'Proposed';}
function settle(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;}
function currentRoute(){return mapData?.routes?.find(r=>r.id===routeId)||mapData?.connection;}
function setRoute(id){
 const route=mapData.routes.find(r=>r.id===id);if(!route)return;
 routeId=id;$('#subwayRoute').value=id;frame.dataset.route=id;
 $('#routeDescription').textContent=route.summary;
 $('#routeSource').href=route.sourceLink;$('#routeSource').textContent=route.sourceLabel;
 $('#areaLabels').replaceChildren();labels.length=0;addLabels();
 const list=$('#connectionAreas');list.replaceChildren();list.style.setProperty('--area-count',route.areas.length);
 for(const area of route.areas){const li=document.createElement('li'),title=document.createElement('strong'),note=document.createElement('span');title.textContent=area.name;note.textContent=area.caption;li.append(title,note);list.append(li);}
 $('#mapRouteName').textContent=route.shortName;
 if(ready&&view==='connection')setView('connection');dirty=true;
}
function fitConnection(){
 const target=new THREE.Vector3(-1305,85,-2575),direction=new THREE.Vector3(0,.68,.74).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=1;
 for(const p of currentRoute()?.points||[[-5753,110,-778],[3144,85,-5676]])for(const dx of [-800,800])for(const dz of [-500,500]){const q=new THREE.Vector3(p[0]+dx,p[1],p[2]+dz).sub(target),depth=q.dot(direction);distance=Math.max(distance,Math.abs(q.dot(right))/(tan*camera.aspect)+depth,Math.abs(q.dot(up))/tan+depth);}
 controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance*1.08);
}
function setView(name){view=name;$('#subwayView').value=name;const v=viewSettings[name];settle();controls.target.fromArray(v.target);camera.position.fromArray(v.position);if(name==='connection')fitConnection();else if(camera.aspect<1.3)camera.position.sub(controls.target).multiplyScalar(1.27).add(controls.target);controls.cursor.copy(controls.target);controls.maxTargetRadius=name==='connection'?6000:3500;controls.maxDistance=name==='connection'?45000:13000;controls.update();$('#viewCaption').textContent=v.caption;frame.dataset.view=name;dirty=true;}
function zoom(factor){settle();const off=camera.position.clone().sub(controls.target);off.setLength(THREE.MathUtils.clamp(off.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(off);controls.update();dirty=true;}
function resize(){const w=frame.clientWidth,h=frame.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const prior=camera.aspect;camera.aspect=w/h;camera.updateProjectionMatrix();overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);if(ready&&Math.abs(prior-camera.aspect)>.2)setView(view);dirty=true;}
function project(pos){return new THREE.Vector3(...pos).project(camera);}
function screen(pos){const p=project(pos);return[(p.x+1)*frame.clientWidth/2,(-p.y+1)*frame.clientHeight/2,p.z];}
function drawOverlay(){
 if(!mapData)return;const coords=currentRoute().points.map(p=>screen(p));let path='',pen=false;
 for(const p of coords){if(p[2]<=-1||p[2]>=1){pen=false;continue;}path+=(pen?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1);pen=true;}
 for(const el of overlay.querySelectorAll('path'))el.setAttribute('d',path);
 const fw=frame.clientWidth,fh=frame.clientHeight,placed=[[fw-62,12,50,160],[12,12,Math.min(220,fw-90),35]];
 for(const label of labels){const [x,y,z]=screen(label.anchor),w=label.width,h=31,shown=x>14&&x<fw-14&&y>60&&y<fh-40&&z>-1&&z<1;
  const candidates=[[x+label.dx,y+label.dy],[x-w/2,y+20],[x-w/2,y-46],[x-w-13,y-15],[x+13,y-15],[x-w/2,y-82],[x-w/2,y+56]].map(([l,t])=>[THREE.MathUtils.clamp(l,12,fw-w-12),t]);
  const position=candidates.find(([l,t])=>t>55&&t+h<fh-30&&!placed.some(b=>l<b[0]+b[2]+6&&l+w>b[0]-6&&t<b[1]+b[3]+6&&t+h>b[1]-6));
  label.g.style.display=shown&&position?'':'none';if(!shown||!position)continue;
  const [left,top]=position;placed.push([left,top,w,h]);label.g.setAttribute('transform',`translate(${x.toFixed(1)},${y.toFixed(1)})`);
  const lx=left-x,ly=top-y;label.rect.setAttribute('x',lx);label.rect.setAttribute('y',ly);label.text.setAttribute('x',lx+12);label.text.setAttribute('y',ly+20);label.line.setAttribute('x2',lx+w/2);label.line.setAttribute('y2',ly+h/2);
 }
}
function addLabels(){const ns='http://www.w3.org/2000/svg';for(const item of currentRoute().areas||mapData.areas){const g=document.createElementNS(ns,'g');g.setAttribute('class','area-label');const line=document.createElementNS(ns,'line');line.setAttribute('x1',0);line.setAttribute('y1',0);const circle=document.createElementNS(ns,'circle');circle.setAttribute('r',4);const rect=document.createElementNS(ns,'rect');const width=item.name.length*7.4+24;rect.setAttribute('width',width);rect.setAttribute('height',31);rect.setAttribute('rx',7);const text=document.createElementNS(ns,'text');text.textContent=item.name;g.append(line,circle,rect,text);$('#areaLabels').append(g);labels.push({g,line,circle,rect,text,width,anchor:item.anchor,dx:item.offset?.[0]||12,dy:item.offset?.[1]||-42});}}
function draw(){renderer.render(scene,camera);drawOverlay();}
function tick(){requestAnimationFrame(tick);if(!controls)return;controls.update();if(dirty&&!document.hidden){draw();dirty=false;}}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.43;controls.minPolarAngle=.08;controls.minDistance=650;controls.maxDistance=26000;controls.screenSpacePanning=false;controls.zoomToCursor=true;controls.zoomSpeed=.65;controls.panSpeed=.8;controls.rotateSpeed=.6;controls.listenToKeyEvents(canvas);controls.addEventListener('change',()=>dirty=true);
 scene.add(new THREE.HemisphereLight(0xf5f7ed,0x718279,2.1),new THREE.AmbientLight(0xe4edf0,.6));const sun=new THREE.DirectionalLight(0xffeedb,2.6);sun.position.set(-7000,9500,5000);sun.target.position.set(-3500,60,-1000);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-6500,right:6500,top:6500,bottom:-6500,near:100,far:25000});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.6;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
 new ResizeObserver(resize).observe(frame);resize();setView(view);tick();
 const [districts,contextAssets,refinements,overrides,styleData,routeData,modelAssetVersions,torontoData,transitData,subwayTransit]=await Promise.all(['districts','context-assets','refinement-models','overrides','existing-building-style','subway-map','model-asset-versions','subway-toronto-context','transit-layer-manifest','subway-transit-context'].map(read));mapData=routeData;setRoute(routeId);
 const index=createExistingStyleIndex(styleData),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),city=districts.find(d=>d.id==='citywide');versions.set('models/citywide.glb',city.sha256.slice(0,16));for(const a of refinements.assets||[])versions.set(a.url,(a.downloadSHA256||a.sha256||'20260926-polish').slice(0,16));for(const [url,hash] of Object.entries(modelAssetVersions.sha256))versions.set(url,hash.slice(0,16));versions.set(subwayWater.url,subwayWater.sha256.slice(0,16));for(const a of [...torontoData.assets,...transitData.assets,...subwayTransit.assets])versions.set(a.url,(a.downloadSHA256||a.sha256).slice(0,16));loader.manager.setURLModifier(url=>url.includes('models/')?url+(url.includes('?')?'&':'?')+'edition='+(versions.get(url)||'20260926-visual-polish'):url);
 const load=async url=>(await loader.loadAsync(url)).scene;
 let completed=0;const contextFiles=contextAssets.citywide,contextLoaded=await Promise.all(contextFiles.map(async url=>{const root=await load(url);$('#mapLoading p').textContent=`Building the city view… ${Math.round(++completed/contextFiles.length*65)}%`;return root;}));for(const root of contextLoaded)baseContext.add(root);
 // Keep every land, road, river and shoreline mesh. Replace only the oversized open-lake surface.
 baseContext.traverse(o=>{if(o.isMesh&&o.name==='LakeOntarioUnified'){o.visible=false;replacedLakeMeshes++;}});
 if(replacedLakeMeshes!==1)throw Error('Expected one citywide open-lake surface for the subway display crop.');
 baseContext.add(await load(subwayWater.url));
 // Municipal Toronto surfaces share the atlas projection and Ontario terrain origin.
 baseContext.add(await load(torontoData.assets.find(a=>a.kind==='ground').url));
 baseContext.traverse(o=>{if(!o.isMesh)return;const name=o.name.toLowerCase(),water=/shore|river|lakeontario/.test(name),color=water?0x829fa6:/road|bridge|parking/.test(name)?0xa0aaa3:/wood/.test(name)?0x8da77b:/park/.test(name)?0xa8b993:0xc6cbbb;o.material=material(color,{roughness:water?.48:.92});o.receiveShadow=true;});scene.add(baseContext);
 // These are native 2025 municipal building faces, not generated extrusion proxies.
 const torontoBuildings=await load(torontoData.assets.find(a=>a.kind==='buildings').url);torontoBuildings.traverse(o=>{if(!o.isMesh)return;o.material=material(o.name.includes('Major')?0x7e878b:0xc8cac3,{flatShading:true});o.castShadow=true;o.receiveShadow=true;});scene.add(torontoBuildings);
 model=await load('models/citywide.glb');const retained=new Map();model.traverse(o=>{if(o.isMesh&&o.userData.id)retained.set(o.userData.id,o);});
 const native=await Promise.all(['models/exchange-textured-phase-aware.glb','models/mcity-m4-plan-derived.glb','models/mcity-m3-upper-envelope.glb'].map(load));native.forEach((g,i)=>{g.traverse(o=>{if(o.isMesh){o.userData.Status=i===0?(o.userData.atlasStatus||'Under Construction'):'Under Construction';o.userData.nativeTexture=i===0;}});model.add(g);});for(const id of ['63-6155','63-6156'])if(retained.has(id))retained.get(id).userData.replaced=true;
 const corridor=[-8500,-7200,4500,3500],adds=(refinements.assets||[]).filter(a=>!a.localOptional&&(!a.bounds||!(a.bounds[1][0]<corridor[0]||a.bounds[0][0]>corridor[2]||a.bounds[1][2]<corridor[1]||a.bounds[0][2]>corridor[3])));
 for(const a of adds){const g=await load(a.url);for(const id of a.replacesSourceIds||[])if(retained.has(id))retained.get(id).userData.replacementModes=a.replacementModes||a.modes;g.traverse(o=>{if(!o.isMesh)return;Object.assign(o.userData,{Status:a.status,modes:a.modes,nativeTexture:!!a.preserveMaterials,uncertain:!!a.uncertainGeometry||a.status==='Uncertain',assetId:a.id||a.assetId});});model.add(g);}
 model.updateMatrixWorld(true);const materials={Existing:material(0xffffff,{vertexColors:true}),'Under Construction':material(0x82aaba),Proposed:material(0xd9a598),Uncertain:material(0xb59ac3)};model.traverse(o=>{if(!o.isMesh)return;const d=o.userData,ov=overrides[d.id]||{},status=classify(d,overrides);d.displayStatus=status;d.hiddenObsolete=!!(ov.excludeSuperseded||ov.excludeDuplicate||d.replaced);d.uncertain=d.uncertain||ov.includeInVerifiedScenario===false;o.castShadow=true;o.receiveShadow=true;if(!d.nativeTexture){if(status==='Existing')applyExistingStyle(THREE,o,index);o.material=materials[status==='Existing'?'Existing':d.uncertain?'Uncertain':status];}futureMeshes.push(o);});scene.add(model);
 // Use the atlas's authored tracks and depth-tested service markings in the same 3D scene.
 // Keep these separate from terrain recolouring and from the future-buildings switch.
 const transitAssets=transitData.assets.filter(a=>a.districtId==='citywide'&&['GO','HML'].includes(a.system));
 for(const system of ['GO','HML'])if(transitAssets.filter(a=>a.system===system).length!==1)throw Error('Missing citywide transit layer: '+system);
 const transitColours=transitData.serviceColours;
 for(const a of [...transitAssets,...subwayTransit.assets]){
  if(!transitGroups[a.system])throw Error('Unknown subway transit system');
  const root=await load(a.url),guideMaterial=new THREE.MeshBasicMaterial({color:transitColours[a.system],depthTest:true,depthWrite:true,toneMapped:false,side:THREE.DoubleSide});
  root.traverse(o=>{if(!o.isMesh)return;o.userData.layerCategory=a.system;o.renderOrder=0;
   if(o.userData.geometryRole==='service-guide'){o.material=guideMaterial;o.castShadow=false;o.receiveShadow=false;}
   else{o.castShadow=true;o.receiveShadow=true;}
  });
  transitGroups[a.system].add(root);
 }
 for(const [system,group] of Object.entries(transitGroups)){group.name=system==='GO'?'GO rail network':'Hurontario LRT network';scene.add(group);}
 function updateTransit(){transitGroups.GO.visible=$('#goToggle').checked;transitGroups.HML.visible=$('#lrtToggle').checked;frame.dataset.goVisible=String(transitGroups.GO.visible);frame.dataset.lrtVisible=String(transitGroups.HML.visible);dirty=true;}
 $('#goToggle').onchange=updateTransit;$('#lrtToggle').onchange=updateTransit;updateTransit();
 frame.dataset.transit='loaded';frame.dataset.goContinuation='Kipling';
 function updateMode(){const future=$('#futureToggle').checked,mode=future?'future':'existing';futureMeshes.forEach(o=>{const d=o.userData;o.visible=!d.hiddenObsolete&&(d.displayStatus==='Existing'||!d.uncertain)&&!d.replacementModes?.includes(mode)&&(d.modes?d.modes.includes(mode):future||d.displayStatus==='Existing');});dirty=true;}
 $('#futureToggle').onchange=updateMode;updateMode();$('#routeToggle').onchange=e=>{overlay.hidden=!e.target.checked;overlay.style.display=e.target.checked?'':'none';frame.dataset.overlay=String(e.target.checked);};$('#subwayView').onchange=e=>setView(e.target.value);$('#mapZoomIn').onclick=()=>zoom(.8);$('#mapZoomOut').onclick=()=>zoom(1.25);$('#mapReset').onclick=()=>setView(view);canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));canvas.addEventListener('keydown',e=>{if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')setView(view);else zoom(e.key==='-'?1.25:.8);}});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failure(Error('3D graphics context interrupted.'));});
 $('#subwayRoute').onchange=e=>setRoute(e.target.value);$('#subwayRoute').disabled=false;
 ready=true;setView(view);frame.dataset.torontoBuildingCount=String(torontoData.buildingCount);frame.dataset.torontoEdition=torontoData.sourceEdition;frame.dataset.torontoCoverage='Sherway to Kipling';frame.dataset.torontoContext='loaded';frame.dataset.ready='true';frame.dataset.view=view;frame.dataset.overlay='true';frame.dataset.loadedBuildingMeshes=String(futureMeshes.length);frame.dataset.waterContext='coastal-400m-pier-context';frame.dataset.replacedLakeMeshes=String(replacedLakeMeshes);frame.setAttribute('aria-busy','false');$('#mapLoading').hidden=true;dirty=true;
}catch(error){failure(error);}
