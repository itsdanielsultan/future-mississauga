import {ALDO_ROOF_SOURCE,createModelAppearance} from './model-appearance.js?v=20261121-roof';
import {VOYA_ARCHITECTURAL_SOURCE,voyaArchitecturalRole} from './voya-appearance.js?v=20261113-design2';

// A standalone model is centred at the origin. Tighten the depth range around
// its bounding sphere every frame, including after orbiting, zooming or panning.
export function previewClipping(centreDepth,radius){
  if(!Number.isFinite(centreDepth)||!Number.isFinite(radius)||radius<=0)throw new Error('Invalid model bounds');
  const near=Math.max(.05,centreDepth-radius*1.15);
  return {near,far:Math.max(near+radius*2,centreDepth+radius*1.15)};
}

export function applyPreviewAppearance(THREE,scene,asset){
  const source=asset.id==='voya'?VOYA_ARCHITECTURAL_SOURCE:asset.id===ALDO_ROOF_SOURCE.assetId?ALDO_ROOF_SOURCE:null;
  if(!source||asset.downloadSHA256!==source.sha256)return null;
  const appearance=createModelAppearance(THREE);
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    Object.assign(mesh.userData,{assetId:source.assetId,projectId:source.projectId,sourceAssetSHA256:asset.downloadSHA256});
    if(source===ALDO_ROOF_SOURCE||voyaArchitecturalRole(mesh))appearance.register(mesh,{authored:true});
  });
  return appearance;
}
