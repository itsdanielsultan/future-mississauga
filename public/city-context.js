import {loadNeighbourContext,disposeContextGroup,setCoverageMask,geometryBytes} from './neighbour-context.js?v=20261023-refined1';
// On-demand geographic orientation from the existing published city overview.
// Geometry is never moved or rescaled. Four display planes prevent overlap with
// the selected detailed study, and distant buildings are existing source only.
export function createCityContext({THREE, scene, renderer, loader, contextURLs, classify, overrides, styleExisting, districts=[], onChange=()=>{}, onStatus=()=>{}, onMetrics=()=>{}}) {
  const root = new THREE.Group(); root.name = 'Surrounding city overview'; root.visible = false; scene.add(root);
  const planes = [new THREE.Plane(),new THREE.Plane(),new THREE.Plane(),new THREE.Plane()];
  renderer.localClippingEnabled = true;
  let pending, ready = false, wanted = false, current;
  const overviewBuildings=[];let neighbours,neighbourPending,neighbourToken=0;
  const colourFor = name => /shore|river|lakeontario/.test(name)?0x638b98:/road|bridge/.test(name)?0x8b9190:/wood/.test(name)?0x698555:/park/.test(name)?0x9aaa7c:0xc4c7bb;
  function setDistrict(district) {
    current = district; const b = district.bounds;
    planes[0].set(new THREE.Vector3(-1,0,0),b[0]); planes[1].set(new THREE.Vector3(1,0,0),-b[2]);
    planes[2].set(new THREE.Vector3(0,0,-1),b[1]); planes[3].set(new THREE.Vector3(0,0,1),-b[3]);
    root.visible = wanted && ready && district.id !== 'citywide';
    overviewBuildings.forEach(o=>setCoverageMask(THREE,o.material,[district.bounds,...(neighbours?.districtId===district.id?neighbours.bounds:[])]));
    if(root.visible)refreshNeighbours().catch(()=>{});
  }
  async function refreshNeighbours(){
    if(!wanted||!ready||!current||current.id==='citywide')return;
    const district=current;
    if(neighbours?.districtId===district.id)return;
    if(neighbourPending?.districtId===district.id)return neighbourPending.promise;
    const previous=neighbourPending?.promise,token=++neighbourToken;
    disposeContextGroup(neighbours?.root);neighbours=null;overviewBuildings.forEach(o=>setCoverageMask(THREE,o.material,[district.bounds]));
    onStatus('Loading nearby buildings…');
    const promise=Promise.resolve(previous).catch(()=>{}).then(()=>loadNeighbourContext({THREE,district,districts,loader,planes,classify,overrides,styleExisting,isCurrent:()=>token===neighbourToken&&current.id===district.id&&wanted})).then(result=>{
      if(token!==neighbourToken||current.id!==district.id||!wanted){disposeContextGroup(result.root);return;}
      neighbours={...result,districtId:district.id};root.add(result.root);overviewBuildings.forEach(o=>setCoverageMask(THREE,o.material,[district.bounds,...result.bounds]));onMetrics({...result.metrics,contextGeometryBytes:geometryBytes(root)});
      onStatus('Nearby existing buildings and wider city loaded. Detail varies with the available source models.');onChange();
    }).catch(error=>{if(token===neighbourToken){onStatus('Wider city loaded. Nearby building detail could not load; switch this option off and on to retry.');onChange();}}).finally(()=>{if(neighbourPending?.token===token)neighbourPending=null;});
    neighbourPending={districtId:district.id,token,promise};return promise;
  }
  async function load() {
    if (ready) return;
    if (pending) return pending;
    pending = (async()=>{
      const urls = [...contextURLs,'models/citywide.glb'];
      const staged = new THREE.Group(); let index = 0, failed = false;
      try {
        const results = await Promise.allSettled(Array.from({length:3},async()=>{
          while(!failed && index < urls.length) {
            const url = urls[index++];
            let gltf;
            try {gltf = await loader.loadAsync(url);} catch(error) {failed = true; throw error;}
            const buildings = url === 'models/citywide.glb';
            staged.add(gltf.scene);
            gltf.scene.traverse(o=>{
              if (!o.isMesh) return;
              const d = o.userData, ov = overrides[d.id] || {};
              if (buildings && (classify(d)!=='Existing'||ov.excludeSuperseded||ov.excludeDuplicate)) {o.visible=false; return;}
              if (!buildings && (d.id || d.Status)) {o.visible=false; return;}
              if (buildings) {styleExisting(o);overviewBuildings.push(o);}
              o.material = new THREE.MeshStandardMaterial({color:buildings?0xffffff:colourFor(o.name.toLowerCase()),vertexColors:buildings,roughness:.9,side:THREE.DoubleSide,flatShading:true,clippingPlanes:buildings?[]:planes,clipIntersection:true});
              o.castShadow=false; o.receiveShadow=false;
            });
          }
        }));
        const rejected = results.find(result=>result.status==='rejected');
        if(rejected)throw rejected.reason;
        while(staged.children.length)root.add(staged.children[0]);
        ready = true; if (current) setDistrict(current);
      } catch (error) {
        staged.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m?.dispose();}});overviewBuildings.length=0;
        throw error;
      } finally {pending=null;}
    })();
    return pending;
  }
  return {setDistrict, async setEnabled(enabled){wanted=enabled;if(!enabled){neighbourToken++;}if(enabled){await load();await refreshNeighbours();}if(current)setDistrict(current);},get enabled(){return wanted;},get ready(){return ready;}};
}
