// These City-mapped terrain overlays have display clearance, not physical thickness.
// Let buildings and trees shade them without making the overlays shadow themselves.
const mappedSurfaceKinds = new Set([
  'Mapped narrow sidewalk', 'Mapped playground', 'Mapped sport surface',
  'Mapped playing field', 'Celebration Square lawn', 'Celebration Square plan-derived paving'
]);
export function prepareMappedSurface(mesh) {
  if (!mesh.isMesh || !mappedSurfaceKinds.has(mesh.userData?.kind)) return false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return true;
}
