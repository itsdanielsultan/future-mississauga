// Display-only source-component classification. No position or index is changed.
export function createExistingStyleIndex(data){
 const cells=new Map(),ids=new Set(),size=200;
 for(const record of data.records||[]){
  ids.add(record.id);const b=record.bounds;
  for(let x=Math.floor((b[0][0]-.06)/size);x<=Math.floor((b[1][0]+.06)/size);x++)
   for(let z=Math.floor((b[0][2]-.06)/size);z<=Math.floor((b[1][2]+.06)/size);z++){
    const key=record.tile+':'+x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b);
   }
 }
 return {ids,contains(tile,x,y,z){
  const boxes=cells.get(tile+':'+Math.floor(x/size)+':'+Math.floor(z/size))||[];
  return boxes.some(b=>x>=b[0][0]-.06&&x<=b[1][0]+.06&&y>=b[0][1]-.06&&y<=b[1][1]+.06&&z>=b[0][2]-.06&&z<=b[1][2]+.06);
 }};
}

export function applyExistingStyle(THREE,object,index){
 const geometry=object.geometry,position=geometry.getAttribute('position'),triangles=geometry.index;
 const small=new THREE.Color(0xc8cac3),major=new THREE.Color(0x747d81);
 const pale=[small.r,small.g,small.b].map(x=>Math.round(x*255)),dark=[major.r,major.g,major.b].map(x=>Math.round(x*255));
 const colors=new Uint8Array(position.count*3),d=object.userData;
 let uniform=null;
 if(d.id||d.assetId){
  const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3());
  uniform=index.ids.has(d.id)||size.y>=18||(size.y>=6&&size.x*size.z>=1600&&Math.min(size.x,size.z)>=25);
 }
 const base=uniform===true?dark:pale;
 for(let i=0;i<position.count;i++)colors.set(base,i*3);
 let majorFaces=uniform===true?(triangles?triangles.count:position.count)/3:0;
 if(uniform===null){
  const matrix=object.matrixWorld.elements,n=triangles?triangles.count:position.count;
  for(let f=0;f<n;f+=3){
   const a=triangles?triangles.getX(f):f,b=triangles?triangles.getX(f+1):f+1,c=triangles?triangles.getX(f+2):f+2;
   const x=(position.getX(a)+position.getX(b)+position.getX(c))/3,y=(position.getY(a)+position.getY(b)+position.getY(c))/3,z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
   const wx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],wy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],wz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
   if(index.contains(d.tile,wx,wy,wz)){colors.set(dark,a*3);colors.set(dark,b*3);colors.set(dark,c*3);majorFaces++;}
  }
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
 d.existingStyle='source component face classification; houses pale, major buildings grey';d.majorStyleFaces=majorFaces;
 return majorFaces;
}
