import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cityModelStudies,cityStudyPlacements} from '../public/city-model-studies.js';
import {trustedModelURL} from '../public/model-preview-loading.js';

export async function validateCityModelStudies(site){
 const catalogue=JSON.parse(await readFile(join(site,'data/model-previews.json')));
 const refinements=JSON.parse(await readFile(join(site,'data/refinement-models.json')));
 const assets=cityModelStudies(refinements.assets,catalogue).filter(asset=>asset.defaultVisible);
 assert.equal(assets.length,cityStudyPlacements.length);
 const used=[];
 for(const asset of assets){
  assert(asset.bounds.length===2&&asset.bounds.every(row=>row.length===3&&row.every(Number.isFinite)));
  assert(asset.bounds[0].every((value,axis)=>value<=asset.bounds[1][axis]));
  if(asset.lowerShell){assert.equal(asset.id,'oro-20261027-composite');assert.equal(asset.status,'Under Construction');assert.deepEqual(asset.modes,['construction','future']);assert.equal(asset.constructionDesign,true);assert.equal(asset.lowerShell.plane,69.55);assert.deepEqual(asset.replacesSourceIds,['63-6206','63-6207']);assert.equal(asset.registration.scale,1);}else{assert.equal(asset.status,'Existing');assert.deepEqual(asset.modes,['existing','construction','future']);}
  assert(asset.preserveMaterials&&asset.preserveSourceNormals&&asset.uncertainGeometry);
  if(asset.translation)assert(asset.translation.length===3&&asset.translation.every(Number.isFinite));
  if(asset.rotationYDegrees!==undefined)assert(Number.isFinite(asset.rotationYDegrees));
  if(asset.replacementBounds){assert(asset.replacementBounds.length===2&&asset.replacementBounds.every(row=>row.length===3&&row.every(Number.isFinite)));assert(asset.replacementBounds[0].every((v,axis)=>v<=asset.replacementBounds[1][axis]));}
  for(const preview of asset.previewAssets){
   assert(trustedModelURL(preview.url));assert.match(preview.sha256,/^[a-f0-9]{64}$/);assert.match(preview.downloadSHA256,/^[a-f0-9]{64}$/);
   used.push(preview.id);
  }
 }
 assert.deepEqual(used,['mcity-m1','mcity-m2','avia-1','avia-2','avia-podium','edge-1','edge-2','artform','oro','sgm-maritz-6710','ergocentric-275-superior']);
 const avia=assets.find(a=>a.projectId==='avia');assert.deepEqual(avia.translation,[-6040,88.3,-10]);assert.deepEqual(avia.replacesSourceIds,['63-6237']);
 for(const asset of assets.filter(a=>a.projectId==='mcity-1-2')){assert(!asset.translation);assert(asset.replacementTriangleKeys.length);}
 return {assemblies:assets.length,existingPublicAssets:used,completedModelsAllScenarios:true,intendedOroScenarios:['construction','future'],atomicAssemblies:true,assetHashesValidatedByModelPreviewCatalogue:true};
}
