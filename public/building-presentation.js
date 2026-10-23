// Display geometry only. Source positions, indices, UVs, materials and normals stay intact.
export function addArchitecturalEdges(THREE, meshes, {enabled = true, maxMeshes = 96, maxInputTriangles = 240000, maxLineVertices = 160000} = {}) {
  const layers = [], edgeMaterials = new Map();
  const totals = {meshes: 0, inputTriangles: 0, lineVertices: 0, skipped: 0};
  const ranked = meshes.filter(mesh => {
    const d = mesh.userData;
    return mesh.isMesh && !mesh.isInstancedMesh && !mesh.isSkinnedMesh && !d.hiddenObsolete && (d.assetId || d.projectId) &&
      !/foundation|footing|terrain|ground.fit|water|landscape|transit|dock/i.test(mesh.name + ' ' + (d.role || ''));
  }).sort((a, b) => Number(Boolean(b.userData.nativeTexture)) - Number(Boolean(a.userData.nativeTexture)));
  for (const mesh of ranked) {
    const geometry = mesh.geometry, position = geometry?.getAttribute('position');
    const triangles = (geometry?.index?.count ?? position?.count ?? 0) / 3;
    if (!position || triangles < 4 || triangles > 120000 || layers.length >= maxMeshes || totals.inputTriangles + triangles > maxInputTriangles) { totals.skipped++; continue; }
    totals.inputTriangles += triangles;
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 24);
    const vertices = edgeGeometry.getAttribute('position').count;
    if (!vertices || totals.lineVertices + vertices > maxLineVertices) { edgeGeometry.dispose(); totals.skipped++; continue; }
    const status = mesh.userData.uncertain ? 'Uncertain' : mesh.userData.displayStatus;
    if (!edgeMaterials.has(status)) edgeMaterials.set(status, new THREE.LineBasicMaterial({
      color: ({Existing: 0x3c4849, 'Under Construction': 0x355d6a, Proposed: 0x805b55, Uncertain: 0x685773})[status] ?? 0x3c4849,
      transparent: true, opacity: .20, depthTest: true, depthWrite: false, toneMapped: true
    }));
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterials.get(status));
    edges.name = 'Architectural edges';
    edges.userData.presentationOnly = true;
    edges.raycast = () => {};
    edges.visible = enabled;
    edges.renderOrder = 1;
    mesh.add(edges);
    layers.push(edges);
    totals.meshes++;
    totals.lineVertices += vertices;
  }
  return {layers, totals};
}
