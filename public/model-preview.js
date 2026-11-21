import {installBuildingCatalogue} from './building-catalogue.js?v=20261120-plates';
import {fitPerspectiveBox} from './model-preview-framing.js?v=20261028-maritz1';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {drawingPolicy, createFrameScheduler} from './viewer-runtime.js?v=20261025-mobile1';
import {selectPreview, verifiedModelBytes} from './model-preview-loading.js?v=20261113-design2';
import {cityDataNotice} from './city-data-terms.js?v=20261102-coherent1';
import {batchOpaqueStudy} from './model-preview-batching.js?v=20261025-1';
import {buildingFeedbackHTML,bindBuildingFeedback} from './building-feedback.js?v=20261028-improvements1';
import {loadModelRevisions,modelRevisionForProject} from './model-revisions.js?v=20261113-design2';
import {configureStudyCredits} from './model-study-presentation.js?v=20261113-design2';
import {applyPreviewAppearance,previewClipping} from './model-preview-presentation.js?v=20261121-roof';

const $ = id => document.getElementById(id);
const response = await fetch('data/model-previews.json?v=20261102-coherent1', {cache:'no-store'});
if (!response.ok) throw new Error('Study catalogue unavailable');
const manifest = await response.json();
const requestedId = new URLSearchParams(location.search).get('model');
const view = selectPreview(manifest, requestedId);
for (const item of manifest.views) $('modelSelect').add(new Option(item.title, item.id));
$('modelSelect').onchange = () => { if ($('modelSelect').value) location.assign('model.html?model=' + encodeURIComponent($('modelSelect').value)); };
if (!view) {
  if(requestedId) $('modelSubtitle').textContent = 'This model is unavailable. Browse the public studies below.';
  installBuildingCatalogue().catch(()=>{$('choiceStatus').textContent='The building catalogue could not load. Use the building studies or reference studies links above.';});
} else {
  document.body.classList.add('model-selected');
  const buildingLink = document.querySelector('.building-back');
  const profile = $('studyProfile');
  if ((profile.dataset.profiles || '').split(' ').includes(view.id)) {
    profile.href = 'building-' + view.id + '.html';
    profile.hidden = false;
    if (buildingLink) {
      buildingLink.href = profile.href;
      buildingLink.textContent = '← Building, photos and location';
    }
  }
  $('studyNotesLink').href = 'study-notes.html#model-' + encodeURIComponent(view.id);
  $('modelSelect').value = view.id; $('modelChooser').hidden = true; $('previewContent').hidden = false;
  $('modelTitle').textContent = view.title; document.title = view.title + ' · Future Mississauga';
  $('modelSubtitle').textContent = view.subtitle.split(' · ')[0];
  const cityProject = ({'mcity-pair':'mcity-1-2','mcity-m1':'mcity-1-2','mcity-m2':'mcity-1-2','mcity-m5':'mcity-5','avia-1':'avia','avia-2':'avia','edge-1':'edge-oro','edge-2':'edge-oro','oro':'edge-oro','artform':'artform','sgm-maritz-6710':'sgm-maritz-6710'})[view.id];
  const projectId=view.projectId||cityProject;
  const feedback=document.createElement('span');feedback.className='project-model-preview';feedback.innerHTML=buildingFeedbackHTML({id:projectId,name:view.title},{viewURL:location.href});$('modelActions').append(feedback);$('modelActions').hidden=false;
  bindBuildingFeedback(feedback,()=>({viewURL:location.href}));
  void loadModelRevisions().then(registry=>{const revision=modelRevisionForProject(registry,manifest,projectId,view.id);if(!revision)return;const paragraph=$('modelRevision');paragraph.hidden=false;paragraph.setAttribute('aria-label','Model revision');const time=document.createElement('time');time.dateTime=revision.updatedOn;time.textContent=revision.label;paragraph.replaceChildren(time);});
  const cityURL=view.cityURL||(cityProject?'explore.html?district='+(cityProject==='sgm-maritz-6710'?'heartland':cityProject==='artform'?'cooksville':'downtown')+'&project='+cityProject:'');
  const viewsNav = $('subjectViews');
  const currentTab = document.createElement('span');
  currentTab.textContent = '3D model';
  currentTab.setAttribute('aria-current', 'page');
  viewsNav.append(currentTab);
  const viewRoutes = new Set();
  function addView(label, url) {
    if (!url || viewRoutes.has(url)) return;
    viewRoutes.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    viewsNav.append(link);
    viewsNav.hidden = false;
  }
  addView('City map', cityURL);
  fetch('data/building-catalogue.json?v=20261120-plates')
    .then(response => response.ok ? response.json() : null)
    .then(catalogue => {
      const building = catalogue?.entries?.find(entry => entry.id === view.id);
      for (const link of building?.links || []) {
        if (link.kind === 'study') addView(link.label, link.url);
      }
    }).catch(() => {});
  if (document.referrer) {
    const directory = new URL(document.referrer);
    if (directory.origin === location.origin && directory.pathname === location.pathname && !directory.searchParams.has('model')) {
      if (buildingLink) {
        buildingLink.href = directory.href;
        buildingLink.textContent = '← All buildings';
      }
    }
  }
  addView('Before and after', view.comparisonURL);
  $('studySummary').textContent = view.summary; $('studyCredit').textContent = view.credit;
  configureStudyCredits(view);
  const assets = view.assets.map(id => manifest.assets.find(a => a.id === id));
  if (assets.some(a => !a)) throw new Error('Incomplete study catalogue');
  const requiresCityTerms = assets.some(asset => asset.cityDataTerms);
  if (requiresCityTerms) {
    $('studyCredit').after(cityDataNotice().element);
  }
  const bytes = new Map(), pending = new Map();
  const status = (message, error = false) => { if(contextLost){message='Graphics paused. Restore the model to continue.';error=true;} $('previewStatus').textContent = message; $('previewStatus').classList.toggle('error', error); };
  async function getBytes(asset) {
    if (bytes.has(asset.id)) return bytes.get(asset.id);
    if (!pending.has(asset.id)) pending.set(asset.id, verifiedModelBytes(asset).then(data => { bytes.set(asset.id, data); return data; }).finally(() => pending.delete(asset.id)));
    return pending.get(asset.id);
  }
  const canvas = $('previewCanvas'), wrap = $('previewWrap');
  let renderer, controls, contextRestorer, restoreTimer, reloadForRecovery = false, contextLost = false, visible = true, ready = false, loadRequest = 0, disposed = false;
  let fitDistance = 1, modelRadius = 1, modelSize = [1,1,1];
  const displayAppearances = [];
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 50000), model = new THREE.Group();
  const clipCentre = new THREE.Vector3();
  scene.background = new THREE.Color('#e8f2f7'); scene.add(model);
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0xb3b1a6, 2.1));
  const light = new THREE.DirectionalLight(0xfff9ef, 2.6); light.position.set(-100, 180, 100); scene.add(light);
  const fill = new THREE.DirectionalLight(0xdbe7ff, .8); fill.position.set(100, 60, -100); scene.add(fill);
  const policy = () => drawingPolicy({width:wrap.clientWidth, height:wrap.clientHeight, pixelRatio:devicePixelRatio, coarse:matchMedia('(any-pointer: coarse)').matches, memory:navigator.deviceMemory || 8});
  const scheduler = createFrameScheduler({canDraw:() => Boolean(renderer && !contextLost && !document.hidden && visible && !disposed), draw:() => { const changed = controls?.update(); if(ready){camera.updateMatrixWorld();const depth=-clipCentre.set(0,0,0).applyMatrix4(camera.matrixWorldInverse).z;const planes=previewClipping(depth,modelRadius);if(camera.near!==planes.near||camera.far!==planes.far){Object.assign(camera,planes);camera.updateProjectionMatrix();}} renderer.render(scene, camera); return changed; }});
  const invalidate = () => scheduler.invalidate();
  function interaction(enabled) {
    if (controls) controls.enabled = enabled && ready && !contextLost;
    canvas.dataset.interact = String(enabled); canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
    $('interactButton').hidden = enabled; $('leaveInteraction').hidden = !enabled;
    if (enabled) canvas.focus({preventScroll:true});
  }
  function disposeModels() {
    for(const appearance of displayAppearances.splice(0))appearance.dispose();
    model.traverse(object => { object.geometry?.dispose(); for (const material of [object.material].flat().filter(Boolean)) material.dispose(); });
    model.clear(); model.position.set(0,0,0);
  }
  function calculateFit() {
    if(view.fitToBounds)return fitPerspectiveBox(modelSize,view.cameraDirection,camera.fov,camera.aspect);
    const vertical = THREE.MathUtils.degToRad(camera.fov), horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    return modelRadius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.08;
  }
  function reset() {
    if (!ready) return;
    controls.target.set(0,0,0); camera.position.copy(new THREE.Vector3(...view.cameraDirection).normalize().multiplyScalar(fitDistance));
    controls.update(); invalidate();
  }
  function resize() {
    if (!renderer || !wrap.clientWidth || !wrap.clientHeight) return;
    const previousFit = fitDistance;
    camera.aspect = wrap.clientWidth / wrap.clientHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(policy().pixelRatio); renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
    if (ready) {
      fitDistance = calculateFit(); camera.position.sub(controls.target).multiplyScalar(fitDistance / previousFit).add(controls.target);
      controls.minDistance = modelRadius * .15; controls.maxDistance = fitDistance * 5;
    }
    invalidate();
  }
  function zoom(factor) { if (ready && !contextLost) { const offset = camera.position.clone().sub(controls.target); offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)); camera.position.copy(controls.target).add(offset); controls.update(); invalidate(); } }
  function rotate(theta, phi = 0) { if (ready && !contextLost) { const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)); spherical.theta += theta; spherical.phi = THREE.MathUtils.clamp(spherical.phi + phi, .08, Math.PI * .49); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update(); invalidate(); } }
  function recoverMessage(message) { ready = false; status(message, true); $('retryModel').hidden = false; interaction(false); }
  async function load() {
    if (!renderer || contextLost || disposed) return;
    const request = ++loadRequest; ready = false; $('retryModel').hidden = true; interaction(false); disposeModels();
    try {
      const loader = new GLTFLoader();
      for (const asset of assets) {
        status('Loading ' + asset.title + '…');
        const data = await getBytes(asset); const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
        if (request !== loadRequest || disposed) { gltf.scene.traverse(o => {o.geometry?.dispose(); for(const m of [o.material].flat().filter(Boolean))m.dispose();}); return; }
        if (asset.batchOpaque) batchOpaqueStudy(gltf.scene, THREE);
        const appearance = applyPreviewAppearance(THREE,gltf.scene,asset);
        if(appearance)displayAppearances.push(appearance);
        gltf.scene.userData.assetId = asset.id; model.add(gltf.scene);
      }
      const bounds = new THREE.Box3().setFromObject(model), centre = bounds.getCenter(new THREE.Vector3());
      modelSize = bounds.getSize(new THREE.Vector3()).toArray();
      modelRadius = Math.hypot(...modelSize) / 2;
      if (!Number.isFinite(modelRadius) || modelRadius <= 0) throw new Error('The model has invalid dimensions.');
      model.position.copy(centre).negate();
      ready = true; resize();
      reset();
      if (contextLost) { status('Graphics paused. Restore the model to continue.', true); $('retryModel').hidden = false; }
      else { status('Model ready. Approximate exterior study.'); invalidate(); }
    } catch (error) { if (request === loadRequest && !disposed) { disposeModels(); recoverMessage(error.message); } }
  }
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true}); renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Acquiring the extension after loss can return null, so retain it now.
    contextRestorer = renderer.getContext().getExtension('WEBGL_lose_context');
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    controls = new OrbitControls(camera,canvas); controls.enableDamping = false; controls.maxPolarAngle = Math.PI * .49;
    controls.addEventListener('change',invalidate); interaction(false); resize();
  } catch { recoverMessage('3D graphics are unavailable. Try another browser to view this study.'); }
  const observer = new ResizeObserver(resize); observer.observe(wrap);
  const intersection = new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; if(visible)invalidate(); else scheduler.pause();}); intersection.observe(wrap);
  document.addEventListener('visibilitychange',() => {if(document.hidden)scheduler.pause(); else invalidate();});
  canvas.addEventListener('webglcontextlost',event => {event.preventDefault(); contextLost = true; scheduler.pause(); status('Graphics paused. Restore the model to continue.',true); $('retryModel').textContent='Restore model'; $('retryModel').hidden=false; interaction(false);});
  canvas.addEventListener('webglcontextrestored',() => {contextLost=false;reloadForRecovery=false;clearTimeout(restoreTimer); $('retryModel').textContent='Retry model'; $('retryModel').hidden=true; status(ready?'Model restored.':'Restoring model…'); if(ready){resize();invalidate();}else load();});
  $('retryModel').onclick = () => {
    if(!renderer || reloadForRecovery){location.reload();return;}
    if(contextLost){
      try{contextRestorer?.restoreContext();}catch{}
      clearTimeout(restoreTimer);
      restoreTimer=setTimeout(()=>{if(contextLost){reloadForRecovery=true;$('retryModel').textContent='Reload viewer';$('previewStatus').textContent='Graphics could not be restored. Reload the viewer to try again.';}},3000);
      return;
    }
    load();
  };
  $('interactButton').onclick = () => {if(ready&&!contextLost)interaction(true);};
  $('leaveInteraction').onclick = () => {interaction(false); $('interactButton').focus({preventScroll:true});};
  $('zoomIn').onclick=()=>zoom(.8); $('zoomOut').onclick=()=>zoom(1.25);
  $('rotateLeft').onclick=()=>rotate(-Math.PI/8); $('rotateRight').onclick=()=>rotate(Math.PI/8); $('resetView').onclick=reset;
  canvas.addEventListener('keydown',event => {
    const actions={ArrowLeft:()=>rotate(-.12),ArrowRight:()=>rotate(.12),ArrowUp:()=>rotate(0,-.1),ArrowDown:()=>rotate(0,.1),'+':()=>zoom(.8),'=':()=>zoom(.8),'-':()=>zoom(1.25),Home:reset,Escape:()=>{interaction(false);$('interactButton').focus({preventScroll:true});}};
    if(actions[event.key]){event.preventDefault();actions[event.key]();}
  });
  window.addEventListener('pagehide',() => {disposed=true;loadRequest++;clearTimeout(restoreTimer);scheduler.pause();observer.disconnect();intersection.disconnect();disposeModels();controls?.dispose();renderer?.dispose();bytes.clear();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  window.modelPreview = {id:view.id,model,camera,controls,renderer,assets,get ready(){return ready&&!contextLost;},get performance(){return {...policy(),frames:scheduler.frames,contextLost};},get decodedBytes(){return [...bytes.values()].reduce((n,b)=>n+b.byteLength,0);}};
  if(renderer && !disposed)await load();
}
