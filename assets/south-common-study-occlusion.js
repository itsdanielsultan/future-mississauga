// Conditional Future study symbol occlusion. Municipal points and records remain intact.
// This is not measured pruning, a removal plan, or evidence of physical tree removal.
const assetId = 'south-common-source-derived-preview';
const sourceSHA256 = 'ba94ff2fab61ceac6453406e8966d055d163fbe6e8587393b91b143f8d37319b';
const sourceIDs = new Set([247334,247442,247327,247326,247325,358998,330618,247446,330619,247444,247447]);
const records = new WeakMap();
export function registerSouthCommonStudyOcclusion(THREE, mesh, rows, treeMode, modelSHA256) {
  if (treeMode === 'baseline') return;
  const matches = [];
  rows.forEach((row, index) => {
    if (!sourceIDs.has(row[0])) return;
    if (row[0] >= 2000000000) throw new Error('South Common rule requires a mapped municipal point');
    if (modelSHA256 !== sourceSHA256) throw new Error('South Common study occlusion source changed');
    const original = new THREE.Matrix4();
    mesh.getMatrixAt(index, original);
    const occluded = original.clone().scale(new THREE.Vector3(0, 0, 0));
    if (original.elements.slice(12, 15).some((v, i) => v !== occluded.elements[12 + i])) throw new Error('Source XYZ changed');
    matches.push({id: row[0], index, sourcePoint: [row[1], row[2], row[3]], original, occluded, active: false});
  });
  if (!matches.length) return;
  records.set(mesh, matches);
  mesh.userData.southCommonStudyOcclusion = {
    schema: 'south-common-study-symbol-occlusion/v1', assetId, sourceSHA256, treeMode,
    sourceTreeIds: matches.map(r => r.id), instanceIndices: matches.map(r => r.index),
    sourcePoints: matches.map(r => r.sourcePoint), activeIds: [],
    scope: 'Future-only approximate study symbol occlusion when this exact model is visible. Mapped records and XYZ retained; not physical tree removal.'
  };
}
export function applySouthCommonStudyOcclusion(meshes, scenario, visibleAssetIds) {
  const active = scenario === 'future' && Boolean(visibleAssetIds?.has(assetId));
  for (const mesh of meshes) {
    const matches = records.get(mesh);
    if (!matches) continue;
    let changed = false;
    for (const r of matches) {
      if (active === r.active) continue;
      mesh.setMatrixAt(r.index, active ? r.occluded : r.original);
      r.active = active;
      changed = true;
    }
    if (changed) mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.southCommonStudyOcclusion.activeIds = active ? matches.map(r => r.id) : [];
  }
}
