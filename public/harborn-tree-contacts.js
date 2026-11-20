// Four synthetic woodland crowns with proven exact triangle intersections.
// Inventory points and base tree data remain intact. Only Future with the
// qualified Harborn replacement visible suppresses these illustrative crowns.
const assetId='harborn-50-60-current-plan';
const sourceIds=new Set([2000121368,2000120712,2000120711,2000120531]);
const records=new WeakMap();
export function registerHarbornTreeContacts(THREE,mesh,rows,treeMode){
 if(treeMode==='baseline')return;
 const matches=[];
 rows.forEach((row,index)=>{if(sourceIds.has(row[0])){if(row[0]<2000000000)throw Error('Mapped inventory tree cannot be suppressed by Harborn contact adapter');const original=new THREE.Matrix4();mesh.getMatrixAt(index,original);const suppressed=original.clone().scale(new THREE.Vector3(0,0,0));matches.push({sourceTreeId:row[0],index,original,suppressed});}});
 if(!matches.length)return;
 records.set(mesh,{matches,active:false});
 mesh.userData.harbornProvenTreeContacts={schema:'harborn-proven-synthetic-crown-contact/v1',assetId,sourceTreeIds:matches.map(r=>r.sourceTreeId),instanceIndices:matches.map(r=>r.index),active:false,scope:'Future only when Harborn replacement is visible; exact triangle contact evidence; inventory coordinates retained',evidence:'2026-11-13 Harborn exact native triangle audit:4synthetic crowns,1072surface pairs'};
}
export function applyHarbornTreeContacts(meshes,which,visibleAssetIds){
 const active=which==='future'&&Boolean(visibleAssetIds?.has(assetId));
 for(const mesh of meshes){const record=records.get(mesh);if(!record||record.active===active)continue;for(const row of record.matches)mesh.setMatrixAt(row.index,active?row.suppressed:row.original);mesh.instanceMatrix.needsUpdate=true;record.active=active;mesh.userData.harbornProvenTreeContacts.active=active;}
}
