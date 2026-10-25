import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {batchOpaqueStudy} from '../public/model-preview-batching.js';

function triangles(root){
  root.updateMatrixWorld(true);const result=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const g=mesh.geometry,index=g.index,n=index?.count??g.attributes.position.count;
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<n;i+=3){
      const triangle=[mesh.material.uuid,mesh.layers.mask];
      for(let j=0;j<3;j++){
        const v=index?index.getX(i+j):i+j;
        triangle.push(...new THREE.Vector3().fromBufferAttribute(g.attributes.position,v).applyMatrix4(mesh.matrixWorld).toArray().map(x=>Math.round(x*1e4)));
        if(g.attributes.normal)triangle.push(...new THREE.Vector3().fromBufferAttribute(g.attributes.normal,v).applyNormalMatrix(normalMatrix).toArray().map(x=>Math.round(x*1e4)));
        if(g.attributes.uv)triangle.push(g.attributes.uv.getX(v),g.attributes.uv.getY(v));
      }
      result.push(JSON.stringify(triangle));
    }
  });return result.sort();
}
function fixture(){
  const root=new THREE.Group(),opaque=new THREE.MeshStandardMaterial(),glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.4});
  for(let i=0;i<4;i++){
    const geometry=new THREE.BoxGeometry(2,3,4);geometry.clearGroups();
    const mesh=new THREE.Mesh(geometry,i===3?glass:opaque);mesh.name='part'+i;mesh.position.set(i*3,i,0);mesh.rotation.y=i*.1;root.add(mesh);
  }
  root.position.set(7,2,-4);root.rotation.y=.3;return root;
}
test('Display batching preserves world-space opaque and transparent surfaces, normals, UVs and material assignment',()=>{
  const root=fixture(),before=triangles(root),glass=root.children[3],glassGeometry=glass.geometry,source=root.children[0].geometry.attributes.position.array.slice();
  const firstGeometry=root.children[0].geometry;
  const result=batchOpaqueStudy(root,THREE);
  assert.deepEqual(result,{originalMeshes:4,batchedMeshes:3,batches:1,displayMeshes:2});
  assert.deepEqual(triangles(root),before);assert.equal(glass.geometry,glassGeometry);assert.ok(root.children.includes(glass));
  assert.deepEqual(firstGeometry.attributes.position.array,source,'Original geometry arrays are not rewritten');
});
test('Reflected geometry, geometry groups and different rendering layers are not conflated',()=>{
  const root=fixture();root.children[0].scale.x=-1;root.children[1].layers.set(2);root.children[2].geometry.addGroup(0,36,0);
  const before=triangles(root),result=batchOpaqueStudy(root,THREE);
  assert.equal(result.batches,0);assert.deepEqual(triangles(root),before);
});
test('Batching retains layer masks and never exposes children of a hidden group',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),hidden=new THREE.Group();hidden.visible=false;root.add(hidden);
  for(let i=0;i<5;i++){
    const geometry=new THREE.BoxGeometry();geometry.clearGroups();const mesh=new THREE.Mesh(geometry,material);
    mesh.position.x=i*2;if(i>1)mesh.layers.set(2);(i===4?hidden:root).add(mesh);
  }
  const hiddenMesh=hidden.children[0],before=triangles(root),result=batchOpaqueStudy(root,THREE);
  assert.equal(result.batches,2);assert.deepEqual(triangles(root),before);
  assert.equal(hiddenMesh.parent,hidden);assert.equal(hidden.visible,false);
  assert.deepEqual(root.children.filter(x=>x.isMesh).map(x=>x.layers.mask).sort(),[1,4]);
});
test('Opaque parents retain transparent children and half-float attributes retain their interpretation',()=>{
  const root=fixture(),parent=root.children[0],glass=root.children[3];parent.add(glass);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float16BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  const half=new THREE.Mesh(geometry,parent.material);root.add(half);
  const before=triangles(root);batchOpaqueStudy(root,THREE);
  assert.equal(parent.parent,root);assert.equal(glass.parent,parent);assert.equal(half.geometry,geometry);
  assert.ok(half.geometry.attributes.position.isFloat16BufferAttribute);assert.deepEqual(triangles(root),before);
});
