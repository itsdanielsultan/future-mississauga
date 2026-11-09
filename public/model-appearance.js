import {voyaArchitecturalRole,VOYA_ARCHITECTURAL_PALETTE} from './voya-appearance.js?v=20261102-voya1';
import {semanticMaterialSlots} from './semantic-material-slots.js?v=20261102-coherent1';
import {planningAppearanceKey,planningAppearanceColour} from './planning-appearance.js?v=20261109-feedback1';
import {prepareFlatShadowReceiver} from './flat-shadow-receiver.js?v=20261102-shadow3';

export const NATURAL_MASSING_COLOUR=0xd3d8db;

// Appearance never changes lifecycle, visibility, geometry, or source materials.
// Each registered mesh retains its exact original material (including arrays).
export function createModelAppearance(THREE,{initial='natural'}={}) {
  const records=new WeakMap(),meshes=new Set();
  const neutral=new THREE.MeshStandardMaterial({color:NATURAL_MASSING_COLOUR,roughness:.82,metalness:0,side:THREE.DoubleSide,flatShading:true});
  prepareFlatShadowReceiver(THREE,neutral);
  const statusMaterials=new Map(),displayMaterials=new Set([neutral]);
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
    mesh.material=mode==='status'?statusMaterial(mesh):record.natural;
  }
  function register(mesh,{authored=false}={}){
    if(!mesh?.isMesh)return false;
    if(!records.has(mesh)){
      const original=mesh.material,owned=[];let natural=original;
      const voyaRole=voyaArchitecturalRole(mesh);
      if(voyaRole){
        const finish=VOYA_ARCHITECTURAL_PALETTE[voyaRole];
        if(finish){
          const replacement=original.clone();replacement.color.setHex(finish.color);
          replacement.roughness=finish.roughness;replacement.metalness=finish.metalness;replacement.vertexColors=finish.vertexColors;
          natural=replacement;owned.push(replacement);displayMaterials.add(replacement);
        }
        // The guarded planted-area role keeps its original material reference.
      }else if(!authored)natural=neutral;
      else {
        const slots=semanticMaterialSlots(mesh),source=Array.isArray(original)?original:[original];
        if(slots.length){
          const display=[...source];
          for(const index of slots){
            const material=source[index];
            // A linked texture is never treated as a semantic palette finish.
            if(!material?.color||material.map)continue;
            const replacement=material.clone();replacement.color.setHex(NATURAL_MASSING_COLOUR);
            display[index]=replacement;owned.push(replacement);displayMaterials.add(replacement);
          }
          if(owned.length)natural=Array.isArray(original)?display:display[0];
        }
      }
      records.set(mesh,{original,natural,owned});meshes.add(mesh);
    }
    apply(mesh);return true;
  }
  function unregister(mesh){
    const record=records.get(mesh);if(!record)return false;
    // Restore before normal scene disposal so its source materials and textures
    // are collected once, rather than leaking behind a display override.
    mesh.material=record.original;for(const material of record.owned){material.dispose();displayMaterials.delete(material);}records.delete(mesh);meshes.delete(mesh);return true;
  }
  return {
    get mode(){return mode;},
    register,unregister,
    setMode(value){if(value!=='natural'&&value!=='status')throw new TypeError('Unknown model appearance');mode=value;meshes.forEach(apply);},
    isDisplayMaterial:material=>displayMaterials.has(material),
    dispose(){for(const mesh of [...meshes])unregister(mesh);displayMaterials.forEach(material=>material.dispose());statusMaterials.clear();displayMaterials.clear();}
  };
}
