import {indirectSourceRegions} from './source-attribution-regions.js?v=20261023-refined1';
// Match actual source metadata, never generic fidelity notes or a railway name.
// Rules are audited against the saved City, transit, airfield and Voya assets.
const OSM = /OpenStreetMap|\bOSM\b|openstreetmap\.org/i;
const MARITZ_DESIGN_CREDIT = 'Design: SG&M Architects Inc. (formerly Sirlin Giller & Malek Architects).';
export function usesOpenStreetMap(data = {}, name = '') {
  return /^OSM-/i.test(name) || /^osm-beach-/i.test(data.id || '') ||
    OSM.test(String(data.source || '')) ||
    /^HML mapped\/inferred route polylines/i.test(String(data.source || '')) ||
    OSM.test(JSON.stringify(data.sources || []));
}

export function createVisibleAttribution({THREE, scene, camera, regions=indirectSourceRegions}) {
  const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), assets = new WeakMap();
  let candidates = [], indirect = [], unknown = [], designCandidates = [];
  function registerAsset(root, url, sha256) {assets.set(root,{url,sha256});}
  function refresh() {
    candidates = []; indirect = []; unknown = []; designCandidates = [];
    scene.traverse(object => {
      if (object.isMesh && usesOpenStreetMap(object.userData, object.name)) candidates.push(object);
      if (object.isMesh && object.userData?.projectId === 'sgm-maritz-6710' &&
          object.userData?.assetId === 'sgm-maritz-6710-exterior-study') designCandidates.push(object);
      const asset=assets.get(object);
      if(!asset)return;
      const matches=regions.filter(region=>region.assetUrl===asset.url);
      if(!matches.length)return;
      const meshes=[];object.traverse(child=>{if(child.isMesh)meshes.push(child);});
      if(matches.some(region=>region.assetSHA256!==asset.sha256)) {
        // A changed source-dependent asset must be reviewed before credit is removed.
        unknown.push(...meshes);return;
      }
      for(const region of matches)indirect.push({root:object,meshes,modes:region.modes,box:new THREE.Box3(new THREE.Vector3(...region.boxModel[0]),new THREE.Vector3(...region.boxModel[1]))});
    });
  }
  function isShown(object) {
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return object.geometry?.attributes?.position?.count > 0 && object.geometry?.index?.count !== 0 &&
      [object.material].flat().some(material => material?.visible !== false && material?.opacity !== 0);
  }
  function visible(object) {return isShown(object) && frustum.intersectsObject(object);}
  function update(mode='future') {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return {
      osm:candidates.some(visible)||unknown.some(visible)||indirect.some(region=>region.modes.includes(mode)&&region.meshes.some(isShown)&&frustum.intersectsBox(region.box)),
      designCredits:designCandidates.some(visible)?[MARITZ_DESIGN_CREDIT]:[]
    };
  }
  refresh();
  return {registerAsset,refresh,update};
}

export function exportCreditLines({osm,designCredits=[]}) {
  const lines = ['City of Mississauga · Contains information licensed under the Open Government Licence – Ontario.'];
  lines.push(...designCredits);
  if (osm) lines.push('OpenStreetMap: openstreetmap.org/copyright · Sources: futuremississauga.com/sources.html');
  else lines.push('Sources: futuremississauga.com/sources.html');
  return lines;
}
