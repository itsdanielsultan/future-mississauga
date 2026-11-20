// Perspective distance for a centred box, avoiding a large empty border around
// low, wide buildings. Opt-in catalogue views use this instead of sphere fitting.
export function fitPerspectiveBox(size,direction,verticalFov,aspect,margin=1.08){
 const length=Math.hypot(...direction);
 if(!size.every(v=>Number.isFinite(v)&&v>=0)||!length||!Number.isFinite(aspect)||aspect<=0||verticalFov<=0||verticalFov>=180||margin<1)throw new Error('Invalid preview framing');
 const d=direction.map(v=>v/length),rightLength=Math.hypot(d[0],d[2]);
 const right=rightLength?[d[2]/rightLength,0,-d[0]/rightLength]:[1,0,0];
 const up=[d[1]*right[2]-d[2]*right[1],d[2]*right[0]-d[0]*right[2],d[0]*right[1]-d[1]*right[0]];
 const tan=Math.tan(verticalFov*Math.PI/360),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 let distance=.1;
 for(const x of [-size[0]/2,size[0]/2])for(const y of [-size[1]/2,size[1]/2])for(const z of [-size[2]/2,size[2]/2]){
  const corner=[x,y,z],depth=dot(corner,d);
  distance=Math.max(distance,Math.abs(dot(corner,right))/(tan*aspect)+depth,Math.abs(dot(corner,up))/tan+depth,depth+.1);
 }
 return distance*margin;
}
