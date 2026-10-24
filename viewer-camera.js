// Display framing only. Source geometry, study bounds and elevations stay unchanged.
export function neighbourhoodFrame(THREE, district, aspect, fov = 35, bearingDirection = null) {
  const b = district.bounds;
  const ground = district.sourceCropCenter?.[1] ?? district.center[1];
  const target = new THREE.Vector3((b[0] + b[2]) / 2, ground, (b[1] + b[3]) / 2);
  const direction = bearingDirection?.clone().normalize() ?? new THREE.Vector3(0, Math.sin(Math.PI * 55 / 180), Math.cos(Math.PI * 55 / 180));
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
