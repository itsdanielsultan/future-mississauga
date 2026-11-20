// City overview files intentionally omit low-rise buildings and trees. Reuse one
// published district at a time when the camera reaches neighbourhood scale.
export function chooseCitywideDetail({district,target,distance},districts,{retained=null,enterDistance=2200,exitDistance=2800,maxBytes=20000000}={}) {
 if((typeof district==='string'?district:district?.id)!=='citywide'||!Number.isFinite(target?.x)||!Number.isFinite(target?.z)||!Number.isFinite(distance)||distance<0||distance>(retained?exitDistance:enterDistance))return null;
 const within=(b,pad=0)=>target.x>=b[0]-pad&&target.z>=b[1]-pad&&target.x<=b[2]+pad&&target.z<=b[3]+pad;
 if(retained&&within(retained.bounds,-100))return retained;
 return districts.filter(d=>d.id!=='citywide'&&d.bytes<=maxBytes&&within(d.bounds)).map(d=>({d,margin:Math.min(target.x-d.bounds[0],target.z-d.bounds[1],d.bounds[2]-target.x,d.bounds[3]-target.z)})).sort((a,b)=>b.margin-a.margin||a.d.bytes-b.d.bytes)[0]?.d||null;
}
export function createCitywideDetail({districts,load,attach,remove,dispose,onChange=()=>{},maxBytes=20000000}) {
 let active=null,retained=null,eligible=null,error=null,epoch=0,destroyed=false;
 const state=()=>({status:error?'error':active?'loading':retained?'ready':'idle',district:(retained?.district||eligible)?.id||null,metrics:retained?.value?.metrics||null});
 const release=record=>{if(!record||record.released)return;record.released=true;if(record.attached)remove(record.value);dispose(record.value);};
 function clear(){epoch++;active?.controller.abort();active=null;release(retained);retained=null;eligible=null;error=null;onChange(state());}
 function start(district,waitFor){const token=epoch,controller=new AbortController(),request={district,controller,task:null};active=request;eligible=district;error=null;onChange(state());
  const current=()=>!destroyed&&active===request&&token===epoch&&!controller.signal.aborted;
  request.task=Promise.resolve(waitFor).catch(()=>{}).then(async()=>{
   if(!current())return state();const value=await load(district,controller.signal);const record={district,value,attached:false,released:false};
   if(!current()){release(record);return state();}retained=record;record.attached=true;
   try{await attach(value,district);}catch(e){retained=null;release(record);throw e;}
   if(!current())release(record);return state();
  }).catch(e=>{if(current())error=e;return state();}).finally(()=>{if(active===request)active=null;onChange(state());});return request.task;
 }
 return {update(view){if(destroyed)return Promise.resolve(state());const next=chooseCitywideDetail(view,districts,{retained:retained?.district||eligible,maxBytes});if(next?.id===(retained?.district||eligible)?.id){if(active)return active.task;if(retained||error)return Promise.resolve(state());}
   const waiting=active?.task;clear();if(!next)return Promise.resolve(state());return start(next,waiting);},
  retry(){if(destroyed||!eligible||active||retained)return active?.task||Promise.resolve(state());return start(eligible);},
  clear,dispose(){clear();destroyed=true;},get state(){return state();},get root(){return retained?.value?.root||null;}
 };
}
// Keep exact source triangles. Only the additive district and anonymous coarse
// overview use reciprocal coverage; named source IDs are deduplicated separately.
export function geometryInRectangle(THREE,mesh,bounds,inside,omit) {
 const original=mesh.geometry,position=original.attributes.position,index=original.index,ids=[],v=new THREE.Vector3();mesh.updateMatrixWorld(true);
 for(let k=0;k<(index?.count??position.count);k+=3){const tri=[0,1,2].map(j=>index?index.getX(k+j):k+j);v.set(0,0,0);for(const i of tri){v.x+=position.getX(i)/3;v.y+=position.getY(i)/3;v.z+=position.getZ(i)/3;}v.applyMatrix4(mesh.matrixWorld);const hit=v.x>=bounds[0]&&v.z>=bounds[1]&&v.x<=bounds[2]&&v.z<=bounds[3];if(hit===inside){if(omit&&v.x>=omit.bounds[0]&&v.z>=omit.bounds[1]&&v.x<=omit.bounds[2]&&v.z<=omit.bounds[3]){const key=triangleKey(THREE,mesh,tri);if(omit.keys.has(key)){omit.removed.add(key);omit.count++;continue;}}ids.push(...tri);}}
 if(ids.length===(index?.count??position.count))return original;
 const geometry=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(original.attributes))geometry.setAttribute(name,attribute);geometry.setIndex(ids);geometry.boundingBox=original.boundingBox?.clone()||null;geometry.boundingSphere=original.boundingSphere?.clone()||null;return geometry;
}
export function prepareCitywideSourceDetail(THREE,{root,baseModel,district,classify,overrides,maxGeometryBytes,geometryBytes,splitSourceOverlaps,assets,pilotTriangles}) {
 root.updateMatrixWorld(true);baseModel.updateMatrixWorld(true);const existingIds=new Set();baseModel.traverse(o=>{if(o.isMesh&&o.userData.id)existingIds.add(o.userData.id);});const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 if(geometryBytes(root)>maxGeometryBytes)throw new Error('Local city detail exceeded its memory budget');
 for(const mesh of meshes){const d=mesh.userData,ov=overrides[d.id]||{};d.citywideDetail=true;d.hiddenObsolete=classify(d)!=='Existing'||Boolean(d.id&&existingIds.has(d.id))||!!ov.excludeSuperseded||!!ov.excludeDuplicate;
  if(d.hiddenObsolete){mesh.visible=false;continue;}
  const old=mesh.geometry;mesh.geometry=geometryInRectangle(THREE,mesh,district.bounds,true,pilotTriangles);if(old!==mesh.geometry)old.dispose();
 }
 if(pilotTriangles&&(pilotTriangles.removed.size!==pilotTriangles.keys.size||pilotTriangles.count!==pilotTriangles.keys.size))throw new Error('Fairview source triangles no longer match the published district');
 splitSourceOverlaps(THREE,root,assets);
 const variants=[];baseModel.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.id&&!mesh.userData.assetId&&classify(mesh.userData)==='Existing'){const original=mesh.geometry,geometry=geometryInRectangle(THREE,mesh,district.bounds,false);if(geometry!==original)variants.push({mesh,original,geometry});}});
 let applied=false;return {pilotTrianglesRemoved:pilotTriangles?.count||0,apply(){if(applied)return;for(const row of variants)row.mesh.geometry=row.geometry;applied=true;},restore(){for(const row of variants)row.mesh.geometry=row.original;applied=false;},dispose(){this.restore();for(const row of variants)row.geometry.dispose();},get maskedTriangles(){return variants.reduce((sum,r)=>sum+((r.original.index?.count??r.original.attributes.position.count)-(r.geometry.index?.count??r.geometry.attributes.position.count))/3,0);}};
}

function triangleKey(THREE,mesh,indices){const p=mesh.geometry.attributes.position,v=new THREE.Vector3();return indices.map(i=>v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray().map(n=>n.toFixed(3)).join(',')).sort().join('|');}
export function sourceTriangleKeys(THREE,root){root.updateMatrixWorld(true);const keys=new Set();root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<(index?.count??p.count);i+=3)keys.add(triangleKey(THREE,mesh,[0,1,2].map(j=>index?index.getX(i+j):i+j)));});return keys;}
export function districtContainsPilot(district,pilot){const b=district?.bounds,p=pilot?.boundsXZ;return !!(b&&p&&b[0]<=p[0]&&b[1]<=p[1]&&b[2]>=p[2]&&b[3]>=p[3]);}
export function pilotView(view,district,pilot){if(view.district!=='citywide'||!districtContainsPilot(district,pilot))return view;const b=pilot.boundsXZ;return {...view,target:{x:(b[0]+b[2])/2,z:(b[1]+b[3])/2},distance:1500};}
