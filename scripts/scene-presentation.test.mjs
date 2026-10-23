import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {northBearingFromNDC, projectNorth} from '../public/scene-presentation.js';
import {addArchitecturalEdges} from '../public/building-presentation.js';

test('north bearing uses screen pixels on wide and portrait images', () => {
  const anchor = {x: 0, y: 0}, north = {x: .5, y: .5};
  assert.ok(Math.abs(northBearingFromNDC(anchor, north, 2000, 1000).degrees - 63.4349488229) < 1e-8);
  assert.ok(Math.abs(northBearingFromNDC(anchor, north, 500, 1000).degrees - 26.5650511771) < 1e-8);
  assert.equal(northBearingFromNDC(anchor, anchor, 2000, 1000), null);
  assert.equal(northBearingFromNDC(anchor, north, 0, 1000), null);
});

test('projected north agrees with the actual camera basis, including roll', () => {
  for (const aspect of [.5, 1, 2.4]) for (const roll of [0, .35]) {
    const camera = new THREE.PerspectiveCamera(35, aspect, 1, 10000);
    camera.position.set(700, 900, 800); camera.lookAt(0, 0, 0); camera.rotateZ(roll); camera.updateMatrixWorld();
    const actual = projectNorth(THREE, camera, new THREE.Vector3(), aspect * 1000, 1000);
    const n = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorldInverse);
    const expected = Math.atan2(n.x, n.y) * 180 / Math.PI;
    assert.ok(Math.abs(actual.degrees - expected) < 1e-8);
  }
});

test('architectural edges retain source geometry, materials, UVs and normal data', () => {
  const geometry = new THREE.BoxGeometry(10, 30, 12), material = new THREE.MeshStandardMaterial({color: '#668899'});
  const original = Object.fromEntries(Object.entries(geometry.attributes).map(([name, value]) => [name, Array.from(value.array)]));
  const indices = Array.from(geometry.index.array), mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {assetId: 'reviewed-building', displayStatus: 'Under Construction', nativeTexture: true};
  mesh.position.set(200, 80, -30); mesh.rotation.y = .45;
  const result = addArchitecturalEdges(THREE, [mesh]);
  assert.equal(result.layers.length, 1); assert.equal(result.layers[0].parent, mesh);
  assert.equal(mesh.material, material); assert.deepEqual(Array.from(geometry.index.array), indices);
  for (const [name, array] of Object.entries(original)) assert.deepEqual(Array.from(geometry.attributes[name].array), array);
  const hits = []; result.layers[0].raycast(new THREE.Raycaster(), hits); assert.deepEqual(hits, []);
  assert.equal(result.layers[0].material.depthTest, true); assert.equal(result.layers[0].material.depthWrite, false);
  result.layers[0].geometry.dispose(); result.layers[0].material.dispose(); geometry.dispose(); material.dispose();
});

test('architectural edge budgets bound additional drawing work and skip hidden or instanced sources', () => {
  const meshes = Array.from({length: 20}, () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.userData = {assetId: 'small-building', displayStatus: 'Existing'};
    return mesh;
  });
  meshes[0].userData.hiddenObsolete = true;
  const instance = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 5);
  instance.userData.assetId = 'instances';
  const result = addArchitecturalEdges(THREE, [...meshes, instance], {maxMeshes: 3, maxInputTriangles: 24, maxLineVertices: 100});
  assert.ok(result.totals.meshes <= 3); assert.ok(result.totals.inputTriangles <= 24); assert.ok(result.totals.lineVertices <= 100);
  assert.equal(meshes[0].children.length, 0); assert.equal(instance.children.length, 0);
  for (const layer of result.layers) { layer.geometry.dispose(); layer.material.dispose(); }
  for (const mesh of [...meshes, instance]) { mesh.geometry.dispose(); mesh.material.dispose(); }
});
