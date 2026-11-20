// Display-only clipping of pinned municipal source faces. Original meshes stay
// intact as fallbacks. The optional cap closes only the actual cut section.
const pointKey=p=>p.map(v=>v.toFixed(7)).join(',');
export const triangleKey=points=>points.map(p=>p.map(v=>v.toFixed(3)).join(',')).sort().join('|');
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export function clipTriangleBelow(points,plane){
 const polygon=[];
 for(let i=0;i<3;i++){
  const a=points[i],b=points[(i+1)%3],insideA=a[1]<=plane,insideB=b[1]<=plane;
  if(insideA)polygon.push(a);
  if(insideA!==insideB){const t=(plane-a[1])/(b[1]-a[1]);polygon.push([a[0]+t*(b[0]-a[0]),plane,a[2]+t*(b[2]-a[2])]);}
 }
 const triangles=[];for(let i=1;i<polygon.length-1;i++)triangles.push([polygon[0],polygon[i],polygon[i+1]]);return triangles;
}
function sectionLoops(triangles,plane){
 const edges=new Map(),points=new Map();
 for(const triangle of triangles)for(let i=0;i<3;i++){
  const a=triangle[i],b=triangle[(i+1)%3],ka=pointKey(a),kb=pointKey(b),key=[ka,kb].sort().join('|');
  points.set(ka,a);points.set(kb,b);const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a:ka,b:kb,count:1});
 }
 const adjacency=new Map();
 for(const edge of edges.values()){
  if(edge.count===2)continue;
  if(edge.count!==1||[edge.a,edge.b].some(k=>Math.abs(points.get(k)[1]-plane)>1e-7))throw new Error('The City lower shell has an unexpected open edge.');
  for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push(b);}
 }
 if([...adjacency.values()].some(neighbours=>neighbours.length!==2))throw new Error('The City cut section is not a closed ring.');
 const unvisited=new Set(adjacency.keys()),rings=[];
 while(unvisited.size){
  const start=unvisited.values().next().value,ring=[];let previous=null,key=start;
  do{if(!unvisited.delete(key))throw new Error('The City cut ring repeats unexpectedly.');ring.push(points.get(key));const next=adjacency.get(key).find(k=>k!==previous);previous=key;key=next;}while(key!==start);
  rings.push(ring);
 }
 return rings.sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
}
const signedArea=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[2]-q[0]*p[2];},0)/2;
function meshFromTriangles(THREE,triangles,material){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flat(2),3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return new THREE.Mesh(geometry,material);
}
export async function createCityLowerShell(THREE,sourceRoot,spec){
 if(!sourceRoot)throw new Error('The municipal base is unavailable.');
 sourceRoot.updateMatrixWorld(true);const root=new THREE.Group();root.name='Oro City-derived lower massing';
 try{
  for(const expected of spec.nodes){
   const matches=[];sourceRoot.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.id===expected.id&&!mesh.userData.assetId)matches.push(mesh);});
   if(matches.length!==1)throw new Error('The municipal base is missing or duplicated.');
   const source=matches[0],geometry=source.geometry,index=geometry.index,positions=geometry.attributes.position,triangles=[];
   for(let i=0;i<(index?.count??positions.count);i+=3)triangles.push([0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(source.matrixWorld).toArray()));
   if(triangles.length!==expected.sourceTriangles||await sha(triangles.map(triangleKey).sort().join('\n'))!==expected.sourceKeysSHA256)throw new Error('The municipal base does not match its reviewed source.');
   const clipped=triangles.flatMap(t=>clipTriangleBelow(t,spec.plane));
   if(clipped.length!==expected.clippedTriangles)throw new Error('The municipal clip does not match its reviewed topology.');
   const material=Array.isArray(source.material)?source.material[0].clone():source.material.clone();material.vertexColors=false;
   const lower=meshFromTriangles(THREE,clipped,material);lower.name='City lower massing / '+expected.id;
   lower.userData={sourceId:expected.id,geometryRole:'city-lower-shell',source:'City of Mississauga; clipped original source faces',clippedTriangles:clipped.length};root.add(lower);
   const rings=sectionLoops(clipped,spec.plane);lower.userData.cutRings=rings.length;
   if(spec.cap){
    const vectors=rings.map(ring=>ring.map(p=>new THREE.Vector2(p[0],p[2]))),flat=rings.flat(),indices=THREE.ShapeUtils.triangulateShape(vectors[0],vectors.slice(1));
    const faces=indices.flatMap(indices=>{const face=indices.map(i=>flat[i]),[a,b,c]=face.map(p=>p.map(Math.fround)),up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(up===0)return [];if(up<0)face.reverse();return [face];});
    const area=Math.abs(signedArea(rings[0]))-rings.slice(1).reduce((sum,ring)=>sum+Math.abs(signedArea(ring)),0);
    if(!Number.isFinite(area)||Math.abs(area-expected.sectionArea)>1e-4)throw new Error('The cut closure does not match the reviewed section.');
    const capMaterial=material.clone();capMaterial.polygonOffset=true;capMaterial.polygonOffsetFactor=1;capMaterial.polygonOffsetUnits=1;
    const cap=meshFromTriangles(THREE,faces,capMaterial);cap.name='Derived planar cut closure / '+expected.id;
    cap.userData={sourceId:expected.id,geometryRole:'derived-cut-closure',source:'City of Mississauga; derived planar section closure',sectionArea:area,cutRings:rings.length};root.add(cap);
   }
  }
  return root;
 }catch(error){root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});throw error;}
}
