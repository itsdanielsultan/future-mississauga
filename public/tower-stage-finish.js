import rules from './data/tower-stage-calibration.json' with {type:'json'};

const protectedPart = new RegExp(rules.protectedParts,'i');
const exchangeCrown = new RegExp(rules.exchange.crownMaterial,'i');
const mCityMaterials = Object.fromEntries(Object.entries(rules.towerMaterials)
  .map(([project,pattern])=>[project,new RegExp(pattern,'i')]));

// The two Exchange files keep the municipal texture atlas and the phase split.
// Heights are source Y coordinates. A single primitive includes both podium and tower.
export function towerStageFinish(mesh, material) {
  const {assetId,projectId,sourceAssetSHA256,lifecycle} = mesh.userData;
  const exchange = projectId === 'exchange-district';
  if (!rules.maskClasses[lifecycle] || (!exchange && !mCityMaterials[projectId])) return null;
  if (assetId) {
    const asset = rules.assets[assetId];
    if (!asset || asset.project !== projectId || !asset.sha256.includes(sourceAssetSHA256)) return null;
  } else if (!exchange || sourceAssetSHA256 !== rules.exchange.wholeAssetSHA256) return null;
  const name = mesh.name;
  if (exchange) {
    const facade = /exchange_63-615[56]_node/i.test(name) && !exchangeCrown.test(name+material.name);
    return {tint:facade,exchange:true,lifecycle};
  }
  return {tint:!protectedPart.test(name) && mCityMaterials[projectId].test(material.name),exchange:false,lifecycle};
}

export function makeTowerStageMaterial(THREE, source, role) {
  const copy = source.clone();
  const rgb = rules.materials[role.lifecycle].slice(1).match(/../g).map(byte=>parseInt(byte,16)/255);
  const luminance = .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  const colour = rgb.map(channel=>(channel/luminance).toFixed(6)).join(',');
  const {podiumCeilingY,verticalCosineMax} = rules.exchange;
  const originalHook = source.onBeforeCompile;
  copy.onBeforeCompile = function(shader, renderer) {
    originalHook?.call(this,shader,renderer);
    if (role.exchange) {
      shader.vertexShader = 'varying vec2 fmExchangeFace;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nfmExchangeFace=vec2(position.y,abs(normal.y));');
      shader.fragmentShader = 'varying vec2 fmExchangeFace;\n'+shader.fragmentShader;
    }
    const applyToFace = role.exchange ?
      'step('+podiumCeilingY.toFixed(1)+',fmExchangeFace.x)*(1.0-step('+verticalCosineMax.toFixed(2)+',fmExchangeFace.y))' : '1.0';
    const tone = role.lifecycle==='existing' ? 'level*.85' : role.lifecycle==='under_construction' ? '(.14+.86*level)' : 'level';
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 srgb = pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2));
      float level = dot(srgb,vec3(.2126,.7152,.0722));
      float chroma = max(max(srgb.r,srgb.g),srgb.b)-min(min(srgb.r,srgb.g),srgb.b);
      float amount = .88*clamp((.373-chroma)/.176,0.0,1.0)*${applyToFace};
      vec3 tint = clamp(${tone}*vec3(${colour}),0.0,1.0);
      diffuseColor.rgb = pow(mix(srgb,tint,amount),vec3(2.2));`);
  };
  copy.customProgramCacheKey = () => 'city-tower-stage-'+rules.version+'-'+role.lifecycle+'-'+role.exchange+'-'+source.customProgramCacheKey();
  return copy;
}

export const exchangeSourceDigest = rules.exchange.wholeAssetSHA256;
export const exchangeStageAsset = {url:rules.exchange.publicFile, sha256:rules.exchange.publicSHA256};
