// Supplemental models and their municipal fallbacks share one visibility decision.
// The helper is independent of rendering, navigation and district selection.
export function applyModelVisibility(meshes,which,{referenceStudies=false,uncertainVersions=true}={}){
 const visibleAssets=new Set();
 for(const mesh of meshes){
  const d=mesh.userData||{};
  let visible=!d.hiddenObsolete;
  if(d.draftStudy&&!referenceStudies)visible=false;
  if(d.displayStatus!=='Existing'&&d.uncertain&&!uncertainVersions)visible=false;
  if(which==='construction'&&d.displayStatus==='Under Construction'&&!d.recordedProgress)visible=false;
  if(!Array.isArray(d.sourceReplacements)&&d.replacementModes?.includes(which))visible=false;
  const inMode=d.modes?d.modes.includes(which):d.displayStatus==='Existing'||which==='future'||which==='construction'&&d.displayStatus==='Under Construction';
  mesh.visible=visible&&inMode;
  if(mesh.visible&&hasGeometry(mesh)&&d.assetId)visibleAssets.add(d.assetId);
 }
 for(const mesh of meshes){
  if(!mesh.visible)continue;
  const bindings=mesh.userData?.sourceReplacements;
  if(Array.isArray(bindings)&&bindings.some(binding=>binding&&visibleAssets.has(binding.assetId)&&Array.isArray(binding.modes)&&binding.modes.includes(which)))mesh.visible=false;
 }
 const visibleAssetIds=new Set(),representedProjectIds=new Set();
 for(const mesh of meshes){
  if(!mesh.visible||!hasGeometry(mesh))continue;
  const d=mesh.userData||{};
  if(d.assetId)visibleAssetIds.add(d.assetId);
  if(d.projectId)representedProjectIds.add(d.projectId);
 }
 return {visibleAssetIds,representedProjectIds};
}
function hasGeometry(mesh){return mesh.geometry?.attributes?.position?.count>0&&mesh.geometry?.index?.count!==0;}
