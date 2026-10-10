// Source-based building replacements. Separate superseded municipal building faces once at load time.
// Roads, terrain, transit and all source GLB bytes remain untouched.
export function splitSourceOverlaps(THREE,root,assets){
 const regions=assets.filter(a=>a.localReview&&a.replacementFootprintsXZ?.length).flatMap(a=>a.replacementFootprintsXZ.map(poly=>({poly,asset:a,minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),minZ:Math.min(...poly.map(p=>p[1])),maxZ:Math.max(...poly.map(p=>p[1]))})));
 if(!regions.length)return [];
 root.updateMatrixWorld(true);const originals=[];root.traverse(o=>{if(o.isMesh&&/existing/i.test(o.userData.Status||''))originals.push(o);});const audit=[],scratch=new THREE.Vector3();
 for(const o of originals){const geo=o.geometry,pos=geo.getAttribute('position');if(!pos)continue;const box=new THREE.Box3().setFromObject(o);const possible=regions.filter(r=>box.max.x>=r.minX&&box.min.x<=r.maxX&&box.max.z>=r.minZ&&box.min.z<=r.maxZ);if(!possible.length)continue;
 const indices=geo.getIndex(),length=indices?.count??pos.count,kept=[],fallbackGroups=new Map();
 const matrix=o.matrixWorld.elements;
 for(let k=0;k<length;k+=3){const a=indices?indices.getX(k):k,b=indices?indices.getX(k+1):k+1,c=indices?indices.getX(k+2):k+2;
 const lx=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,ly=(pos.getY(a)+pos.getY(b)+pos.getY(c))/3,lz=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3;
 const x=matrix[0]*lx+matrix[4]*ly+matrix[8]*lz+matrix[12],z=matrix[2]*lx+matrix[6]*ly+matrix[10]*lz+matrix[14];
 const hits=possible.filter(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ&&inside(x,z,r.poly));
 if(!hits.length){kept.push(a,b,c);continue;}
 const bindings=[...new Map(hits.map(r=>[r.asset.id,{assetId:r.asset.id,modes:r.asset.replacementModes||r.asset.modes}])).values()].sort((a,b)=>a.assetId.localeCompare(b.assetId)),key=bindings.map(b=>b.assetId).join('|');
 if(!fallbackGroups.has(key))fallbackGroups.set(key,{indices:[],bindings});fallbackGroups.get(key).indices.push(a,b,c);
 }
 if(kept.length===length)continue;
 const make=index=>{const g=new THREE.BufferGeometry();for(const name of Object.keys(geo.attributes))g.setAttribute(name,geo.getAttribute(name));g.setIndex(index);const box=new THREE.Box3();for(const i of index)box.expandByPoint(scratch.fromBufferAttribute(pos,i));g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new THREE.Sphere());return g;};
 o.geometry=make(kept);o.userData.preserveSourceNormals=true;
 // Keep exact municipal faces as a fallback in every supported mode. Hide them
 // only when one of their replacement models is actually visible.
 for(const group of fallbackGroups.values()){const prior=new THREE.Mesh(make(group.indices),o.material);prior.name='Municipal fallback / '+o.name;prior.userData={...o.userData,sourceReplacements:group.bindings,sourceLayerSeparated:true,preserveSourceNormals:true};prior.position.copy(o.position);prior.quaternion.copy(o.quaternion);prior.scale.copy(o.scale);o.parent.add(prior);}
 audit.push({source:o.name,remainingTriangles:kept.length/3,fallbackTriangles:[...fallbackGroups.values()].reduce((n,g)=>n+g.indices.length/3,0),removedAllModesTriangles:0});
 // The old geometry is no longer used; copied BufferAttributes preserve exact source values.
 geo.dispose();
 }
 return audit;
}
function inside(x,z,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)yes=!yes;}return yes;}
