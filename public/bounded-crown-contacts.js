// Exact incident crown adjustments; municipal source points remain intact.
// Candidate only. Bind to accepted geometry and native visual review before release.
const rules = [{"id":2000139098,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000139237,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000139374,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000139541,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000139542,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000139722,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":2000026871,"assetId":"leanne-2155-current-plan","modes":["future"],"kind":"synthetic-suppression","horizontalScale":0,"verticalScale":0},{"id":490210,"assetId":"dundas-55-2025-plan","modes":["future"],"kind":"mapped-crown-radius-only","horizontalScale":0.95,"verticalScale":1},{"id":247330,"assetId":"south-common-source-derived-preview","modes":["future"],"kind":"mapped-crown-radius-only","horizontalScale":0.9,"verticalScale":1},{"id":358997,"assetId":"south-common-source-derived-preview","modes":["future"],"kind":"mapped-crown-radius-only","horizontalScale":0.85,"verticalScale":1},{"id":247440,"assetId":"south-common-source-derived-preview","modes":["future"],"kind":"mapped-crown-radius-only","horizontalScale":0.6,"verticalScale":1},{"id":430919,"assetId":"winding-trail-1355-local-integration","modes":["existing","construction","future"],"kind":"mapped-crown-radius-only","horizontalScale":0.85,"verticalScale":1}];
const byId=new Map(rules.map(r=>[r.id,r]));
const records=new WeakMap();
export function registerBoundedCrownContacts(THREE,mesh,rows,treeMode){
 const matches=[];
 rows.forEach((row,index)=>{const rule=byId.get(row[0]);if(!rule)return;
  if(treeMode==='baseline'&&!rule.modes.includes('existing'))return;
  if(rule.kind==='synthetic-suppression'&&row[0]<2000000000)throw Error('Mapped source point cannot be suppressed');
  const original=new THREE.Matrix4();mesh.getMatrixAt(index,original);
  const adjusted=original.clone().scale(new THREE.Vector3(rule.horizontalScale,rule.verticalScale,rule.horizontalScale));
  if(original.elements.slice(12,15).some((v,i)=>v!==adjusted.elements[12+i]))throw Error('Crown source position changed');
  matches.push({rule,index,original,adjusted,active:false});
 });
 if(!matches.length)return;
 records.set(mesh,matches);
 mesh.userData.boundedCrownContacts={schema:'exact-crown-contact/v1',treeMode,ids:matches.map(r=>r.rule.id),indices:matches.map(r=>r.index),rules:matches.map(r=>r.rule),activeIds:[],scope:'Illustrative crown correction only; mapped source points and source data retained.'};
}
export function applyBoundedCrownContacts(meshes,which,visibleAssetIds){
 for(const mesh of meshes){const matches=records.get(mesh);if(!matches)continue;let changed=false;
  for(const r of matches){const active=r.rule.modes.includes(which)&&Boolean(visibleAssetIds?.has(r.rule.assetId));if(active===r.active)continue;mesh.setMatrixAt(r.index,active?r.adjusted:r.original);r.active=active;changed=true;}
  if(changed)mesh.instanceMatrix.needsUpdate=true;
  mesh.userData.boundedCrownContacts.activeIds=matches.filter(r=>r.active).map(r=>r.rule.id);
 }
}
