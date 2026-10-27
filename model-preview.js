import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {drawingPolicy, createFrameScheduler} from './viewer-runtime.js?v=20261025-mobile1';
import {selectPreview, verifiedModelBytes} from './model-preview-loading.js?v=20261025-five1';
import {cityDataNotice} from './city-data-terms.js?v=20261026-direct1';
import {batchOpaqueStudy} from './model-preview-batching.js?v=20261025-1';

const $ = id => document.getElementById(id);
const response = await fetch('data/model-previews.json?v=20261025-five1');
if (!response.ok) throw new Error('Study catalogue unavailable');
const manifest = await response.json();
const requestedId = new URLSearchParams(location.search).get('model');
const view = selectPreview(manifest, requestedId);
for (const item of manifest.views) {
  $('modelSelect').add(new Option(item.title, item.id));
  const link = document.createElement('a'); link.className = 'button';
  link.href = 'model.html?model=' + encodeURIComponent(item.id); link.textContent = item.title;
  $('previewLinks').append(link);
}
$('modelSelect').onchange = () => { if ($('modelSelect').value) location.assign('model.html?model=' + encodeURIComponent($('modelSelect').value)); };
if (!view) {
  $('choiceStatus').textContent = requestedId ? 'This model link is unavailable. Choose an available study below.' : 'Choose a model to explore and download.';
} else {
  $('modelSelect').value = view.id; $('modelChooser').hidden = true; $('previewContent').hidden = false;
  $('modelTitle').textContent = view.title; document.title = view.title + ' · Future Mississauga';
  $('modelSubtitle').textContent = view.subtitle;
  const cityProject = ({'mcity-pair':'mcity-1-2','mcity-m1':'mcity-1-2','mcity-m2':'mcity-1-2','avia-1':'avia','avia-2':'avia','edge-1':'edge-oro','edge-2':'edge-oro','oro':'edge-oro','artform':'artform'})[view.id];
  if(cityProject){const link=document.createElement('a');link.href='explore.html?district='+(cityProject==='artform'?'cooksville':'downtown')+'&project='+cityProject;link.textContent='View in the city map ↗';const paragraph=document.createElement('p');paragraph.append(link);$('modelSubtitle').after(paragraph);}
  $('studySummary').textContent = view.summary; $('studyCredit').textContent = view.credit;
  $('studyLimits').textContent = view.limits; $('rightsNote').textContent = view.rights;
  $('downloadNote').textContent = view.downloadNote || 'GLB downloads contain the displayed study geometry. Keep the credits and limitations with the model.';
  for (const source of view.sources) {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = source.url; a.textContent = source.title; a.target = '_blank'; a.rel = 'noopener';
    li.append(a); if (source.note) li.append(document.createTextNode(' — ' + source.note)); $('modelSources').append(li);
  }
  const assets = view.assets.map(id => manifest.assets.find(a => a.id === id));
  if (assets.some(a => !a)) throw new Error('Incomplete study catalogue');
  const requiresCityTerms = assets.some(asset => asset.cityDataTerms);
  if (requiresCityTerms) {
    $('modelDownloads').before(cityDataNotice().element);
  }
  const bytes = new Map(), pending = new Map(), downloadButtons = [];
  const status = (message, error = false) => { if(contextLost){message='Graphics paused. Restore the model to continue.';error=true;} $('previewStatus').textContent = message; $('previewStatus').classList.toggle('error', error); };
  async function getBytes(asset) {
    if (bytes.has(asset.id)) return bytes.get(asset.id);
    if (!pending.has(asset.id)) pending.set(asset.id, verifiedModelBytes(asset).then(data => { bytes.set(asset.id, data); return data; }).finally(() => pending.delete(asset.id)));
    return pending.get(asset.id);
  }
  for (const asset of assets) {
    const button = document.createElement('button'); button.dataset.download = asset.id;
    button.textContent = 'Download ' + asset.title + ' GLB · ' + (asset.decodedBytes / 1e6).toFixed(1) + ' MB';
    button.onclick = async () => {
      button.disabled = true; status('Preparing ' + asset.title + ' download…');
      try {
        const data = await getBytes(asset);
        const url = URL.createObjectURL(new Blob([data], {type: 'model/gltf-binary'}));
        const a = document.createElement('a'); a.href = url; a.download = asset.downloadName; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status('Download prepared. Please keep the credits and limitations with the model.');
      } catch (error) { status(error.message, true); }
      finally { button.disabled = false; }
    };
    $('modelDownloads').append(button); downloadButtons.push(button);
    const compressed = document.createElement('a'); compressed.href = asset.url; compressed.download = asset.url.split('/').pop();
    compressed.textContent = asset.title + ': compressed GLB (' + (asset.bytes / 1e6).toFixed(2) + ' MB)'; $('compressedDownloads').append(compressed);
  }

  const canvas = $('previewCanvas'), wrap = $('previewWrap');
  let renderer, controls, contextRestorer, restoreTimer, reloadForRecovery = false, contextLost = false, visible = true, ready = false, loadRequest = 0, disposed = false;
  let fitDistance = 1, modelRadius = 1;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 50000), model = new THREE.Group();
  scene.background = new THREE.Color('#e8eef0'); scene.add(model);
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0xb3b1a6, 2.1));
  const light = new THREE.DirectionalLight(0xfff9ef, 2.6); light.position.set(-100, 180, 100); scene.add(light);
  const fill = new THREE.DirectionalLight(0xdbe7ff, .8); fill.position.set(100, 60, -100); scene.add(fill);
  const policy = () => drawingPolicy({width:wrap.clientWidth, height:wrap.clientHeight, pixelRatio:devicePixelRatio, coarse:matchMedia('(any-pointer: coarse)').matches, memory:navigator.deviceMemory || 8});
  const scheduler = createFrameScheduler({canDraw:() => Boolean(renderer && !contextLost && !document.hidden && visible && !disposed), draw:() => { const changed = controls?.update(); renderer.render(scene, camera); return changed; }});
  const invalidate = () => scheduler.invalidate();
  function interaction(enabled) {
    if (controls) controls.enabled = enabled && ready && !contextLost;
    canvas.dataset.interact = String(enabled); canvas.style.touchAction = enabled ? 'none' : 'pan-y pinch-zoom';
    $('interactButton').hidden = enabled; $('leaveInteraction').hidden = !enabled;
    if (enabled) canvas.focus({preventScroll:true});
  }
  function disposeModels() {
    model.traverse(object => { object.geometry?.dispose(); for (const material of [object.material].flat().filter(Boolean)) material.dispose(); });
    model.clear(); model.position.set(0,0,0);
  }
  function calculateFit() {
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
        gltf.scene.userData.assetId = asset.id; model.add(gltf.scene);
      }
      const bounds = new THREE.Box3().setFromObject(model), centre = bounds.getCenter(new THREE.Vector3());
      modelRadius = bounds.getSize(new THREE.Vector3()).length() / 2;
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
  } catch { recoverMessage('3D graphics are unavailable. You can still download the model and credits.'); }
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
      restoreTimer=setTimeout(()=>{if(contextLost){reloadForRecovery=true;$('retryModel').textContent='Reload viewer';$('previewStatus').textContent='Graphics could not be restored. Reload the viewer or use the model download.';}},3000);
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
