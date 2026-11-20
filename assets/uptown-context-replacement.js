// A bounded Uptown view can include the accepted M1 study south of its crop.
// Reuse its registered municipal triangle keys. Do not invent footprint masks.
export function createUptownContextReplacement({THREE,asset,splitSourceOverlaps}){
 const id='mcity-m1-20261025-exterior-study',prepared=new WeakSet();
 if(!asset||asset.id!==id||asset.replacementTriangleKeys?.length!==136||typeof splitSourceOverlaps!=='function')throw new Error('Uptown M1 replacement binding is unavailable');
 const modes=new Set(asset.replacementModes||asset.modes||[]);
 return {prepare(root){
  if(!root)return [];
  const candidates=[];root.traverse(o=>{if(o.isMesh&&!prepared.has(o))candidates.push(o);});
  if(!candidates.length)return [];
  const sourceView={updateMatrixWorld:force=>root.updateMatrixWorld(force),traverse:visit=>candidates.forEach(visit)};
  const audit=splitSourceOverlaps(THREE,sourceView,[asset]);candidates.forEach(o=>prepared.add(o));
  root.traverse(o=>{if(o.isMesh&&o.userData.sourceLayerSeparated&&o.userData.sourceReplacements?.some(b=>b.assetId===id)){
   if(!prepared.has(o)){const original=o.parent?.children.find(x=>x!==o&&x.name===o.name.replace(/^Municipal fallback \/ /,''));o.userData.uptownFallbackInitiallyVisible=original?original.visible:true;}
   o.userData.uptownContextReplacement=id;prepared.add(o);
  }});
  return audit;
 },update(root,{district,scenario,visibleAssetIds=new Set()}={}){
  let fallbackTriangles=0,hiddenTriangles=0,meshes=0;
  const active=district==='uptown'&&modes.has(scenario)&&visibleAssetIds.has(id);
  root?.traverse(o=>{if(!o.isMesh||o.userData.uptownContextReplacement!==id)return;
   const count=(o.geometry.index?.count??o.geometry.getAttribute('position')?.count??0)/3;
   o.visible=Boolean(o.userData.uptownFallbackInitiallyVisible)&&!active;fallbackTriangles+=count;if(!o.visible)hiddenTriangles+=count;meshes++;
  });
  return {assetId:id,district,scenario,assetActuallyVisible:visibleAssetIds.has(id),fallbackTriangles,hiddenTriangles,meshes};
 }};
}
