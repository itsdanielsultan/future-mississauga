import {loadNeighbourContext,disposeContextGroup,setCoverageMask,geometryBytes} from './neighbour-context.js?v=20261025-mobile1';

// Coarse-pointer and memory-constrained devices still get source-backed city
// orientation, without automatically decoding several additional district files.
// This is a resource policy, not device or posture detection.
export function cityContextBudget({coarsePointer=globalThis.matchMedia?.('(any-pointer: coarse)').matches??false,deviceMemory=globalThis.navigator?.deviceMemory}={}) {
  const compact=coarsePointer||(Number.isFinite(deviceMemory)&&deviceMemory<=4);
  return {compact,concurrency:compact?1:3,maxGeometryBytes:compact?192000000:320000000,
    neighbours:{maxBytes:compact?0:36000000,maxFiles:compact?0:4,maxGeometryBytes:compact?0:160000000,concurrency:compact?1:2}};
}

// On-demand geographic orientation from the existing published city overview.
// Geometry is never moved or rescaled. Display masks prevent overlap with the
// selected detailed study; source attribution and fallback faces are retained.
export function createCityContext({THREE,scene,renderer,loader,contextURLs,classify,overrides,styleExisting,districts=[],resourceBudget=cityContextBudget(),onChange=()=>{},onStatus=()=>{},onMetrics=()=>{}}) {
  const root=new THREE.Group();root.name='Surrounding city overview';root.visible=false;scene.add(root);
  const planes=[new THREE.Plane(),new THREE.Plane(),new THREE.Plane(),new THREE.Plane()];
  renderer.localClippingEnabled=true;
  let pending,ready=false,wanted=false,current,epoch=0,staged;
  const overviewBuildings=[];let neighbours,neighbourPending,neighbourToken=0;
  const colourFor=name=>/shore|river|lakeontario/.test(name)?0x638b98:/road|bridge/.test(name)?0x8b9190:/wood/.test(name)?0x698555:/park/.test(name)?0x9aaa7c:0xc4c7bb;
  const isWanted=()=>wanted&&current?.id!=='citywide';
  function updateMasks(){
    if(!current)return;
    const b=current.bounds;
    planes[0].set(new THREE.Vector3(-1,0,0),b[0]);planes[1].set(new THREE.Vector3(1,0,0),-b[2]);
    planes[2].set(new THREE.Vector3(0,0,-1),b[1]);planes[3].set(new THREE.Vector3(0,0,1),-b[3]);
    overviewBuildings.forEach(o=>setCoverageMask(THREE,o.material,[b,...(neighbours?.districtId===current.id?neighbours.bounds:[])]));
    root.visible=isWanted()&&ready;
  }
  function releaseNeighbours(){
    neighbourToken++;disposeContextGroup(neighbours?.root);neighbours=null;
  }
  function release(){
    epoch++;releaseNeighbours();
    // Dispose decoded children immediately, and discard any in-flight result
    // when it arrives. GLTFLoader cannot abort decoding a request already begun.
    for(const child of [...root.children])disposeContextGroup(child);
    if(staged)for(const child of [...staged.children])disposeContextGroup(child);
    overviewBuildings.length=0;ready=false;root.visible=false;onChange();
  }
  function setDistrict(district){
    if(current?.id!==district.id)releaseNeighbours();
    current=district;
    if(district.id==='citywide'){release();return;}
    updateMasks();
    if(isWanted())ensure().catch(()=>{onStatus('The surrounding city could not load. Switch this option off and on to retry.');onChange();});
  }
  async function refreshNeighbours(){
    if(!isWanted()||!ready||!current)return;
    if(!resourceBudget.neighbours.maxFiles){
      onStatus('Wider city loaded. Nearby fine detail stays off on this device to keep the map responsive.');
      onMetrics({compact:true,files:[],contextGeometryBytes:geometryBytes(root)});return;
    }
    const district=current;
    if(neighbours?.districtId===district.id)return;
    if(neighbourPending?.districtId===district.id&&neighbourPending.token===neighbourToken)return neighbourPending.promise;
    const previous=neighbourPending?.promise;releaseNeighbours();const token=neighbourToken;
    updateMasks();onStatus('Loading nearby buildings…');
    const active=()=>token===neighbourToken&&current.id===district.id&&isWanted();
    const promise=Promise.resolve(previous).catch(()=>{}).then(()=>loadNeighbourContext({THREE,district,districts,loader,classify,overrides,styleExisting,...resourceBudget.neighbours,maxGeometryBytes:Math.max(0,Math.min(resourceBudget.neighbours.maxGeometryBytes,resourceBudget.maxGeometryBytes-geometryBytes(root))),isCurrent:active})).then(result=>{
      if(!active()){disposeContextGroup(result.root);return;}
      neighbours={...result,districtId:district.id};root.add(result.root);updateMasks();
      onMetrics({...result.metrics,contextGeometryBytes:geometryBytes(root)});
      onStatus('Nearby existing buildings and wider city loaded. Detail varies with the available source models.');onChange();
    }).catch(()=>{if(active()){onStatus('Wider city loaded. Nearby building detail could not load; switch this option off and on to retry.');onChange();}}).finally(()=>{if(neighbourPending?.token===token)neighbourPending=null;});
    neighbourPending={districtId:district.id,token,promise};return promise;
  }
  async function load(){
    if(ready||!isWanted())return;
    // A quick off/on waits for the old decoder before starting another batch.
    if(pending){await pending;return load();}
    const token=epoch,active=()=>token===epoch&&isWanted();
    const task=(async()=>{
      const urls=[...contextURLs,'models/citywide.glb'],batch=new THREE.Group(),buildingMeshes=[];
      staged=batch;let index=0,failed=false;
      try{
        const results=await Promise.allSettled(Array.from({length:resourceBudget.concurrency},async()=>{
          while(!failed&&active()&&index<urls.length){
            const url=urls[index++];let gltf;
            try{gltf=await loader.loadAsync(url);}catch(error){failed=true;throw error;}
            if(!active()||failed){disposeContextGroup(gltf.scene);continue;}
            const buildings=url==='models/citywide.glb';batch.add(gltf.scene);
            const replacedMaterials=new Set();
            gltf.scene.traverse(o=>{
              if(!o.isMesh)return;
              const d=o.userData,ov=overrides[d.id]||{};
              if(buildings&&(classify(d)!=='Existing'||ov.excludeSuperseded||ov.excludeDuplicate)){o.visible=false;return;}
              if(!buildings&&(d.id||d.Status)){o.visible=false;return;}
              if(buildings){styleExisting(o);buildingMeshes.push(o);}
              for(const material of [o.material].flat())if(material)replacedMaterials.add(material);
              o.material=new THREE.MeshStandardMaterial({color:buildings?0xffffff:colourFor(o.name.toLowerCase()),vertexColors:buildings,roughness:.9,side:THREE.DoubleSide,flatShading:true,clippingPlanes:buildings?[]:planes,clipIntersection:true});
              o.castShadow=false;o.receiveShadow=false;
            });
            // Dispose only replaced material instances no other mesh retains.
            gltf.scene.traverse(o=>{for(const material of [o.material].flat())replacedMaterials.delete(material);});
            replacedMaterials.forEach(material=>material.dispose());
            if(geometryBytes(batch)>resourceBudget.maxGeometryBytes){failed=true;throw new Error('Surrounding city exceeded its memory budget');}
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }));
        const rejected=results.find(result=>result.status==='rejected');
        if(rejected&&active())throw rejected.reason;
        if(!active())return;
        while(batch.children.length)root.add(batch.children[0]);
        overviewBuildings.push(...buildingMeshes);ready=true;updateMasks();onChange();
      }finally{
        disposeContextGroup(batch);if(staged===batch)staged=null;
      }
    })();
    pending=task;
    try{await task;}finally{if(pending===task)pending=null;}
  }
  async function ensure(){await load();if(isWanted()&&ready)await refreshNeighbours();}
  return {setDistrict,async setEnabled(enabled){wanted=Boolean(enabled);if(!wanted){release();return;}await ensure();updateMasks();},get enabled(){return wanted;},get ready(){return ready;}};
}
