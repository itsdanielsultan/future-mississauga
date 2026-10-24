import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {usesOpenStreetMap, createVisibleAttribution, exportCreditLines} from '../public/source-attribution.js';

test('actual saved City railway and waterfront source records do not inherit blanket OSM credits', () => {
  assert.equal(usesOpenStreetMap({source:'City of Mississauga Planimetric_Lines / Railway'},'city-railway-10'),false);
  assert.equal(usesOpenStreetMap({source:'GO-GTFS.zip / shapes.txt / UNML'},'service-guide-go-milton'),false);
  assert.equal(usesOpenStreetMap({source:'City mapped docks',modelFidelity:'City docks plus OSM beach context'},'city-dock-7'),false);
  assert.equal(usesOpenStreetMap({source:'HML mapped/inferred route polylines in transit-network.json'},'service-guide-hml'),true);
  assert.equal(usesOpenStreetMap({sources:[{publisher:'OpenStreetMap contributors',claim:'Avia footprint ground controls'}]},'voya-taller-body'),true);
  assert.equal(usesOpenStreetMap({id:'osm-beach-469978967'},'beach'),true);
  assert.equal(usesOpenStreetMap({},'OSM-runway-1'),true);
});

test('only visible, in-camera source geometry contributes to a saved-image credit', () => {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,1,1000);
  camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const parent=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());
  mesh.name='OSM-runway-1';parent.add(mesh);scene.add(parent);scene.updateMatrixWorld(true);
  const credit=createVisibleAttribution({THREE,scene,camera});
  assert.equal(credit.update().osm,true);
  parent.visible=false;assert.equal(credit.update().osm,false);
  parent.visible=true;mesh.position.set(1000,0,0);scene.updateMatrixWorld(true);assert.equal(credit.update().osm,false);
  mesh.position.set(0,0,0);scene.updateMatrixWorld(true);assert.equal(credit.update().osm,true);
  assert.ok(!exportCreditLines({osm:false}).join(' ').includes('OpenStreetMap'));
  assert.ok(exportCreditLines({osm:true}).join(' ').includes('openstreetmap.org/copyright'));
});


test('refresh notices same-count descendant replacement and removes unloaded sources', () => {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,1,1000);
  camera.position.set(0,0,100);camera.lookAt(0,0,0);
  const root=new THREE.Group();scene.add(root);
  const mesh=()=>new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());
  root.add(mesh());scene.updateMatrixWorld(true);
  const credit=createVisibleAttribution({THREE,scene,camera});
  assert.equal(credit.update().osm,false);
  root.clear();const replacement=mesh();replacement.name='OSM-runway-2';root.add(replacement);scene.updateMatrixWorld(true);credit.refresh();
  assert.equal(credit.update().osm,true);
  scene.remove(root);credit.refresh();assert.equal(credit.update().osm,false);
});

test('source-dependent omissions require the loaded version, scenario, visible layer and camera region', () => {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,1,1000);
  camera.position.set(0,0,100);camera.lookAt(0,0,0);
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());
  root.add(mesh);scene.add(root);scene.updateMatrixWorld(true);
  const region={assetUrl:'data/tree-delta.json.gz',assetSHA256:'reviewed',modes:['construction','future'],boxModel:[[-5,-5,-5],[5,5,5]]};
  const credit=createVisibleAttribution({THREE,scene,camera,regions:[region]});
  assert.equal(credit.update('future').osm,false);
  credit.registerAsset(root,region.assetUrl,'reviewed');credit.refresh();
  assert.equal(credit.update('existing').osm,false);
  assert.equal(credit.update('construction').osm,true);
  assert.equal(credit.update('future').osm,true);
  root.visible=false;assert.equal(credit.update('future').osm,false);root.visible=true;
  camera.position.set(1000,0,100);camera.lookAt(1000,0,0);assert.equal(credit.update('future').osm,false);
  camera.position.set(0,0,100);camera.lookAt(0,0,0);
  credit.registerAsset(root,region.assetUrl,'changed-unreviewed-version');credit.refresh();assert.equal(credit.update('existing').osm,true);
});
