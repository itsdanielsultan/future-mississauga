// Display-only batching for reviewed static studies. Downloads keep original bytes.
// Transparent surfaces retain separate meshes and their original sorting behavior.
export function batchOpaqueStudy(root, THREE) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), groups = new Map();
  let originalMeshes = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    originalMeshes++;
    for(let node=mesh;node;node=node.parent){if(!node.visible)return;if(node===root)break;}
    const geometry=mesh.geometry, material=mesh.material;
    if (!mesh.visible || mesh.children.length || mesh.isSkinnedMesh || mesh.isInstancedMesh || Array.isArray(material) ||
      material.transparent || material.opacity < 1 || material.alphaTest > 0 ||
      Object.keys(geometry.morphAttributes).length || geometry.groups.length ||
      geometry.drawRange.start !== 0 || (geometry.drawRange.count !== Infinity && geometry.drawRange.count !== (geometry.index?.count ?? geometry.attributes.position.count))) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    if (matrix.determinant() <= 0) return;
    const names=Object.keys(geometry.attributes).sort();
    if (names.some(name=>geometry.attributes[name].isInterleavedBufferAttribute || geometry.attributes[name].isFloat16BufferAttribute || geometry.attributes[name].isInstancedBufferAttribute)) return;
    const signature=names.map(name=>{const a=geometry.attributes[name];return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).join('|');
    const key=`${material.uuid}:${mesh.renderOrder}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.layers.mask}:${signature}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({mesh,matrix,names});
  });
  const retired=new Set(); let batchedMeshes=0,batches=0;
  for(const group of groups.values()){
    if(group.length<2)continue;
    const sources=group.map(({mesh,matrix})=>mesh.geometry.clone().applyMatrix4(matrix));
    const vertices=sources.reduce((n,g)=>n+g.attributes.position.count,0);
    const merged=new THREE.BufferGeometry();
    for(const name of group[0].names){
      const first=sources[0].attributes[name];
      const array=new first.array.constructor(vertices*first.itemSize);let offset=0;
      for(const source of sources){array.set(source.attributes[name].array,offset);offset+=source.attributes[name].array.length;}
      merged.setAttribute(name,new THREE.BufferAttribute(array,first.itemSize,first.normalized));
    }
    const indices=new Uint32Array(sources.reduce((n,g)=>n+(g.index?.count ?? g.attributes.position.count),0));
    let vertexOffset=0,indexOffset=0;
    for(const source of sources){
      const count=source.index?.count ?? source.attributes.position.count;
      for(let i=0;i<count;i++)indices[indexOffset++]=(source.index?source.index.getX(i):i)+vertexOffset;
      vertexOffset+=source.attributes.position.count;
    }
    merged.setIndex(new THREE.BufferAttribute(indices,1));merged.computeBoundingBox();merged.computeBoundingSphere();
    const first=group[0].mesh, mesh=new THREE.Mesh(merged,first.material);
    mesh.name='Opaque study surfaces';mesh.renderOrder=first.renderOrder;
    mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
    mesh.layers.mask=first.layers.mask;
    mesh.userData={sourceMeshCount:group.length,sourceMeshNames:group.map(item=>item.mesh.name)};
    root.add(mesh);
    for(const {mesh:old} of group){old.removeFromParent();retired.add(old.geometry);}
    for(const source of sources)source.dispose();
    batchedMeshes+=group.length;batches++;
  }
  const remaining=new Set();root.traverse(mesh=>{if(mesh.isMesh)remaining.add(mesh.geometry);});
  for(const geometry of retired)if(!remaining.has(geometry))geometry.dispose();
  const result={originalMeshes,batchedMeshes,batches,displayMeshes:originalMeshes-batchedMeshes+batches};
  root.userData.displayBatching=result;root.updateMatrixWorld(true);return result;
}
