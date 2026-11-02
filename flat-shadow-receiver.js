// Flat City massing can share indexed vertices across sharp roof/wall edges.
// Its averaged vertex normals are unsuitable for a directional receiver offset.
// Compare each filtered sample against the actual receiver plane instead.
// This preserves contact shadows without changing source geometry or light bias.
export const FLAT_SHADOW_CACHE_KEY='flat-directional-shadow-receiver-v3';
export const FLAT_SHADOW_WRAPPER_VERSION=1;
const configured=new WeakMap();
const displaced='shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );';

// Identity metadata for exporters, not approval of an arbitrary predecessor.
// Inspecting does not invoke either hook or mutate the material. Consumers must
// separately recognise the previous hook before reproducing its behaviour.
export function inspectFlatShadowReceiver(material) {
  const descriptor=configured.get(material);
  return descriptor&&material.onBeforeCompile===descriptor.installedCompile&&material.customProgramCacheKey===descriptor.installedCacheKey?descriptor:null;
}

export function flatDirectionalShadowVertex(THREE) {
  const source=THREE.ShaderChunk.shadowmap_vertex;
  if(source.split(displaced).length!==2)throw new Error('Flat shadow receiver requires review for this Three shader version');
  return source.replace(displaced,`#if defined( SHADOWMAP_TYPE_PCF )\nshadowWorldPosition = worldPosition;\n#else\n${displaced}\n#endif`);
}

export function flatDirectionalShadowFragment(THREE) {
  const source=THREE.ShaderChunk.shadowmap_pars_fragment,lights=THREE.ShaderChunk.lights_fragment_begin;
  const start='float getShadow( sampler2DShadow',end='\n\t#elif defined( SHADOWMAP_TYPE_VSM )';
  const directionalCall='getShadow( directionalShadowMap';
  if(source.split(start).length!==2||source.split(end).length!==2||lights.split(directionalCall).length!==2)throw new Error('Flat shadow sampling requires review for this Three shader version');
  let sample=source.slice(source.indexOf(start),source.indexOf(end)).replace('float getShadow(','float getFlatDirectionalShadow(');
  const bias='shadowCoord.z += shadowBias;';
  if(sample.split(bias).length!==2)throw new Error('Flat shadow depth comparison changed');
  sample=sample.replace(bias,`${bias}
            vec3 receiverDx = dFdx( shadowCoord.xyz ), receiverDy = dFdy( shadowCoord.xyz );
            float receiverDet = receiverDx.x * receiverDy.y - receiverDx.y * receiverDy.x;
            vec2 receiverGradient = abs( receiverDet ) > 1e-14
              ? vec2( receiverDy.y * receiverDx.z - receiverDx.y * receiverDy.z,
                      receiverDx.x * receiverDy.z - receiverDy.x * receiverDx.z ) / receiverDet
              : vec2( 0.0 );
            // Hardware PCF compares four texels around each sample. Bound that
            // one-texel depth difference; the disk offset is corrected below.
            shadowCoord.z -= dot( abs( receiverGradient ), vec2( 1.0 ) / shadowMapSize );`);
  for(let i=0;i<5;i++){
    const offset=`vogelDiskSample( ${i}, 5, phi ) * radius`,comparison=`${offset}, shadowCoord.z`;
    if(sample.split(comparison).length!==2)throw new Error('Flat shadow filter samples changed');
    sample=sample.replace(comparison,`${offset}, shadowCoord.z + dot( receiverGradient, ${offset} )`);
  }
  return {
    // Retain the original routines exactly for spot/point lights and other modes.
    pars:source+'\n#if defined( USE_SHADOWMAP ) && defined( SHADOWMAP_TYPE_PCF )\n'+sample+'\n#else\n#define getFlatDirectionalShadow getShadow\n#endif\n',
    lights:lights.replace(directionalCall,'getFlatDirectionalShadow( directionalShadowMap')
  };
}

export function prepareFlatShadowReceiver(THREE,material) {
  if(!material?.isMeshStandardMaterial||!material.flatShading)return false;
  if(configured.has(material))return true;
  const chunk=flatDirectionalShadowVertex(THREE),fragment=flatDirectionalShadowFragment(THREE),previousCompile=material.onBeforeCompile;
  const previousCacheKeyFunction=material.customProgramCacheKey;
  const previousCacheKeyMode=previousCacheKeyFunction===THREE.Material.prototype.customProgramCacheKey?'compile-source':'bound-custom';
  const previousKey=previousCacheKeyMode==='compile-source'
    ?()=>previousCompile.toString():previousCacheKeyFunction.bind(material);
  const installedCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    const include='#include <shadowmap_vertex>';
    if(shader.vertexShader.split(include).length!==2)throw new Error('Flat shadow receiver include changed');
    shader.vertexShader=shader.vertexShader.replace(include,chunk);
    for(const [name,replacement] of [['shadowmap_pars_fragment',fragment.pars],['lights_fragment_begin',fragment.lights]]){
      const include=`#include <${name}>`;
      if(shader.fragmentShader.split(include).length!==2)throw new Error('Flat shadow fragment include changed');
      shader.fragmentShader=shader.fragmentShader.replace(include,replacement);
    }
  };
  const installedCacheKey=()=>previousKey()+'|'+FLAT_SHADOW_CACHE_KEY;
  material.onBeforeCompile=installedCompile;material.customProgramCacheKey=installedCacheKey;
  configured.set(material,Object.freeze({version:FLAT_SHADOW_WRAPPER_VERSION,cacheKey:FLAT_SHADOW_CACHE_KEY,
    previousCompile,previousCacheKeyFunction,previousCacheKeyBinding:material,previousCacheKeyMode,previousKey,
    installedCompile,installedCacheKey}));
  material.needsUpdate=true;return true;
}
