import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function glbMeshFingerprints(bytes){
 const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),binaryStart=20+jsonLength+8;
 const accessor=index=>{
  const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType];
  if(!components||!size||a.sparse||view.byteStride)throw Error('Unexpected accessor representation');
  const start=binaryStart+(view.byteOffset||0)+(a.byteOffset||0),payload=bytes.subarray(start,start+a.count*components*size);
  return {componentType:a.componentType,count:a.count,type:a.type,normalized:!!a.normalized,sha256:sha(payload)};
 };
 return Object.fromEntries(gltf.meshes.map(mesh=>[mesh.name,sha(JSON.stringify(mesh.primitives.map(p=>({attributes:Object.fromEntries(Object.keys(p.attributes).sort().map(k=>[k,accessor(p.attributes[k])])),indices:p.indices===undefined?null:accessor(p.indices),mode:p.mode??4,material:gltf.materials[p.material]}))))]));
}
