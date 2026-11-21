import envelopeBodies from './data/existing-envelope-bodies.json' with {type:'json'};

// Only the measured, untextured tower bodies use the existing-building tone.
// Podiums, roofs, balconies, other phases and standalone studies keep their finishes.
export function existingEnvelopeColour(mesh) {
 const {assetId, projectId, sourceAssetSHA256, lifecycle, nativeTexture} = mesh.userData;
 if (lifecycle !== 'existing' || nativeTexture) return null;
 const record = envelopeBodies[assetId];
 if (!record || record.projectId !== projectId || record.sourceAssetSHA256 !== sourceAssetSHA256) return null;
 return record.nodes.includes(mesh.name) ? record.colour : null;
}

// Display-only source-component classification. No position or index is changed.
export function createExistingStyleIndex(data,upperFacets={}){
 const cells=new Map(),ids=new Set(),size=200;
 for(const record of data.records||[]){
  ids.add(record.id);const b=record.bounds;
  for(let x=Math.floor((b[0][0]-.06)/size);x<=Math.floor((b[1][0]+.06)/size);x++)
   for(let z=Math.floor((b[0][2]-.06)/size);z<=Math.floor((b[1][2]+.06)/size);z++){
    const key=record.tile+':'+x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b);
   }
 }
 const upper=new Map(Object.entries(upperFacets).map(([key,faces])=>[key,new Set(faces)]));
 return {ids,upperAt(tile,x,z){return upper.get(tile+':'+Math.floor(x/size)+':'+Math.floor(z/size));},contains(tile,x,y,z){
  const boxes=cells.get(tile+':'+Math.floor(x/size)+':'+Math.floor(z/size))||[];
  return boxes.some(b=>x>=b[0][0]-.06&&x<=b[1][0]+.06&&y>=b[0][1]-.06&&y<=b[1][1]+.06&&z>=b[0][2]-.06&&z<=b[1][2]+.06);
 }};
}

export function applyExistingStyle(THREE,object,index){
 const geometry=object.geometry,position=geometry.getAttribute('position'),triangles=geometry.index;
 const small=new THREE.Color(0xc8cac3),major=new THREE.Color(0x7e878b);
 const pale=[small.r,small.g,small.b].map(x=>Math.round(x*255)),dark=[major.r,major.g,major.b].map(x=>Math.round(x*255));
 let colors=new Uint8Array(position.count*3);
 const d=object.userData;
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
  const vertexKeys=[],use=triangles?new Uint8Array(position.count):null,faceTone=triangles?new Uint8Array(n/3):null;
  const vertexKey=i=>{
   if(vertexKeys[i]!==undefined)return vertexKeys[i];
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
   const key=[0,1,2].map(k=>Math.round(1000*(matrix[k]*x+matrix[4+k]*y+matrix[8+k]*z+matrix[12+k]))).join('/');
   vertexKeys[i]=key;return key;
  };
  for(let f=0;f<n;f+=3){
   const a=triangles?triangles.getX(f):f,b=triangles?triangles.getX(f+1):f+1,c=triangles?triangles.getX(f+2):f+2;
   const x=(position.getX(a)+position.getX(b)+position.getX(c))/3,y=(position.getY(a)+position.getY(b)+position.getY(c))/3,z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
   const wx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],wy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],wz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
   let major=index.contains(d.tile,wx,wy,wz);
   if(!major){
    const candidates=index.upperAt?.(d.tile,wx,wz);
    major=candidates?.has([vertexKey(a),vertexKey(b),vertexKey(c)].sort().join(','));
   }
   if(use){const bit=major?2:1;use[a]|=bit;use[b]|=bit;use[c]|=bit;faceTone[f/3]=major?1:0;}
   if(major){colors.set(dark,a*3);colors.set(dark,b*3);colors.set(dark,c*3);majorFaces++;}
  }
  if(use?.includes(3)){
   // A podium and a tower façade can share source vertices. Give their tones
   // separate display vertices so the tower colour cannot bleed over the roof.
   const shared=[];
   for(let i=0;i<use.length;i++)if(use[i]===3)shared.push(i);
   const count=position.count+shared.length,copyIndex=new Map(shared.map((i,k)=>[i,position.count+k]));
   for(const [name,attribute] of Object.entries(geometry.attributes)){
    if(name==='color')continue;
    const interleaved=attribute.isInterleavedBufferAttribute;
    const array=interleaved?attribute.data.array:attribute.array;
    const size=attribute.itemSize,stride=interleaved?attribute.data.stride:size,offset=interleaved?attribute.offset:0;
    const output=new array.constructor(count*size);
    if(!interleaved)output.set(array);
    else for(let i=0;i<position.count;i++)for(let c=0;c<size;c++)output[i*size+c]=array[i*stride+offset+c];
    for(const [i,duplicate] of copyIndex)for(let c=0;c<size;c++)output[duplicate*size+c]=array[i*stride+offset+c];
    const view=new THREE.BufferAttribute(output,size,attribute.normalized);
    view.gpuType=attribute.gpuType;geometry.setAttribute(name,view);
   }
   const separate=count>65535?new Uint32Array(n):new Uint16Array(n);
   for(let k=0;k<n;k++){const i=triangles.getX(k);separate[k]=!faceTone[Math.floor(k/3)]&&use[i]===3?copyIndex.get(i):i;}
   geometry.setIndex(new THREE.BufferAttribute(separate,1));
   const extended=new Uint8Array(count*3);extended.set(colors);
   for(let v=position.count;v<count;v++)extended.set(pale,3*v);
   colors=extended;
  }
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
 d.existingStyle='source component face classification; houses pale, major buildings grey';d.majorStyleFaces=majorFaces;
 return majorFaces;
}

// Primary district GLBs keep exact municipal surfaces and often combine a
// whole tile into one mesh. Preserve their original colour buffer for export
// and teardown while sharing immutable positions, normals, indices and bounds.
export function municipalDisplayGeometry(THREE, mesh, index){
 const data=mesh.userData;
 if(data.lifecycle!=='existing'||!Number.isInteger(data.tile)||data.projectId||data.assetId||data.nativeTexture)return null;
 if(!/^\d+-\d+$/.test(data.id||'')&&!/City (of Mississauga|LiDAR)/i.test(data.source||''))return null;
 const original=mesh.geometry;
 if(!original?.getAttribute('position'))return null;
 const display=new THREE.BufferGeometry();
 display.name=original.name;
 display.setIndex(original.index);
 for(const [name,attribute] of Object.entries(original.attributes))display.setAttribute(name,attribute);
 display.groups=original.groups.slice();
 display.drawRange={...original.drawRange};
 display.boundingBox=original.boundingBox;
 display.boundingSphere=original.boundingSphere;
 display.userData={...original.userData};
 mesh.updateWorldMatrix(true,false);
 mesh.geometry=display;
 applyExistingStyle(THREE,mesh,index);
 return original;
}
