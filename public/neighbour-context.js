// Reuse a bounded selection of the already-published detailed area files.
// These are source components, not claims about complete physical buildings.
export function chooseNeighbourDistricts(district,districts,maxBytes=36000000) {
 const b=district.bounds,pad=1000,points=[];
 for(let i=0;i<=24;i++)for(let j=0;j<=24;j++){
  const x=b[0]-pad+(b[2]-b[0]+pad*2)*i/24,z=b[1]-pad+(b[3]-b[1]+pad*2)*j/24;
  if(x<b[0]||x>b[2]||z<b[1]||z>b[3])points.push([x,z]);
 }
 let remaining=points,bytes=0;const chosen=[],candidates=districts.filter(d=>d.id!==district.id&&d.id!=='citywide');
 while(chosen.length<4){
  const ranked=candidates.filter(d=>!chosen.includes(d)&&bytes+d.bytes<=maxBytes).map(d=>{const q=d.bounds,cover=remaining.filter(([x,z])=>x>=q[0]&&x<=q[2]&&z>=q[1]&&z<=q[3]);return {d,cover,score:cover.length/Math.pow(d.bytes/1e6,.4)};}).filter(d=>d.cover.length).sort((a,b)=>b.score-a.score);
  if(!ranked.length)break;const {d,cover}=ranked[0];chosen.push(d);bytes+=d.bytes;const covered=new Set(cover);remaining=remaining.filter(p=>!covered.has(p));
 }
 return chosen;
}
export function disposeContextGroup(group){
 group?.traverse(o=>{if(o.isMesh){o.geometry?.dispose();for(const material of [o.material].flat())material?.dispose();}});group?.removeFromParent();
}
// Coverage masks partition overlapping published crops without changing vertices.
// A selection is not a boundary: this only prevents duplicate source surfaces.
export function setCoverageMask(THREE,material,rectangles){
 let state=material.userData.coverageMask;
 if(!state){
  state={rectangles:{value:Array.from({length:5},()=>new THREE.Vector4())},count:{value:0}};material.userData.coverageMask=state;
  material.onBeforeCompile=shader=>{
   shader.uniforms.coveredRectangles=state.rectangles;shader.uniforms.coveredRectangleCount=state.count;
   shader.vertexShader='varying vec2 contextWorldXZ;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncontextWorldXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
   shader.fragmentShader='varying vec2 contextWorldXZ;\nuniform vec4 coveredRectangles[5];\nuniform int coveredRectangleCount;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfor(int i=0;i<5;i++){if(i>=coveredRectangleCount)break;vec4 r=coveredRectangles[i];if(contextWorldXZ.x>=r.x&&contextWorldXZ.y>=r.y&&contextWorldXZ.x<=r.z&&contextWorldXZ.y<=r.w)discard;}');
  };
  material.customProgramCacheKey=()=> 'source-context-coverage-v1';material.needsUpdate=true;
 }
 state.count.value=Math.min(rectangles.length,5);rectangles.slice(0,5).forEach((b,i)=>state.rectangles.value[i].set(...b));
}
export function geometryBytes(root){
 const buffers=new Set();root.traverse(o=>{if(o.isMesh){for(const a of Object.values(o.geometry.attributes))buffers.add((a.isInterleavedBufferAttribute?a.data.array:a.array).buffer);if(o.geometry.index)buffers.add(o.geometry.index.array.buffer);}});return [...buffers].reduce((n,b)=>n+b.byteLength,0);
}
export async function loadNeighbourContext({THREE,district,districts,loader,classify,overrides,styleExisting,isCurrent=()=>true}){
 const start=performance.now(),selected=chooseNeighbourDistricts(district,districts),root=new THREE.Group(),loaded=[];root.name='Nearby existing City source components';let index=0,failed=false,residentBytes=0,peakGeometryBytes=0,renderMeshes=0;
 try{
  const results=await Promise.allSettled(Array.from({length:2},async()=>{
   while(!failed&&isCurrent()&&index<selected.length){
    const order=index++,d=selected[order];let gltf;try{gltf=await loader.loadAsync('models/'+d.id+'.glb');}catch(error){failed=true;throw error;}
    loaded.push(gltf.scene);residentBytes+=geometryBytes(gltf.scene);peakGeometryBytes=Math.max(peakGeometryBytes,residentBytes);
    if(residentBytes>160000000){failed=true;throw new Error('Nearby geometry exceeded its 160 MB memory budget');}
    if(!isCurrent())continue;gltf.scene.updateMatrixWorld(true);
    const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
    for(const o of meshes){
     const data=o.userData,ov=overrides[data.id]||{};
     if(classify(data)!=='Existing'||ov.excludeSuperseded||ov.excludeDuplicate){o.visible=false;continue;}
     // Nearby files contain native City context, without the active study's
     // refinement assets. Keep its source faces; a manifest replacement alone
     // cannot justify deleting the fallback. Coverage masks hide active-area overlap.
     // Anonymous low-rise batches already contain reviewed source positions.
     // A neutral finish avoids an expensive per-face recolouring pass here.
     if(data.id)styleExisting(o);
     const material=new THREE.MeshStandardMaterial({color:data.id?0xffffff:0xc8cac3,vertexColors:Boolean(data.id),roughness:.78,flatShading:true,side:THREE.DoubleSide});
     setCoverageMask(THREE,material,[district.bounds,...selected.slice(0,order).map(n=>n.bounds)]);
     for(const old of [o.material].flat())old?.dispose();o.material=material;o.castShadow=false;o.receiveShadow=false;renderMeshes++;
    }
    root.add(gltf.scene);residentBytes=loaded.reduce((n,g)=>n+geometryBytes(g),0);peakGeometryBytes=Math.max(peakGeometryBytes,residentBytes);
    if(residentBytes>160000000){failed=true;throw new Error('Nearby geometry exceeded its 160 MB memory budget');}
    // Let area switching and the map remain responsive between decoded files.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }));
  const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
  if(!isCurrent()){disposeContextGroup(root);return {root:new THREE.Group(),bounds:[],metrics:{cancelled:true}};}
  const retainedGeometryBytes=geometryBytes(root);peakGeometryBytes=Math.max(peakGeometryBytes,retainedGeometryBytes);
  return {root,bounds:selected.map(d=>d.bounds),metrics:{durationMs:Math.round(performance.now()-start),payloadBytes:selected.reduce((n,d)=>n+d.bytes,0),peakGeometryBytes,retainedGeometryBytes,drawObjects:renderMeshes,files:selected.map(d=>d.id)}};
 }catch(error){disposeContextGroup(root);throw error;}finally{for(const group of loaded)if(!group.parent)disposeContextGroup(group);}
}
