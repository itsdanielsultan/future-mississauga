import {legacyLifecycle,inactiveLifecycle} from './model-status-materials.js?v=20261101-status2';
// Supplemental models and their municipal fallbacks share one visibility decision.
// The helper is independent of rendering, navigation and district selection.
export function applyModelVisibility(meshes,which,{referenceStudies=false,selectedStudyProjectId=null,unknownStatuses,uncertainVersions}={}){
 const showUnknown=unknownStatuses??uncertainVersions??true;
 const visibleAssets=new Set();
 for(const mesh of meshes){
  const d=mesh.userData||{},lifecycle=d.lifecycle||legacyLifecycle(d.displayStatus||d.Status);
  const selectedHistoricalStudy=d.draftStudy&&d.projectId===selectedStudyProjectId;
  let visible=!d.hiddenObsolete;
  if(inactiveLifecycle(lifecycle)&&!selectedHistoricalStudy)visible=false;
  if(d.draftStudy&&!referenceStudies&&d.projectId!==selectedStudyProjectId)visible=false;
  if((lifecycle==='unknown'||lifecycle==='mixed')&&!showUnknown)visible=false;
  if(which==='construction'&&lifecycle==='under_construction'&&!d.recordedProgress&&!d.constructionDesign)visible=false;
  if(!Array.isArray(d.sourceReplacements)&&d.replacementModes?.includes(which))visible=false;
  const lifecycleInMode=lifecycle==='existing'||which==='future'||which==='construction'&&lifecycle==='under_construction';
  const inMode=lifecycleInMode&&(!d.modes||d.modes.includes(which));
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
