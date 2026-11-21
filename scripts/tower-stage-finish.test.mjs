import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import rules from '../public/data/tower-stage-calibration.json' with {type:'json'};
import {towerStageFinish,makeTowerStageMaterial} from '../public/tower-stage-finish.js';
import {prepareAppearancePreference} from '../public/appearance-preference.js';

test('only registered shaft materials take a stage tint, with Exchange roofs and the shared podium retained',()=>{
  const [assetId,asset]=Object.entries(rules.assets).find(([key])=>key.includes('m3-likeness'));
  const material=new THREE.MeshStandardMaterial();material.name='glazing';
  const mesh={name:'Measured-glazing-contour_exterior_shell',userData:{projectId:'mcity-3',assetId,sourceAssetSHA256:asset.sha256[0],lifecycle:'under_construction'}};
  assert.equal(towerStageFinish(mesh,material).tint,true);
  assert.equal(towerStageFinish({...mesh,name:'Podium glazing'},material).tint,false);
  assert.equal(towerStageFinish({...mesh,userData:{...mesh.userData,sourceAssetSHA256:'unreviewed'}},material),null);
  const exchange={name:'EX1__exchange_63-6155_node1313_region0',userData:{lifecycle:'under_construction',projectId:'exchange-district',sourceAssetSHA256:rules.exchange.wholeAssetSHA256}};
  const role=towerStageFinish(exchange,material);
  assert.equal(role.tint,true);
  assert.equal(towerStageFinish({...exchange,name:'EX1__exchange_63-6155_node1311_region4'},material).tint,false);
  const tinted=makeTowerStageMaterial(THREE,material,role),shader={vertexShader:'#include <beginnormal_vertex>',fragmentShader:'#include <color_fragment>'};
  tinted.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/step\(106\.5,/);
  assert.match(shader.fragmentShader,/chroma/);
  assert.notEqual(tinted,material);
});
test('a signed map link opens its display mode without writing over the saved choice',()=>{
  const storage={getItem:()=>'natural',setItem:()=>assert.fail('must not persist linked appearance')};
  const select=()=>({dataset:{},addEventListener(){}});
  assert.equal(prepareAppearancePreference(select(),storage,'?appearance=status'),'status');
  assert.equal(prepareAppearancePreference(select(),storage,''),'natural');
  assert.equal(prepareAppearancePreference(select(),storage,'?appearance=bad'),'natural');
});
