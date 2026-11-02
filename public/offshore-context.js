// Source-qualified Lakeview geographic context. It follows the district lifecycle,
// stays independent of project scenarios, and preserves the authored water PBR.
export const OHN_ASSET_URL = "models/context-supplements/lakeview-ohn-offshore-0f27774f67dc.glb";
export const OHN_SOURCE = Object.freeze({
  "assetId": "ohn-lakeview-offshore-supplement-v1",
  "waterSurfaceRole": "ohn-offshore-supplement",
  "sourceDataset": "Ontario Hydro Network Waterbody",
  "sourceProvider": "Ontario Ministry of Natural Resources",
  "sourceURL": "https://data.ontario.ca/dataset/ontario-hydro-network-waterbody",
  "sourceSHA256": "f2d917c4bdcf5277b9e934a5a6bd0b0a52431bbe033353be28a1fc667eab597c",
  "sourceFeatureObjectID": 1408385,
  "sourceOGFID": 321509934,
  "sourceCredits": [
    "Ontario Hydro Network Waterbody, Ontario Ministry of Natural Resources.",
    "Contains information licensed under the Open Government Licence \u2013 Ontario."
  ],
  "licence": "OGL-ON-1.0",
  "licenceURL": "https://www.ontario.ca/page/open-government-licence-ontario",
  "displayModelY": 5,
  "displayLevelIsIllustrative": true,
  "sourceIs2D": true,
  "sourceAccuracy": "Within 5 metres",
  "sourceGeometryUpdateMeaning": "Database maintenance timestamp, not survey date",
  "sourceCoordinateReferenceSystem": "EPSG:4269 NAD83",
  "modelCoordinateReferenceSystem": "EPSG:26917 projected metres with map origin E615000,N4827000; Y5 illustrative",
  "qaRenderOrder": -1,
  "qaCastShadow": false,
  "qaReceiveShadow": false,
  "privatePrototype": true,
  "sourceAssetSHA256": "0f27774f67dc09a29e0713d401b40dcabc6e14011874a0bb8daf7c654bcd814d",
  "sourceAssetRevision": "offshore-margin-v2"
});
export const OHN_CREDIT = 'Ontario Hydro Network Waterbody, Ontario Ministry of Natural Resources.';
const prepared = new WeakSet();
export function usesOHNOffshore(data = {}) {
  return data.assetId === OHN_SOURCE.assetId && data.sourceSHA256 === OHN_SOURCE.sourceSHA256 &&
    data.sourceAssetSHA256 === OHN_SOURCE.sourceAssetSHA256 && data.sourceAssetRevision === OHN_SOURCE.sourceAssetRevision;
}
export function isPreparedOffshore(mesh) { return prepared.has(mesh); }
export function prepareOffshoreContext(THREE, root, {district, url, sha256}) {
  if (url !== OHN_ASSET_URL) return false;
  if (district !== 'lakeview' || sha256 !== OHN_SOURCE.sourceAssetSHA256) throw new Error('Offshore source binding changed');
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse(object => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1) throw new Error('Offshore source must contain one mesh');
  const mesh = meshes[0], data = mesh.userData, material = mesh.material;
  const expected = [.12477181755144427, .25818285291079235, .3139887133649649];
  if (mesh.name !== 'OHN_Lakeview_Offshore_Supplement_v2' || data.assetId !== OHN_SOURCE.assetId ||
      data.sourceSHA256 !== OHN_SOURCE.sourceSHA256 || data.sourceAssetRevision !== OHN_SOURCE.sourceAssetRevision ||
      mesh.geometry.attributes.position.count !== 93 || mesh.geometry.index?.count !== 273 ||
      !mesh.matrixWorld.equals(new THREE.Matrix4()) || !material?.isMeshStandardMaterial ||
      material.color.toArray().some((value, index) => Math.abs(value - expected[index]) > 1e-12) ||
      material.metalness !== 0 || material.roughness !== .35 || material.opacity !== 1 || material.map ||
      material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) throw new Error('Offshore source content changed');
  Object.assign(mesh.userData, OHN_SOURCE, {sourceCredits: [...OHN_SOURCE.sourceCredits], preserveFinish: true});
  Object.assign(mesh, {castShadow: false, receiveShadow: false, renderOrder: -1});
  Object.assign(material, {depthWrite: false, depthTest: true, flatShading: true, side: THREE.DoubleSide});
  material.needsUpdate = true; prepared.add(mesh); return true;
}
