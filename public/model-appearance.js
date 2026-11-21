import {towerStageFinish,makeTowerStageMaterial} from './tower-stage-finish.js?v=20261121-stages';
import {voyaArchitecturalRole,VOYA_ARCHITECTURAL_PALETTE,VOYA_ARCHITECTURAL_SOURCE} from './voya-appearance.js?v=20261113-design2';
import {semanticMaterialSlots} from './semantic-material-slots.js?v=20261102-coherent1';
import {planningAppearanceKey,planningAppearanceColour} from './planning-appearance.js?v=20261121-print-key';
import {prepareFlatShadowReceiver} from './flat-shadow-receiver.js?v=20261102-shadow3';

export const NATURAL_MASSING_COLOUR=0xd3d8db;
export const ALDO_ROOF_SOURCE=Object.freeze({assetId:'aldo-1422-study',projectId:'aldo-1422-study',sha256:'7a5e6d178fd520086d7b3f465d5c7a938263b677bc7519e1cce1cd29f561a8ea'});
function aldoMembraneSlots(mesh){
  const {assetId,projectId,sourceAssetSHA256}=mesh.userData;
  if(assetId!==ALDO_ROOF_SOURCE.assetId||projectId!==ALDO_ROOF_SOURCE.projectId||sourceAssetSHA256!==ALDO_ROOF_SOURCE.sha256)return [];
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  return materials.flatMap((material,index)=>material?.name==='Plain black upper flat roof - Kyle correction 2026-10-09'?[index]:[]);
}

// Appearance never changes lifecycle, visibility, geometry, or source materials.
// Each registered mesh retains its exact original material (including arrays).
export function createModelAppearance(THREE,{initial='natural',classifyMunicipal,existingEnvelopeColour}={}) {
  const records=new WeakMap(),meshes=new Set();
  const neutral=new THREE.MeshStandardMaterial({color:NATURAL_MASSING_COLOUR,roughness:.82,metalness:0,side:THREE.DoubleSide,flatShading:true});
  prepareFlatShadowReceiver(THREE,neutral);
  const municipal=classifyMunicipal ? neutral.clone() : null;
  if(municipal){municipal.name='Municipal buildings by height';municipal.color.setHex(0xffffff);municipal.vertexColors=true;prepareFlatShadowReceiver(THREE,municipal);}
  const statusMaterials=new Map(),displayMaterials=new Set([neutral]);
  if(municipal)displayMaterials.add(municipal);
  const envelopeMaterials = new Map();
  function sourceEnvelopeMaterial(mesh) {
    const colour = existingEnvelopeColour?.(mesh);
    if (!colour) return null;
    if (!envelopeMaterials.has(colour)) {
      const material = neutral.clone();
      material.color.set(colour);
      prepareFlatShadowReceiver(THREE, material);
      envelopeMaterials.set(colour, material);
      displayMaterials.add(material);
    }
    return envelopeMaterials.get(colour);
  }
  const towerMaterials=new WeakMap();
  function retainTowerFinish(source,role,retained) {
    let variants=towerMaterials.get(source);
    if(!variants){variants=new Map();towerMaterials.set(source,variants);}
    const key=role.lifecycle+'-'+role.exchange;
    let variant=variants.get(key);
    if(!variant){
      const material=makeTowerStageMaterial(THREE,source,role);
      variant={material,users:0,variants,key};
      variants.set(key,variant);displayMaterials.add(material);
    }
    variant.users++;retained.push(variant);
    return variant.material;
  }
  let mode=initial==='status'?'status':'natural';
  function statusMaterial(mesh){
    const key=planningAppearanceKey(mesh.userData);
    if(!key)return neutral;
    if(!statusMaterials.has(key)){
      const material=new THREE.MeshStandardMaterial({color:planningAppearanceColour(key),roughness:.82,metalness:0,side:THREE.DoubleSide,flatShading:true});
      prepareFlatShadowReceiver(THREE,material);
      statusMaterials.set(key,material);displayMaterials.add(material);
    }
    return statusMaterials.get(key);
  }
  function apply(mesh){
    const record=records.get(mesh);if(!record)return;
    mesh.material=mode==='status'?(record.stage||statusMaterial(mesh)):record.natural;
  }
  function register(mesh,{authored=false}={}){
    if(!mesh?.isMesh)return false;
    if(!records.has(mesh)){
      const original=mesh.material,owned=[],retained=[];let natural=original;
      const sourceGeometry=!authored && classifyMunicipal?.(mesh);
      const envelope = authored ? null : sourceEnvelopeMaterial(mesh);
      const voyaRole=voyaArchitecturalRole(mesh);
      if(voyaRole){
        const finish=VOYA_ARCHITECTURAL_PALETTE[voyaRole];
        if(finish){
          const replacement=original.clone();replacement.color.setHex(finish.color);
          replacement.roughness=finish.roughness;replacement.metalness=finish.metalness;replacement.vertexColors=finish.vertexColors;
          natural=replacement;owned.push(replacement);displayMaterials.add(replacement);
        }
        // The guarded planted-area role keeps its original material reference.
      }else if(!authored)natural=sourceGeometry?municipal:(envelope||neutral);
      else {
        const slots=semanticMaterialSlots(mesh),membrane=aldoMembraneSlots(mesh),source=Array.isArray(original)?original:[original];
        if(slots.length||membrane.length){
          const display=[...source];
          for(const index of new Set([...slots,...membrane])){
            const material=source[index];
            // A linked texture is never treated as a semantic palette finish.
            if(!material?.color||material.map)continue;
            const replacement=material.clone();replacement.color.setHex(membrane.includes(index)?0x2c2c2c:NATURAL_MASSING_COLOUR);
            display[index]=replacement;owned.push(replacement);displayMaterials.add(replacement);
          }
          if(owned.length)natural=Array.isArray(original)?display:display[0];
        }
      }
      let stage = sourceGeometry ? municipal : envelope;
      if (voyaRole && (mesh.name.startsWith('voya-podium-') || voyaRole==='band')) stage = natural;
      const voya=VOYA_ARCHITECTURAL_SOURCE;
      if(authored && mesh.userData.assetId===voya.assetId && mesh.userData.projectId===voya.projectId &&
          mesh.userData.sourceAssetSHA256===voya.sha256 && /^(taller|shorter)[ _]cityside[ _]/.test(mesh.name)) stage=original;
      if (authored) {
        const parts = Array.isArray(original) ? original : [original];
        const roles = parts.map(material=>towerStageFinish(mesh,material));
        if (roles.some(Boolean)) {
          const materials = parts.map((part,index)=>{
            const role = roles[index];
            if (!role?.tint) return part;
            return retainTowerFinish(part,role,retained);
          });
          stage = Array.isArray(original) ? materials : materials[0];
        }
      }
      records.set(mesh,{original,sourceGeometry,natural,stage,owned,retained});meshes.add(mesh);
    }
    apply(mesh);return true;
  }
  function unregister(mesh){
    const record=records.get(mesh);if(!record)return false;
    // Restore before normal scene disposal so its source materials and textures
    // are collected once, rather than leaking behind a display override.
    mesh.material=record.original;
    if(record.sourceGeometry){const display=mesh.geometry;mesh.geometry=record.sourceGeometry;display.dispose();}
    for(const variant of record.retained){
      if(--variant.users===0){
        variant.material.dispose();displayMaterials.delete(variant.material);variant.variants.delete(variant.key);
      }
    }
    for(const material of record.owned){material.dispose();displayMaterials.delete(material);}
    records.delete(mesh);meshes.delete(mesh);return true;
  }
  return {
    get mode(){return mode;},
    register,unregister,
    setMode(value){if(value!=='natural'&&value!=='status')throw new TypeError('Unknown model appearance');mode=value;meshes.forEach(apply);},
    isDisplayMaterial:material=>displayMaterials.has(material),
    dispose(){for(const mesh of [...meshes])unregister(mesh);displayMaterials.forEach(material=>material.dispose());statusMaterials.clear();displayMaterials.clear();}
  };
}
