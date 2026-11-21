// Browser-only workaround for the diagnosed roof shadow-map bands.
// Keep the source roof, materials, casting and every other receiver intact.
const sourceSHA256='ba94ff2fab61ceac6453406e8966d055d163fbe6e8587393b91b143f8d37319b';
const records=new WeakMap();
export function setSouthCommonRoofShadowFallback(mesh,modelSHA256,enabled=true){
  if(mesh?.userData?.assetId!=='south-common-source-derived-preview'||mesh.material?.name!=='Flat roof membrane / approximate finish')return false;
  const record=records.get(mesh);
  if(!enabled){
    if(record){mesh.receiveShadow=record.receiveShadow;records.delete(mesh);delete mesh.userData.southCommonRoofShadowFallback;}
    return false;
  }
  if(modelSHA256!==sourceSHA256)throw new Error('South Common roof source changed; review shadow workaround');
  const p=mesh.geometry?.getAttribute('position'),ix=mesh.geometry?.getIndex();
  if(p?.count!==54||(ix?ix.count:p.count)!==54)throw new Error('Unexpected South Common roof primitive');
  if(!record)records.set(mesh,{receiveShadow:mesh.receiveShadow});
  mesh.receiveShadow=false;
  mesh.userData.southCommonRoofShadowFallback={sourceSHA256,scope:'Browser shadow-map workaround on the existing roof only; roof casting retained.',tradeoff:'This roof does not receive browser shadow-map shadows. Source geometry and offline raytraced rendering remain unchanged.'};
  return true;
}
