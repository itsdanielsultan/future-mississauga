import {registeredCityPlacements} from './city-model-placements.js?v=20261026-citymodels1';
import {verifiedModelBytes} from './model-preview-loading.js?v=20261025-five1';
import {batchOpaqueStudy} from './model-preview-batching.js?v=20261025-1';

// Only already-published models with documented registration enter the city map.
// M City derivatives are already in map coordinates: never transform them twice.
export const cityStudyPlacements = [
 {id:'mcity-m1-20261025-exterior-study',projectId:'mcity-1-2',assets:['mcity-m1']},
 {id:'mcity-m2-20261025-exterior-study',projectId:'mcity-1-2',assets:['mcity-m2']},
 {id:'avia-20261025-exterior-study',projectId:'avia',assets:['avia-1','avia-2','avia-podium'],translation:[-6040,88.3,-10],
  bounds:[[-6101.200458526611,88.3,-71.33089065551758],[-5980.788055419922,244.82700805664064,52.31731414794922]],
  replacesSourceIds:['63-6237'],
  registration:'Avia Rev02 README: local GLB to City source GLB is translation (-6040,88.3,-10), metres, Y-up. Source x = UTM17N easting - 615000; y = ASL - 70; z = 4827000 - northing. Common zero is a captured source vertex, not a surveyed floor level.'},
 ...registeredCityPlacements
];

export function cityModelStudies(refinements,catalogue){
 const result=refinements.map(asset=>({...asset}));
 for(const placement of cityStudyPlacements){
  const previews=placement.assets.map(id=>catalogue.assets.find(asset=>asset.id===id));
  if(previews.some(asset=>!asset))throw new Error('A registered city model is absent from the public catalogue.');
  const index=result.findIndex(asset=>asset.id===placement.id),prior=index<0?{}:result[index];
  if(!placement.translation&&(!prior.registration||!prior.replacementTriangleKeys?.length))throw new Error('The registered municipal replacement is unavailable.');
  const asset={...prior,...placement,previewAssets:previews,defaultVisible:true,localOptional:true,localReview:true,
   status:placement.status||'Existing',modes:placement.modes||['existing','construction','future'],replacementModes:placement.modes||['existing','construction','future'],
   preserveMaterials:true,preserveSourceNormals:true,uncertainGeometry:true,
   modelFidelity:placement.projectId==='avia'?'Approximate completed exteriors and shared podium, Avia Rev02. Registered to the City source model; facade details and dimensions remain approximate.':placement.modelFidelity||prior.modelFidelity};
  if(index<0)result.push(asset);else result[index]=asset;
 }
 return result;
}

export function presentCityStudyProjects(projects){
 for(const project of projects){
  if(project.id==='mcity-1-2'){
   project.localOptional=false;project.studyActionLabel='Show on map';
   project.geometryCoverage='Approximate completed exteriors, M City Rev02. The City source geometry remains available if the detailed models cannot load.';
   project.modelCaveat=project.modelCaveat?.replace('Optional Rev02 exterior studies','Rev02 exterior studies');
  }else if(project.id==='avia'){
   project.localReview=true;
   project.geometryCoverage='Approximate completed exteriors and shared podium, Avia Rev02, registered to the City source model.';
   project.modelCaveat=project.modelCaveat?.replace('Native City source geometry retained.','City source geometry provides the placement and remains available if the detailed models cannot load. Exterior details and finishes are approximate.');
}else if(project.id==='edge-oro'){
   project.geometryCoverage='Edge 1 and 2 use approximate completed exteriors. Oro keeps the City source model; its July 2020 design is available as a separate preview.';
  }else if(project.id==='artform'){
   project.summary='A completed 17-storey building on Dundas Street East.';
   project.localReview=true;
   project.geometryCoverage='Approximate completed exterior study, Artform Rev03.';
   project.modelCaveat='Aligned to five City footprint points at the original City main-block base without rescaling. The opposite balcony edge differs by about 2 m; the inherited City base sits about 0.5–1 m above mapped terrain at the front and 2.6 m at the rear wing. Podium outlines, finishes and ground contact are approximate.';
  }
 }
}

// A multi-file building is committed atomically. Failure disposes the partial
// assembly; its municipal replacement binding is never activated.
export async function loadCityStudy(THREE,loader,asset,{fetcher=globalThis.fetch,dispose}={}){
 const scene=new THREE.Group(),sourceAssets=[];
 scene.name=asset.id;
 try{
  for(const preview of asset.previewAssets){
   const bytes=await verifiedModelBytes(preview,url=>fetcher(url,{signal:AbortSignal.timeout(60000)}));
   const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   scene.add(gltf.scene);
   if(preview.batchOpaque)batchOpaqueStudy(gltf.scene,THREE);
   sourceAssets.push({root:gltf.scene,url:preview.url,sha256:preview.downloadSHA256});
  }
  if(asset.translation)scene.position.fromArray(asset.translation);
  if(asset.rotationYDegrees)scene.rotation.y=THREE.MathUtils.degToRad(asset.rotationYDegrees);
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene,true),actual=[box.min.toArray(),box.max.toArray()];
  if(box.isEmpty()||actual.some((row,i)=>row.some((value,j)=>!Number.isFinite(value)||Math.abs(value-asset.bounds[i][j])>.02)))throw new Error('The model does not match its registered city bounds.');
  return {scene,sourceAssets};
 }catch(error){dispose?.(scene);throw error;}
}

export function bindStudyReplacement(root,asset){
 root.traverse(object=>{
  if(!object.isMesh||!(asset.replacesSourceIds||[]).includes(object.userData.id))return;
  const bindings=object.userData.sourceReplacements??=[];
  if(!bindings.some(binding=>binding.assetId===asset.id))bindings.push({assetId:asset.id,modes:asset.replacementModes||asset.modes});
 });
}
