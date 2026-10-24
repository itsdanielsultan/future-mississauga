// Neutral daylight, with a local shadow map that follows the view rather than
// spreading one district-sized map across a close-up building.
export function daylightShadowFrame(target, viewDistance, districtRadius) {
  const limit = Math.max(120, Number(districtRadius) * 1.25 || 120);
  const extent = Math.min(limit, Math.max(120, viewDistance * .85));
  const height = Math.max(1500, extent * 1.8);
  return {extent, height, near:1, far:height * 2 + extent * 2 + 1500,
    position:[target.x - height * .6, target.y + height, target.z + height * .6]};
}

export function createDaylight(THREE, scene, renderer) {
  renderer.setClearColor('#eef2f5');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const sky = new THREE.HemisphereLight('#ffffff', '#b8c4cd', 1.5);
  const fill = new THREE.AmbientLight('#ffffff', .15);
  const sun = new THREE.DirectionalLight('#ffffff', 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096,4096);
  sun.shadow.bias = -.000015;
  sun.shadow.normalBias = .12;
  sun.shadow.radius = 1.25;
  sun.shadow.intensity = .65;
  scene.add(sky,fill,sun,sun.target);
  const previousTarget = new THREE.Vector3(Infinity,Infinity,Infinity);
  let previousExtent = 0;
  function update(target, camera, radius) {
    const frame = daylightShadowFrame(target,camera.position.distanceTo(target),radius);
    if (Math.abs(frame.extent - previousExtent) < Math.max(1,previousExtent * .025)
      && target.distanceTo(previousTarget) < Math.max(1,frame.extent * .025)) return;
    sun.position.set(...frame.position);
    sun.target.position.copy(target);
    Object.assign(sun.shadow.camera,{left:-frame.extent,right:frame.extent,
      top:frame.extent,bottom:-frame.extent,near:frame.near,far:frame.far});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
    previousExtent = frame.extent;
    previousTarget.copy(target);
  }
  return {sun,update};
}
