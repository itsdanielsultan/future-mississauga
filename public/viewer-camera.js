// Display framing only. Source geometry, study bounds and elevations stay unchanged.
export const DEFAULT_VIEW_ELEVATION_DEGREES = 38;
export function defaultViewDirection(THREE, districtId) {
  const elevation = THREE.MathUtils.degToRad(DEFAULT_VIEW_ELEVATION_DEGREES);
  // The 23 October Downtown aerial records north at 61.227° clockwise from
  // screen-up. Account for pitch when matching its 2D compass in perspective.
  const north = THREE.MathUtils.degToRad(61.22741126351463);
  const bearing = districtId === 'downtown'
    ? Math.atan2(Math.sin(north) * Math.sin(elevation), Math.cos(north))
    : 0;
  return new THREE.Vector3(Math.sin(bearing) * Math.cos(elevation), Math.sin(elevation), Math.cos(bearing) * Math.cos(elevation));
}
export function neighbourhoodFrame(THREE, district, aspect, fov = 35, bearingDirection = null) {
  const b = district.bounds;
  const ground = district.sourceCropCenter?.[1] ?? district.center[1];
  const target = new THREE.Vector3((b[0] + b[2]) / 2, ground, (b[1] + b[3]) / 2);
  const direction = bearingDirection?.clone().normalize() ?? defaultViewDirection(THREE, district.id);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(), up = new THREE.Vector3().crossVectors(direction,right).normalize();
  const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  let distance = Infinity;
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const ray = direction.clone().negate().addScaledVector(right, x * tan * aspect).addScaledVector(up, y * tan);
    const footprint = direction.clone().addScaledVector(ray, -direction.y / ray.y);
    for (const [coordinate, half] of [[footprint.x, (b[2] - b[0]) / 2], [footprint.z, (b[3] - b[1]) / 2]]) {
      if (Math.abs(coordinate) > 1e-8) distance = Math.min(distance, half * .82 / Math.abs(coordinate));
    }
  }
  return {target, direction, position:target.clone().addScaledVector(direction, Math.max(30, distance))};
}

// Harborn remains a detailed, low-rise focus after its review flag is cleared.
// A model's publication/review state must not change its camera or zoom policy.
export function usesCloseProjectView(project, meshes) {
  return Boolean(project.localReview || meshes.some(mesh => mesh.userData.localReview || mesh.userData.assetId === 'harborn-50-60-current-plan'));
}
