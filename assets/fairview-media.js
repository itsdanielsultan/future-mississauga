// Deliberately separate from Existing/Future district comparisons. Both Fairview
// images show Existing context; only the captured pilot root changes visibility.
const ACCEPTED_FAIRVIEW_PROOFS=Object.freeze({'8a808803c3862fbf6676234423354bc298a8728d847e41ecb31c60191869ed82':'fm-fairview-pilot-d85914f94b931b996c6871c1'});
const identities=['neighbourhood/fairview/before','neighbourhood/fairview/after'];
const checks=['cameraParametersExactlyEqual','lightingParametersExactlyEqual','sourceFreezeExactlyEqual','normalizedCameraFramingEqual','nativePixelDimensionsEqual','bothScenarioExisting','onlyPilotVisibilityChanges','exact233Components9722Triangles','genericContextCameraLightingFixed','cleanOriginalFrameCompositionRGBVerified'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw new Error(message);};
export function matchedFairviewBinding(rows,proof,proofSHA256){
 if(!/^[a-f0-9]{64}$/.test(proofSHA256)||ACCEPTED_FAIRVIEW_PROOFS[proofSHA256]!==proof?.proofID)fail('Final accepted Fairview proof pin is required');
 if(proof.schema!=='future-mississauga-fairview-pilot-matched-view-proof/v2'||proof.state!=='VERIFIED_MATCHED_EXISTING_PILOT_COMPARISON_EQUAL_NATIVE_DIMENSIONS'||!/^fm-fairview-pilot-[a-f0-9]{24}$/.test(proof.proofID))fail('Fairview pilot comparison proof required');
 if(!Array.isArray(rows)||rows.length!==2||new Set(rows.map(row=>row.identity)).size!==2||!Array.isArray(proof.members)||!same(proof.members.map(row=>row.identity),identities))fail('Exact Fairview pair required');
 if(checks.some(key=>proof.checks?.[key]!==true)||proof.checks.imagesResizedOrCroppedByThisReview!==false)fail('Fairview native invariant checks required');
 const shared=proof.shared,comparison=proof.comparison;
 if(shared?.sourceFreeze?.state!=='FINAL_FROZEN'||!shared.camera||!shared.lightingAndColourManagement||shared.background!=='#e8f2f7'||!same(shared.pixelAspect,[1,1])||!same(shared.aspectRatio,{numerator:18,denominator:11})||shared.representationPolicy)fail('Fairview framing and context must remain fixed');
 const expected={kind:'native-neighbourhood-pilot-visibility',scenarioBoth:'existing',beforeIdentity:identities[0],afterIdentity:identities[1],pilotId:'oro-fairview-lowrise-context-pilot',sourceComponentsAdded:233,trianglesAdded:9722,mergedMeshesAdded:1,genericContextUnchanged:true,sourceDatesUnchanged:true};
 if(!comparison||Object.entries(expected).some(([key,value])=>comparison[key]!==value)||!/^[a-f0-9]{64}$/.test(comparison.actualNativeTransitionProofSHA256))fail('Fairview visibility transition must be explicit');
 const selected=identities.map(identity=>rows.find(row=>row.identity===identity));
 for(let i=0;i<2;i++){
  const member=proof.members[i],row=selected[i],master=row?.displayMaster,state=['before','after'][i];
  if(!row?.cleanPresentation||row.caption?.scenario!=='existing'||row.caption.comparisonState!==state||row.caption.geographicScope!=='neighbourhood'||member.scenario!=='existing'||member.comparisonState!==state||member.district!=='citywide'||member.geographicScope!=='neighbourhood')fail('Fairview is Existing context before and after');
  if(!same(member.renderRepresentation,{kind:'unaltered-native-scenario-import'})||row.renderRepresentation)fail('Fairview geometry adapter is not permitted');
  if(member.sourceSceneSHA256!==row.renderInfo?.sourceSceneSHA256||!same(member.cleanPNG?.dimensions,[1800,1100])||master?.width!==1800||master.height!==1100||member.cleanPNG.sha256!==master.sha256||member.cleanPNG.bytes!==master.bytes||member.cleanPNG.mimeType!=='image/png'||member.cleanPNG.nativePixelsNoUpscaling!==true||member.cleanPNG.crop!==false||member.cleanPNG.captionBaked!==false)fail('Fairview native master differs');
  if(!Array.isArray(member.responsiveImages)||member.responsiveImages.length!==row.responsivePreviews?.length||new Set(member.responsiveImages.map(image=>image.sha256)).size!==row.responsivePreviews.length)fail('Fairview derivatives missing');
  for(const image of member.responsiveImages){
   const actual=row.responsivePreviews.find(asset=>asset.sha256===image.sha256),[width,height]=image.dimensions;
   const rounding={nativeAspectExactlyPreserved:width===1800,dimensions:[width,height],nativeDimensions:[1800,1100],integerHeightRoundingPixels:height-1100*width/1800,rule:'width=min(nativeWidth,1200 or3200); height=round(nativeHeight*width/nativeWidth)',completeFrameResizedWithoutCrop:true};
   if(!same(image.integerPixelRounding,rounding))fail('Fairview responsive rounding declaration differs');
   if(!actual||image.bytes!==actual.bytes||image.mimeType!==actual.format||!same(image.dimensions,[actual.width,actual.height])||![1200,1800].includes(width)||height!==Math.round(1100*width/1800)||image.crop!==false||image.resized!==(width!==1800))fail('Fairview derivative differs');
  }
  if(row.responsive?.format!=='image/avif'||row.responsive.width!==1800||row.responsive.height!==1100||!row.responsivePreviews.some(image=>image.sha256===row.responsive.sha256&&image.format==='image/avif'))fail('Fairview responsive pair must retain its actual native size');
 }
 if(selected[0].renderInfo.sourceSceneSHA256===selected[1].renderInfo.sourceSceneSHA256)fail('Distinct Fairview native captures required');
 return {proofID:proof.proofID,sha256:proofSHA256,identities:[...identities],beforeSceneSHA256:selected[0].displayMaster.sha256,afterSceneSHA256:selected[1].displayMaster.sha256,beforeResponsiveSHA256:selected[0].responsive.sha256,afterResponsiveSHA256:selected[1].responsive.sha256,responsiveDimensions:[1800,1100],cameraMatched:true,lightingMatched:true,comparisonKind:'native-neighbourhood-pilot-visibility'};
}
