// Source-specific derived topology; the immutable source geometry is never edited.
export const APRON_AUTHORITY_SHA256='f8285255b2fef1cb77c7702e836767d77ab5387819701b37c8a58fc09e9be14d';
const EPS=1e-9;
function require(ok,message){if(!ok)throw new Error('Harborn apron: '+message);}
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const mix=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const signedArea=p=>p.reduce((sum,a,i)=>sum+cross(sub(a,p[0]),sub(p[(i+1)%p.length],p[0])),0)/2;
function bary(point,triangle){const a=triangle[0],b=sub(triangle[1],a),c=sub(triangle[2],a),q=sub(point,a),det=cross(b,c);require(Math.abs(det)>1e-14,'degenerate source triangle');const u=cross(q,c)/det,v=cross(b,q)/det;return [1-u-v,u,v];}
function clipSegment(a,b,triangle){const sign=Math.sign(signedArea(triangle));let lo=0,hi=1;for(let i=0;i<3;i++){const p=triangle[i],edge=sub(triangle[(i+1)%3],p),x=sign*cross(edge,sub(a,p)),y=sign*cross(edge,sub(b,p));if(x<0&&y<0)return null;if(x<0||y<0){const t=x/(x-y);if(x<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}return hi-lo>1e-10?[mix(a,b,lo),mix(a,b,hi)]:null;}
function intersection(a,b,c,d){const r=sub(b,a),s=sub(d,c),den=cross(r,s);if(Math.abs(den)<1e-14)return null;const q=sub(c,a),t=cross(q,s)/den,u=cross(q,r)/den;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{point:mix(a,b,Math.max(0,Math.min(1,t))),t,u}:null;}
function onSegment(p,a,b){const d=sub(b,a),length=Math.hypot(...d);if(length<EPS)return distance(p,a)<EPS;return Math.abs(cross(d,sub(p,a)))/length<1e-8&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;}

// Finite source-edge arrangement: no extended clipping lines or invented grid.
export function partitionTriangle(triangle,sourceSegments){
 const origin=triangle[0],local=triangle.map(p=>sub(p,origin)),segments=local.map((a,i)=>({points:[a,local[(i+1)%3]],source:{type:'patch-edge',edge:i}}));
 for(const segment of sourceSegments){const clipped=clipSegment(sub(segment.points[0],origin),sub(segment.points[1],origin),local);if(clipped&&distance(...clipped)>1e-8)segments.push({points:clipped,source:segment.source});}
 require(segments.length<=160,'source edge budget exceeded');
 const splits=segments.map(s=>s.points.map(p=>p.slice()));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const [a,b]=segments[i].points,[c,d]=segments[j].points,hit=intersection(a,b,c,d);
  if(hit){splits[i].push(hit.point);splits[j].push(hit.point);}else{for(const p of [a,b])if(onSegment(p,c,d))splits[j].push(p);for(const p of [c,d])if(onSegment(p,a,b))splits[i].push(p);}
 }
 const points=[],adj=[],edgeSources=new Map();
 function index(p){let i=points.findIndex(q=>distance(p,q)<1e-8);if(i<0){require(points.length<512,'native arrangement point budget exceeded');i=points.length;points.push(p);adj.push(new Set());}return i;}
 for(let n=0;n<segments.length;n++){const a=segments[n].points[0],sorted=splits[n].sort((p,q)=>distance(a,p)-distance(a,q));for(let i=1;i<sorted.length;i++){const u=index(sorted[i-1]),v=index(sorted[i]);if(u===v)continue;adj[u].add(v);adj[v].add(u);const key=[u,v].sort((x,y)=>x-y).join(',');if(!edgeSources.has(key))edgeSources.set(key,[]);edgeSources.get(key).push(segments[n].source);}}
 const visited=new Set(),stack=[0];while(stack.length){const i=stack.pop();if(visited.has(i))continue;visited.add(i);stack.push(...adj[i]);}
 require(visited.size===points.length,'disconnected native edge island requires an explicit source join');
 const ordered=adj.map((set,i)=>[...set].sort((a,b)=>Math.atan2(points[a][1]-points[i][1],points[a][0]-points[i][0])-Math.atan2(points[b][1]-points[i][1],points[b][0]-points[i][0]))),used=new Set(),faces=[];
 for(let a=0;a<points.length;a++)for(const b of ordered[a]){
  if(used.has(a+','+b))continue;const face=[];let u=a,v=b;
  for(let limit=0;limit<2048;limit++){
   const key=u+','+v;if(used.has(key)){require(u===a&&v===b,'invalid native edge arrangement');break;}used.add(key);face.push(u);const around=ordered[v],at=around.indexOf(u),next=around[(at+around.length-1)%around.length];u=v;v=next;
   require(limit<2047,'native face traversal exceeded budget');
  }
  if(face.length>=3&&signedArea(face.map(i=>points[i]))>1e-12)faces.push(face);
 }
 const total=faces.reduce((sum,f)=>sum+signedArea(f.map(i=>points[i])),0),original=Math.abs(signedArea(local));require(Math.abs(total-original)<=Math.max(1e-10,original*1e-7),'partition does not preserve the original triangle footprint');
 return {points:points.map(p=>[p[0]+origin[0],p[1]+origin[1]]),faces,edgeSources:[...edgeSources].map(([edge,sources])=>({indices:edge.split(',').map(Number),sources}))};
}
const attribute=(a,i,k)=>a.isInterleavedBufferAttribute?a.data.array[i*a.data.stride+a.offset+k]:a.array[i*a.itemSize+k];
function world(THREE,mesh){const p=mesh.geometry.attributes.position,v=new THREE.Vector3(),rows=[];for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);rows.push([v.x,v.y,v.z]);}return rows;}
const bounds=t=>[Math.min(...t.map(p=>p[0])),Math.max(...t.map(p=>p[0])),Math.min(...t.map(p=>p[2])),Math.max(...t.map(p=>p[2]))];
const overlap=(a,b)=>a[0]<=b[1]&&a[1]>=b[0]&&a[2]<=b[3]&&a[3]>=b[2];
function edgeDistance(p,a,b){const v=sub(b,a),d=v[0]*v[0]+v[1]*v[1],t=d?Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/d)):0;return distance(p,mix(a,b,t));}
export function createApronGround(THREE,entries,lot){
 const extent=[Math.min(...lot.map(p=>p[0]))-.4,Math.max(...lot.map(p=>p[0]))+.4,Math.min(...lot.map(p=>p[1]))-.4,Math.max(...lot.map(p=>p[1]))+.4],triangles=[];
 for(const {mesh,binding} of entries){const rows=world(THREE,mesh),ix=mesh.geometry.index;for(let i=0;i<(ix?.count??rows.length);i+=3){const vertices=[0,1,2].map(k=>rows[ix?ix.getX(i+k):i+k]),box=bounds(vertices);if(!overlap(box,extent))continue;const xz=vertices.map(p=>[p[0],p[2]]);if(Math.abs(signedArea(xz))<1e-12)continue;triangles.push({vertices,xz,box,mesh,source:{url:binding.url,node:binding.node.nodeIndex,triangle:i/3}});}}
 return triangles;
}
function visibleAt(THREE,ground,point,y){for(let p=ground.mesh;p;p=p.parent)if(!p.visible)return false;const materials=Array.isArray(ground.mesh.material)?ground.mesh.material:[ground.mesh.material];return materials.some(m=>{const rejected=(m?.clippingPlanes||[]).map(plane=>plane.distanceToPoint(new THREE.Vector3(point[0],y,point[1]))<0);return !rejected.length||!(m.clipIntersection?rejected.every(Boolean):rejected.some(Boolean));});}
function winner(THREE,grounds,point){let best=null;for(const ground of grounds){const weights=bary(point,ground.xz);if(Math.min(...weights)<-1e-12)continue;const y=weights.reduce((s,w,i)=>s+w*ground.vertices[i][1],0);if(visibleAt(THREE,ground,point,y)&&(!best||y>best.y))best={ground,y};}return best;}
function layerBreak(triangle,a,b){
 const height=(ground,p)=>bary(p,ground.xz).reduce((sum,w,i)=>sum+w*ground.vertices[i][1],0),delta=triangle.map(p=>height(a,p)-height(b,p));
 if(Math.max(...delta)<=1e-10||Math.min(...delta)>=-1e-10)return null;
 const points=[];for(let i=0;i<3;i++){const j=(i+1)%3;if(Math.abs(delta[i])<=1e-10)points.push(triangle[i]);if(delta[i]*delta[j]<0)points.push(mix(triangle[i],triangle[j],delta[i]/(delta[i]-delta[j])));}
 if(points.length<2)return null;let segment=clipSegment(points[0],points[1],a.xz);if(segment)segment=clipSegment(...segment,b.xz);if(segment){const midpoint=mix(...segment,.5);if(Math.min(...bary(midpoint,a.xz))<=1e-10||Math.min(...bary(midpoint,b.xz))<=1e-10)return null;}return segment;
}

export function refineApronContact(THREE,{mesh,original,conformed,weightSpec,weights,ground,lot,sampleGround}){
 const matrix=mesh.matrixWorld,inverse=matrix.clone().invert(),originalRows=world(THREE,{geometry:original,matrixWorld:matrix}),position=conformed.attributes.position,sourceIndex=original.index,indexCount=sourceIndex?.count??position.count,data=new DataView(weights.buffer??weights,weights.byteOffset??0,weights.byteLength),appended=[],indices=[],groups=[],ledger=[],chunks=new Map(),closures=[];let currentTriangle=-1;
 const scalar=(id,k)=>data.getFloat32(weightSpec.byteOffset+id*8+k*4,true),vector=new THREE.Vector3();
 const selected=new Set(),adjacent=new Map(),edgeKey=(a,b)=>[JSON.stringify([a[0],a[2]]),JSON.stringify([b[0],b[2]])].sort().join('|');
 for(let offset=0;offset<indexCount;offset+=3){const ids=[0,1,2].map(k=>sourceIndex?sourceIndex.getX(offset+k):offset+k),rows=ids.map(i=>originalRows[i]);if(!ids.some(i=>scalar(i,0)>0))continue;if(rows.some(p=>lot.some((a,i)=>edgeDistance([p[0],p[2]],a,lot[(i+1)%lot.length])<=.001)))selected.add(offset/3);for(let k=0;k<3;k++){const key=edgeKey(rows[k],rows[(k+1)%3]);if(!adjacent.has(key))adjacent.set(key,[]);adjacent.get(key).push(offset/3);}}
 function emit(ids,material){if(!chunks.has(currentTriangle))chunks.set(currentTriangle,[]);chunks.get(currentTriangle).push({ids:ids.slice(),material});const start=indices.length;indices.push(...ids);const last=groups.at(-1);if(last?.materialIndex===material)last.count+=ids.length;else groups.push({start,count:ids.length,materialIndex:material});}
 for(let offset=0;offset<indexCount;offset+=3){
  currentTriangle=offset/3;const ids=[0,1,2].map(k=>sourceIndex?sourceIndex.getX(offset+k):offset+k),rows=ids.map(i=>originalRows[i]),xz=rows.map(p=>[p[0],p[2]]),material=original.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex??0;
  if(!ids.some(i=>scalar(i,0)>0)||Math.abs(signedArea(xz))<1e-12){emit(ids,material);continue;}
  const nearby=ground.filter(g=>overlap(g.box,bounds(rows))),segments=[];
  for(const g of nearby)for(let edge=0;edge<3;edge++)segments.push({points:[g.xz[edge],g.xz[(edge+1)%3]],source:{...g.source,edge,type:'native-edge'}});
  for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++)if(overlap(nearby[i].box,nearby[j].box)){const points=layerBreak(xz,nearby[i],nearby[j]);if(points)segments.push({points,source:{type:'native-layer-breakline',surfaces:[nearby[i].source,nearby[j].source]}});}
  let partition=partitionTriangle(xz,segments);if(partition.faces.length<=1){emit(ids,material);continue;}
  // Remove edges belonging only to a hidden lower layer before introducing any
  // new patch vertices. This keeps untouched visible seam segments intact.
  const sides=new Map(),surfaces=partition.faces.map((face,faceIndex)=>{for(let i=0;i<face.length;i++){const key=[face[i],face[(i+1)%face.length]].sort((a,b)=>a-b).join(',');if(!sides.has(key))sides.set(key,[]);sides.get(key).push(faceIndex);}const tri=THREE.ShapeUtils.triangulateShape(face.map(i=>new THREE.Vector2(...partition.points[i])),[]).sort((a,b)=>Math.abs(signedArea(b.map(i=>partition.points[face[i]])))-Math.abs(signedArea(a.map(i=>partition.points[face[i]]))))[0];require(tri,'empty native surface cell');const p=tri.map(i=>partition.points[face[i]]);return winner(THREE,nearby,[p.reduce((s,p)=>s+p[0],0)/3,p.reduce((s,p)=>s+p[1],0)/3])?.ground;});
  const samePlane=(a,b)=>a&&b&&xz.every(p=>Math.abs(bary(p,a.xz).reduce((s,w,i)=>s+w*a.vertices[i][1],0)-bary(p,b.xz).reduce((s,w,i)=>s+w*b.vertices[i][1],0))<1e-7),effective=[];
  for(const edge of partition.edgeSources){if(edge.sources.some(s=>s.type==='patch-edge'))continue;const faces=sides.get(edge.indices.join(','))||[];if(faces.length===2&&samePlane(surfaces[faces[0]],surfaces[faces[1]])&&edge.sources.every(s=>s.type==='native-edge'&&faces.every(i=>s.url!==surfaces[i].source.url||s.node!==surfaces[i].source.node)))continue;for(const source of edge.sources)effective.push({points:edge.indices.map(i=>partition.points[i]),source});}
  let keptConnectedNativePartition=false;
  try{partition=partitionTriangle(xz,effective);}catch(error){if(error.message!=='Harborn apron: disconnected native edge island requires an explicit source join')throw error;keptConnectedNativePartition=true;}
  if(partition.faces.length<=1){emit(ids,material);continue;}
  const cells=[];for(const face of partition.faces){const contour=face.map(i=>new THREE.Vector2(...partition.points[i])),triangles=THREE.ShapeUtils.triangulateShape(contour,[]);require(triangles.length,'empty native cell triangulation');for(const triangle of triangles){const points=triangle.map(i=>partition.points[face[i]]),center=[points.reduce((s,p)=>s+p[0],0)/3,points.reduce((s,p)=>s+p[1],0)/3];cells.push({points,top:winner(THREE,nearby,center)});}}
  const heights=g=>xz.map(p=>bary(p,g.xz).reduce((sum,w,i)=>sum+w*g.vertices[i][1],0)),first=cells[0].top?.ground,plane=first&&heights(first);
  // Hidden lower-layer triangulation is not an effective surface break. Leaving
  // it intact also avoids gratuitous Float32 splits of narrow original faces.
  if(first&&cells.every(c=>c.top&&heights(c.top.ground).every((y,i)=>Math.abs(y-plane[i])<1e-7))){emit(ids,material);continue;}
  const additions=[],faceAudit=[],cellEdges=new Map();
  function pointIndex(point,cell){
   const bc=bary(point,xz),w=bc.reduce((s,x,i)=>s+x*scalar(ids[i],0),0),dtm=bc.reduce((s,x,i)=>s+x*scalar(ids[i],1),0),oldY=bc.reduce((s,x,i)=>s+x*rows[i][1],0);
   require(w>=-1e-7&&w<=1+1e-7,'interpolated weight escaped its original range');
   let hit;
   if(cell){let selected=cell,nativeBary=bary(point,selected.xz);if(Math.min(...nativeBary)<-1e-6){selected=nearby.find(g=>samePlane(cell,g)&&Math.min(...bary(point,g.xz))>=-1e-6);require(selected,'face escaped its chosen source surface '+JSON.stringify({triangle:offset/3,point,source:cell.source,bary:nativeBary,alternatives:nearby.filter(g=>Math.min(...bary(point,g.xz))>=-1e-6).map(g=>g.source)}));nativeBary=bary(point,selected.xz);}hit={y:nativeBary.reduce((s,x,i)=>s+x*selected.vertices[i][1],0),...selected.source,method:'one-sided-native-triangle'};}
   else{hit=sampleGround(point[0],point[1]);require(hit,'new split vertex lacks permitted dry ground');}
   const y=oldY+Math.max(0,Math.min(1,w))*(hit.y-dtm);vector.set(point[0],y,point[1]).applyMatrix4(inverse);const local=[vector.x,vector.y,vector.z];
   for(let k=0;k<3;k++)if(distance(point,xz[k])<1e-8){const id=ids[k];if(Math.abs(local[1]-position.getY(id))<=1e-5&&Math.abs(local[0]-position.getX(id))<=1e-5&&Math.abs(local[2]-position.getZ(id))<=1e-5)return id;}
   const prior=additions.find(v=>distance(point,v.point)<1e-8&&Math.abs(v.local[1]-local[1])<1e-7);if(prior)return prior.index;
   const record={index:position.count+appended.length,originalTriangle:offset/3,originalIndices:ids.slice(),point:point.slice(),barycentric:bc,local,weight:w,originalDTM:dtm,native:hit};appended.push(record);additions.push(record);return record.index;
  }
  let emitted=0;
  for(const {points,top}of cells){const newIds=points.map(p=>pointIndex(p,top?.ground));for(let k=0;k<3;k++){const edge=[k,(k+1)%3],key=edge.map(i=>JSON.stringify(points[i])).sort().join('|');if(!cellEdges.has(key))cellEdges.set(key,[]);cellEdges.get(key).push({points:edge.map(i=>points[i]),ids:edge.map(i=>newIds[i]),ground:top?.ground});}if(Math.sign(signedArea(points))!==Math.sign(signedArea(xz)))newIds.reverse();emit(newIds,material);emitted++;faceAudit.push({indices:newIds,source:top?.ground.source??null});}

  function supported(g,p){if(!g)return null;const candidate=[g,...nearby.filter(n=>n!==g&&samePlane(g,n))].find(n=>Math.min(...bary(p,n.xz))>=-1e-10);if(!candidate)return null;return {source:candidate.source,y:bary(p,candidate.xz).reduce((sum,w,i)=>sum+w*candidate.vertices[i][1],0)};}
  function withinLot(p){if(lot.some((a,i)=>edgeDistance(p,a,lot[(i+1)%lot.length])<1e-8))return true;let inside=false;for(let i=0,j=lot.length-1;i<lot.length;j=i++){const a=lot[i],b=lot[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  const localFor=id=>id<position.count?[position.getX(id),position.getY(id),position.getZ(id)]:appended[id-position.count].local;
  for(const pair of cellEdges.values()){
   if(pair.length!==2||!pair.every(e=>e.ground))continue;const [a,other]=pair,b=distance(a.points[0],other.points[0])<1e-8?other:{...other,points:other.points.slice().reverse(),ids:other.ids.slice().reverse()},mid=mix(...a.points,.5),pa=[...a.points,mid];
   if(pa.some(p=>!withinLot(p))||lot.some((p,i)=>edgeDistance(mid,p,lot[(i+1)%lot.length])<=1e-7)||pa.some(p=>bary(p,xz).reduce((sum,w,i)=>sum+w*scalar(ids[i],0),0)<=0))continue;
   const supportA=pa.map(p=>supported(a.ground,p)),supportB=pa.map(p=>supported(b.ground,p));if([...supportA,...supportB].some(x=>!x)||Math.abs(supportA[2].y-supportB[2].y)<1e-5)continue;
   const sides=[a.ids,b.ids],faces=[],sourceProof={sides:[supportA,supportB],edge:a.points.map(p=>p.slice())};
   for(const triangle of [[a.ids[0],a.ids[1],b.ids[1]],[a.ids[0],b.ids[1],b.ids[0]]])for(const order of [triangle,triangle.slice().reverse()]){
    const points=order.map(localFor),normal=new THREE.Vector3().subVectors(new THREE.Vector3(...points[1]),new THREE.Vector3(...points[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...points[2]),new THREE.Vector3(...points[0])));if(normal.lengthSq()<1e-20)continue;normal.normalize();const generated=order.map((id,i)=>{const prior=id<position.count?null:appended[id-position.count],worldPoint=new THREE.Vector3(...points[i]).applyMatrix4(matrix),point=[worldPoint.x,worldPoint.z],bc=bary(point,xz),record={...(prior||{}),index:position.count+appended.length,kind:'internal-step-closure',sourceVertex:id,originalTriangle:offset/3,originalIndices:ids.slice(),point,barycentric:bc,local:points[i].slice(),weight:bc.reduce((sum,w,k)=>sum+w*scalar(ids[k],0),0),originalDTM:bc.reduce((sum,w,k)=>sum+w*scalar(ids[k],1),0),normalOverride:normal.toArray()};appended.push(record);additions.push(record);return record.index;});emit(generated,material);faces.push({indices:generated,normal:normal.toArray()});
   }
   if(faces.length)closures.push({originalTriangle:offset/3,edge:a.points.map(p=>p.slice()),sourceProof,pairedHorizontalIndices:sides,faces});
  }
  ledger.push({originalTriangle:offset/3,originalIndices:ids,partitionPoints:partition.points,sourceEdges:partition.edgeSources,keptConnectedNativePartition,generatedVertexIndices:additions.map(x=>x.index),triangles:faceAudit});require(emitted>0,'affected original triangle disappeared');
 }
 const dependencies=new Map(),propagation=[];
 for(const p of appended){if(p.kind==='internal-step-closure')continue;for(let k=0;k<3;k++)if(Math.abs(p.barycentric[k])<1e-7){const baseline=p.barycentric.reduce((sum,w,i)=>sum+w*position.getY(p.originalIndices[i]),0);if(Math.abs(p.local[1]-baseline)<1e-5)continue;const edge=[0,1,2].filter(i=>i!==k),key=edgeKey(originalRows[p.originalIndices[edge[0]]],originalRows[p.originalIndices[edge[1]]]);for(const neighbour of adjacent.get(key)||[]){if(neighbour===p.originalTriangle)continue;if(!dependencies.has(p.originalTriangle))dependencies.set(p.originalTriangle,[]);dependencies.get(p.originalTriangle).push({triangle:neighbour,edge,generatedVertex:p.index,deltaY:p.local[1]-baseline});}}}
 const queue=[...selected];for(let cursor=0;cursor<queue.length;cursor++){require(queue.length<=indexCount/3,'propagation escaped original triangle set');const from=queue[cursor];for(const row of dependencies.get(from)||[])if(!selected.has(row.triangle)){selected.add(row.triangle);queue.push(row.triangle);propagation.push({from,...row});}}
 // Only connected, affected neighbours are adopted. Inspection of other weighted
 // triangles contributes no geometry, attributes or public source substitution.
 const used=appended.filter(p=>selected.has(p.originalTriangle)),remap=new Map(used.map((p,n)=>[p.index,position.count+n]));const mapped=id=>id<position.count?id:remap.get(id);
 for(const p of used){p.index=mapped(p.index);if(p.sourceVertex!==undefined)p.sourceVertex=mapped(p.sourceVertex);}appended.splice(0,appended.length,...used);
 for(let n=ledger.length-1;n>=0;n--){const row=ledger[n];if(!selected.has(row.originalTriangle)){ledger.splice(n,1);continue;}row.generatedVertexIndices=row.generatedVertexIndices.map(mapped);for(const t of row.triangles)t.indices=t.indices.map(mapped);}
 for(let n=closures.length-1;n>=0;n--){const row=closures[n];if(!selected.has(row.originalTriangle)){closures.splice(n,1);continue;}row.pairedHorizontalIndices=row.pairedHorizontalIndices.map(ids=>ids.map(mapped));for(const face of row.faces)face.indices=face.indices.map(mapped);}
 for(const row of propagation)row.generatedVertex=mapped(row.generatedVertex);
 indices.length=0;groups.length=0;for(let offset=0;offset<indexCount;offset+=3){const rows=selected.has(offset/3)?chunks.get(offset/3):[{ids:[0,1,2].map(k=>sourceIndex?sourceIndex.getX(offset+k):offset+k),material:original.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex??0}];for(const row of rows){const ids=row.ids.map(mapped);require(ids.every(Number.isInteger),'unbound propagated vertex');const start=indices.length;indices.push(...ids);const last=groups.at(-1);if(last?.materialIndex===row.material)last.count+=ids.length;else groups.push({start,count:ids.length,materialIndex:row.material});}}
 if(!ledger.length)return {geometry:conformed,audit:{authoritySHA256:APRON_AUTHORITY_SHA256,propagation:[],propagationTermination:'No remaining changed-height shared-edge neighbour',internalClosures:[],eligibleTriangles:[...selected],changedTriangles:[],generatedVertices:[],triangles:[]}};
 const geometry=new THREE.BufferGeometry();
 for(const [name,a]of Object.entries(conformed.attributes)){const Type=a.isInterleavedBufferAttribute?a.data.array.constructor:a.array.constructor,values=new Type((a.count+appended.length)*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=attribute(a,i,k);const source=original.attributes[name]||(name==='normal'?a:null);require(source&&source.itemSize===a.itemSize,'source attribute schema changed');appended.forEach((p,n)=>{for(let k=0;k<a.itemSize;k++){const value=name==='position'?p.local[k]:name==='normal'&&p.normalOverride?p.normalOverride[k]:p.barycentric.reduce((sum,w,i)=>sum+w*attribute(source,p.originalIndices[i],k),0);require(Number.isFinite(value),'nonfinite derived attribute');values[(a.count+n)*a.itemSize+k]=value;}});const attr=new THREE.BufferAttribute(values,a.itemSize,a.normalized);attr.name=a.name;attr.setUsage(a.usage);geometry.setAttribute(name,attr);}
 geometry.setIndex(indices);for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.name=conformed.name;geometry.userData={...conformed.userData};geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {geometry,audit:{authoritySHA256:APRON_AUTHORITY_SHA256,propagation,propagationTermination:'No remaining changed-height shared-edge neighbour',internalClosures:closures,eligibleTriangles:[...selected],changedTriangles:ledger.map(r=>r.originalTriangle),generatedVertices:appended,triangles:ledger}};
}
