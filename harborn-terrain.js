// A bounded, reversible terrain adapter for the privately reviewed Harborn apron.
// Source geometry stays immutable. Only ordinary BufferGeometry is rendered/exported.
import {createApronGround,refineApronContact} from './apron-contact.js?v=20261102-contact2';
const EPS = 1e-9;
export async function sha256(bytes) {
  const view = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', view))].map(x => x.toString(16).padStart(2, '0')).join('');
}

let privateContractPromise;
export function getHarbornTerrainContract(district, fetcher = fetch) {
  if (!['cooksville','citywide'].includes(district)) return Promise.resolve(null);
  if (!privateContractPromise) privateContractPromise=(async()=>{
    const response=await fetcher('data/harborn-terrain-v4.json?v=74a5524ec2d8',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    assert(response.ok,'private contract unavailable');const bytes=new Uint8Array(await response.arrayBuffer());
    assert(await sha256(bytes)==='74a5524ec2d80e1ece32a7ce7a0e8f170ef8f2b0fb032376412886c2cec6aa43','private contract changed');
    const contract=JSON.parse(new TextDecoder().decode(bytes)),r=await fetcher(contract.weights.url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    assert(r.ok,'tie weights unavailable');const weights=new Uint8Array(await r.arrayBuffer());
    assert(weights.byteLength===contract.weights.bytes&&await sha256(weights)===contract.weights.sha256,'tie weights changed');
    return {contract,weights};
  })().catch(error=>{privateContractPromise=null;throw error;});
  return privateContractPromise;
}

function assert(ok, message) { if (!ok) throw new Error('Harborn terrain: ' + message); }
const raw = (a, i, k) => a.isInterleavedBufferAttribute ? a.data.array[i * a.data.stride + a.offset + k] : a.array[i * a.itemSize + k];
export function packedAttribute(a, Type = a.isInterleavedBufferAttribute ? a.data.array.constructor : a.array.constructor) {
  const out = new Type(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = raw(a, i, k);
  return out;
}
export function packedIndex(g) { return g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({length:g.attributes.position.count}, (_, i) => i); }
export async function geometryPins(g) { return {positionSHA256:await sha256(packedAttribute(g.attributes.position, Float32Array)), indexSHA256:await sha256(packedIndex(g))}; }
export async function loadBoundTerrainAsset(loader, url, resolveURL, binding, fetcher = fetch) {
  const response = await fetcher(resolveURL(url), {cache:'no-store'});
  assert(response.ok, 'source unavailable: ' + url);
  let bytes = new Uint8Array(await response.arrayBuffer());
  assert(bytes.byteLength === binding.bytes && await sha256(bytes) === binding.sha256, 'source bytes changed: ' + url);
  if (binding.decodedSHA256) {
    bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    assert(bytes.byteLength === binding.decodedBytes && await sha256(bytes) === binding.decodedSHA256, 'decoded candidate changed');
  }
  const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  asset.scene.userData.terrainSource = {url, sha256:binding.sha256};
  asset.scene.traverse(o => { if (o.isMesh) o.userData.terrainSource = {url, sha256:binding.sha256, ...asset.parser.associations.get(o)}; });
  return asset;
}
const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a.x * b.z - b.x * a.z; }, 0) / 2;
function side(v, a, b, orientation) { return orientation * ((b[0] - a[0]) * (v.z - a[1]) - (b[1] - a[1]) * (v.x - a[0])); }
function blend(a, b, t) { return {x:a.x + (b.x-a.x)*t, z:a.z+(b.z-a.z)*t, bary:a.bary.map((w,i)=>w+(b.bary[i]-w)*t)}; }
function half(p, a, b, sign, keepInside) {
  const out=[];
  for (let i=0;i<p.length;i++) {
    const v=p[i], w=p[(i+1)%p.length], dv=side(v,a,b,sign), dw=side(w,a,b,sign), iv=keepInside?dv>=-EPS:dv<=EPS, iw=keepInside?dw>=-EPS:dw<=EPS;
    if(iv)out.push(v);
    if(iv!==iw && Math.abs(dv-dw)>EPS)out.push(blend(v,w,dv/(dv-dw)));
  }
  return out;
}
// Convex subtraction emits disjoint outside pieces, then repeats for each part
// of the exact concave lot. Its axis-aligned box is only a broad-phase test.
export function subtractConvex(polygon, clip) {
  const sign=Math.sign(clip.reduce((s,a,i)=>{const b=clip[(i+1)%clip.length];return s+a[0]*b[1]-b[0]*a[1];},0));
  assert(sign, 'degenerate lot part');
  let inside=polygon; const outside=[];
  for(let i=0;i<clip.length && inside.length>=3;i++) {
    const a=clip[i],b=clip[(i+1)%clip.length],part=half(inside,a,b,sign,false);
    if(part.length>=3&&Math.abs(area(part))>EPS)outside.push(part);
    inside=half(inside,a,b,sign,true);
  }
  return outside;
}
function worldVertices(THREE, mesh) {
  const p=mesh.geometry.attributes.position, v=new THREE.Vector3(), out=[];
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);out.push([v.x,v.y,v.z]);}
  return out;
}
function boxOf(parts, padding=0) {const p=parts.flat();return [Math.min(...p.map(v=>v[0]))-padding,Math.max(...p.map(v=>v[0]))+padding,Math.min(...p.map(v=>v[1]))-padding,Math.max(...p.map(v=>v[1]))+padding];}
function overlaps(v,b) {return Math.max(...v.map(p=>p[0]))>=b[0]&&Math.min(...v.map(p=>p[0]))<=b[1]&&Math.max(...v.map(p=>p[2]))>=b[2]&&Math.min(...v.map(p=>p[2]))<=b[3];}
export function cutGroundGeometry(THREE, mesh, convexParts) {
  const source=mesh.geometry, indices=packedIndex(source), world=worldVertices(THREE,mesh), bounds=boxOf(convexParts), appended=[], result=[], groups=[], changedTriangles=[];
  assert(!Object.keys(source.morphAttributes).length, 'morph terrain is unsupported');
  function emit(ids, materialIndex) {const start=result.length;result.push(...ids);const last=groups.at(-1);if(last?.materialIndex===materialIndex)last.count+=ids.length;else groups.push({start,count:ids.length,materialIndex});}
  for(let offset=0;offset<indices.length;offset+=3) {
    const ids=Array.from(indices.slice(offset,offset+3)), positions=ids.map(i=>world[i]), materialIndex=source.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex??0;
    if(!overlaps(positions,bounds)){emit(ids,materialIndex);continue;}
    const original=positions.map((p,k)=>({x:p[0],z:p[2],bary:[Number(k===0),Number(k===1),Number(k===2)],original:ids[k]}));
    if(Math.abs(area(original))<EPS){emit(ids,materialIndex);continue;}
    let pieces=[original];for(const clip of convexParts)pieces=pieces.flatMap(poly=>subtractConvex(poly,clip));
    const remaining=pieces.reduce((sum,p)=>sum+Math.abs(area(p)),0);
    if(Math.abs(remaining-Math.abs(area(original)))<1e-8){emit(ids,materialIndex);continue;}
    changedTriangles.push(offset/3);
    for(const piece of pieces) {
      const polyIds=piece.map(v=>{if(v.original!==undefined)return v.original;appended.push({ids,bary:v.bary});return source.attributes.position.count+appended.length-1;});
      for(let i=1;i<polyIds.length-1;i++)if(Math.abs(area([piece[0],piece[i],piece[i+1]]))>EPS)emit([polyIds[0],polyIds[i],polyIds[i+1]],materialIndex);
    }
  }
  if(!changedTriangles.length)return {geometry:source,changedTriangles,addedVertices:0};
  const geometry=new THREE.BufferGeometry();
  for(const [name, attr] of Object.entries(source.attributes)) {
    const original=packedAttribute(attr), values=new original.constructor((attr.count+appended.length)*attr.itemSize);values.set(original);
    appended.forEach((v,j)=>{for(let k=0;k<attr.itemSize;k++){const n=v.bary.reduce((sum,w,i)=>sum+w*raw(attr,v.ids[i],k),0);assert(Number.isFinite(n),'nonfinite interpolated '+name);values[(attr.count+j)*attr.itemSize+k]=n;}});
    const a=new THREE.BufferAttribute(values,attr.itemSize,attr.normalized);a.name=attr.name;a.setUsage(attr.usage);geometry.setAttribute(name,a);
  }
  geometry.setIndex(result);for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.name=source.name;geometry.userData={...source.userData};geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,changedTriangles,addedVertices:appended.length};
}
function visible(mesh) {for(let p=mesh;p;p=p.parent)if(!p.visible)return false;return true;}
function notClipped(mesh, point, THREE) {
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  return materials.some(m=>{const planes=m?.clippingPlanes||[];if(!planes.length)return true;const rejected=planes.map(p=>p.distanceToPoint(new THREE.Vector3(...point))<0);return !(m.clipIntersection?rejected.every(Boolean):rejected.some(Boolean));});
}
export function createGroundSampler(THREE, entries, parts, maxEdgeDistanceM) {
  const triangles=[], bounds=boxOf(parts,maxEdgeDistanceM);
  for(const {mesh,binding} of entries) {
    assert(visible(mesh), 'required native ground is hidden');
    const world=worldVertices(THREE,mesh), indices=packedIndex(mesh.geometry);
    for(let i=0;i<indices.length;i+=3){const vertices=Array.from(indices.slice(i,i+3),j=>world[j]);if(overlaps(vertices,bounds))triangles.push({vertices,mesh,source:binding.url,node:binding.node.nodeIndex,triangle:i/3});}
  }
  const grid=new Map(), cellSize=2, cache=new Map();
  for(const tri of triangles){const xs=tri.vertices.map(v=>v[0]),zs=tri.vertices.map(v=>v[2]);for(let ix=Math.floor((Math.min(...xs)-maxEdgeDistanceM)/cellSize);ix<=Math.floor((Math.max(...xs)+maxEdgeDistanceM)/cellSize);ix++)for(let iz=Math.floor((Math.min(...zs)-maxEdgeDistanceM)/cellSize);iz<=Math.floor((Math.max(...zs)+maxEdgeDistanceM)/cellSize);iz++){const key=ix+','+iz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(tri);}}
  return (x,z)=>{
    const key=x+','+z;if(cache.has(key))return cache.get(key);
    let top=null, nearest=null;
    for(const tri of grid.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]) {
      const [a,b,c]=tri.vertices, denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(denominator)>EPS){const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator,w=1-u-v;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7){const y=u*a[1]+v*b[1]+w*c[1];if(notClipped(tri.mesh,[x,y,z],THREE)&&(!top||y>top.y))top={y,source:tri.source,node:tri.node,triangle:tri.triangle,distanceM:0,method:'triangle'};}}
      for(let edge=0;edge<3;edge++) {
        const p=tri.vertices[edge],q=tri.vertices[(edge+1)%3],dx=q[0]-p[0],dz=q[2]-p[2],den=dx*dx+dz*dz;if(den<EPS)continue;
        const t=Math.max(0,Math.min(1,((x-p[0])*dx+(z-p[2])*dz)/den)),px=p[0]+t*dx,pz=p[2]+t*dz,y=p[1]+t*(q[1]-p[1]),distanceM=Math.hypot(px-x,pz-z);
        if(distanceM<=maxEdgeDistanceM+EPS&&notClipped(tri.mesh,[px,y,pz],THREE)&&(!nearest||distanceM<nearest.distanceM-EPS||(Math.abs(distanceM-nearest.distanceM)<EPS&&y>nearest.y)))nearest={y,source:tri.source,node:tri.node,triangle:tri.triangle,edge,t,point:[px,y,pz],distanceM,method:'nearest-dry-edge'};
      }
    }
    const result=top||nearest;cache.set(key,result);return result;
  };
}
async function matchGround(THREE, root, bindings) {
  root.updateMatrixWorld(true);const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});const result=[];
  for(const binding of bindings) {
    const candidates=meshes.filter(o=>{const s=o.userData.terrainSource;return s?.url===binding.url&&s.sha256===binding.sha256&&s.meshes===binding.node.mesh&&s.primitives===binding.node.primitiveIndex&&s.nodes===binding.node.nodeIndex;});
    assert(candidates.length===1,'native primitive identity mismatch: '+binding.url+'/'+binding.node.name);
    const mesh=candidates[0],pins=await geometryPins(mesh.geometry);
    assert(pins.positionSHA256===binding.positionSHA256&&pins.indexSHA256===binding.indexSHA256,'native geometry changed: '+binding.node.name);
    assert(mesh.matrixWorld.elements.every((n,i)=>Math.abs(n-binding.matrix[i%4][Math.floor(i/4)])<1e-10),'native transform changed');
    result.push({mesh,binding});
  }
  return result;
}
// Prepare all variants before touching the scene. Any missing hit leaves the
// municipal ground intact and prevents this candidate from replacing it.
export async function prepareHarbornTerrain(THREE,{context,candidate,contract,weights,district}) {
  assert(['cooksville','citywide'].includes(district),'unsupported district');
  assert(await sha256(weights)===contract.weights.sha256&&weights.byteLength===contract.weights.bytes,'weight buffer changed');
  assert(candidate.userData.terrainSource?.url===contract.candidate.url&&candidate.userData.terrainSource.sha256===contract.candidate.sha256,'candidate identity changed');
  const ground=await matchGround(THREE,context,contract.ground.filter(b=>b.district===district)), sampler=createGroundSampler(THREE,ground,contract.convexPartsXZ,contract.maxEdgeDistanceM), apronGround=createApronGround(THREE,ground,contract.polygonXZ), variants=[], audit={district,assetId:contract.assetId,contract:contract.ownerContractSHA256,fallbacks:[],ground:[],patches:[],apronContact:[],state:'PREPARED_PRIVATE_CONTACT_REVIEW_REQUIRED'};
  candidate.updateMatrixWorld(true);const nodes=[];candidate.traverse(o=>{if(o.isMesh)nodes.push(o);});
  try {
    for(const spec of contract.weights.meshes) {
      const matches=nodes.filter(o=>o.name===spec.nodeName.replaceAll(' ','_')||o.name===spec.nodeName);
      assert(matches.length===1,'patch identity mismatch: '+spec.nodeName);const mesh=matches[0],original=mesh.geometry,pins=await geometryPins(original);
      assert(pins.positionSHA256===spec.POSITION_float32_SHA256&&pins.indexSHA256===spec.index_uint32_SHA256,'patch geometry changed');
      assert(original.attributes.position.count===spec.vertexCount,'patch vertex count changed');
      const data=new DataView(weights.buffer??weights,weights.byteOffset??0,weights.byteLength), geometry=original.clone(), position=geometry.attributes.position, inverse=mesh.matrixWorld.clone().invert(), point=new THREE.Vector3();variants.push({mesh,original,geometry});let active=0,zero=0,maxDelta=0;
      for(let i=0;i<spec.vertexCount;i++) {
        const offset=spec.byteOffset+i*8,weight=data.getFloat32(offset,true),baseY=data.getFloat32(offset+4,true);assert(Number.isFinite(weight)&&weight>=0&&weight<=1&&Number.isFinite(baseY),'invalid tie weight');
        if(weight===0){zero++;continue;}active++;point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);const hit=sampler(point.x,point.z);assert(hit,'missing dry ground beyond '+contract.maxEdgeDistanceM+' m at '+spec.nodeName+' vertex '+i);
        const delta=weight*(hit.y-baseY);maxDelta=Math.max(maxDelta,Math.abs(delta));if(hit.method!=='triangle')audit.fallbacks.push({mesh:spec.nodeName,vertex:i,x:point.x,z:point.z,weight,...hit});
        point.y+=delta;point.applyMatrix4(inverse);position.setXYZ(i,point.x,point.y,point.z);
      }
      assert(active===spec.activeVertices&&zero===spec.zeroWeightVertices,'tie activity changed');
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();audit.patches.push({name:spec.nodeName,activeVertices:active,zeroWeightVertices:zero,maxDeltaM:maxDelta});
      const contact=refineApronContact(THREE,{mesh,original,conformed:geometry,weightSpec:spec,weights,ground:apronGround,lot:contract.polygonXZ,sampleGround:sampler});
      if(contact.geometry!==geometry){geometry.dispose();variants.at(-1).geometry=contact.geometry;}
      audit.apronContact.push({name:spec.nodeName,...contact.audit});
    }
    for(const {mesh,binding} of ground) {
      const cut=cutGroundGeometry(THREE,mesh,contract.convexPartsXZ);variants.push({mesh,original:mesh.geometry,geometry:cut.geometry});audit.ground.push({source:binding.url,node:binding.node.nodeIndex,positionSHA256:binding.positionSHA256,indexSHA256:binding.indexSHA256,vertices:mesh.geometry.attributes.position.count,triangles:packedIndex(mesh.geometry).length/3,changedTriangles:cut.changedTriangles,addedVertices:cut.addedVertices});
    }
  } catch(error) {for(const v of variants)if(v.geometry!==v.original)v.geometry.dispose();throw error;}
  let active=false,disposed=false;
  return {audit,update(mode,visibleAssetIds){assert(!disposed,'disposed controller');const wanted=mode==='future'&&visibleAssetIds.has(contract.assetId);if(wanted===active)return;for(const v of variants)v.mesh.geometry=wanted?v.geometry:v.original;active=wanted;},get active(){return active;},dispose(){if(disposed)return;for(const v of variants){v.mesh.geometry=v.original;if(v.geometry!==v.original)v.geometry.dispose();}active=false;disposed=true;}};
}
