import {pictureProvenance} from './image-provenance.js?v=20261101-gallery1';

// Exact active scene identities, verified against the gallery and Social consumers.
export const ACTIVE_PICTURE_IDENTITIES=Object.freeze([
  "portraits/clarkson-existing.png",
  "portraits/clarkson-future.png",
  "portraits/clarkson-portrait-future.png",
  "portraits/cooksville-future.png",
  "portraits/cooksville-portrait-future.png",
  "portraits/downtown-existing.png",
  "portraits/downtown-future.png",
  "portraits/downtown-junction-future.png",
  "portraits/downtown-landmark-future.png",
  "portraits/downtown-portrait-future.png",
  "portraits/downtown-skyline-construction.png",
  "portraits/downtown-skyline-existing.png",
  "portraits/downtown-skyline-future.png",
  "portraits/erin-mills-future.png",
  "portraits/lakeview-existing.png",
  "portraits/lakeview-future.png",
  "portraits/lakeview-portrait-future.png",
  "portraits/port-credit-existing.png",
  "portraits/port-credit-future.png",
  "portraits/port-credit-portrait-future.png",
  "portraits/port-credit-skyline-future.png",
  "portraits/streetsville-future.png",
  "portraits/uptown-future.png",
  "portraits/uptown-portrait-future.png",
  "wide/airport-corporate-future.png",
  "wide/citywide-future.png",
  "wide/clarkson-existing.png",
  "wide/clarkson-future.png",
  "wide/clarkson-portrait-future.png",
  "wide/clarkson-skyline-future.png",
  "wide/cooksville-future.png",
  "wide/cooksville-portrait-future.png",
  "wide/dixie-applewood-future.png",
  "wide/downtown-existing.png",
  "wide/downtown-future.png",
  "wide/downtown-junction-future.png",
  "wide/downtown-landmark-future.png",
  "wide/downtown-portrait-future.png",
  "wide/downtown-skyline-construction.png",
  "wide/downtown-skyline-existing.png",
  "wide/downtown-skyline-future.png",
  "wide/erin-mills-future.png",
  "wide/erindale-future.png",
  "wide/heartland-future.png",
  "wide/lakeview-existing.png",
  "wide/lakeview-future.png",
  "wide/lakeview-portrait-future.png",
  "wide/lakeview-skyline-future.png",
  "wide/malton-future.png",
  "wide/meadowvale-future.png",
  "wide/port-credit-existing.png",
  "wide/port-credit-future.png",
  "wide/port-credit-portrait-future.png",
  "wide/port-credit-skyline-future.png",
  "wide/streetsville-future.png",
  "wide/uptown-future.png",
  "wide/uptown-portrait-future.png"
]);
export const ACTIVE_NEIGHBOURHOOD_IDENTITIES=Object.freeze(['neighbourhood/fairview/before','neighbourhood/fairview/after']);
const areas=Object.freeze({downtown:'Downtown',citywide:'All Mississauga','airport-corporate':'Airport & Corporate',clarkson:'Clarkson',cooksville:'Cooksville','dixie-applewood':'Dixie & Applewood','erin-mills':'Erin Mills',erindale:'Erindale & Sheridan',heartland:'Heartland & Gateway',lakeview:'Lakeview',malton:'Malton',meadowvale:'Meadowvale & Lisgar','port-credit':'Port Credit',streetsville:'Streetsville',uptown:'Uptown & Hurontario'});
const superiorCredit='275 Superior Boulevard photo reference: David Lasker/Cityscape Photography · davidlaskerphotography.com';
const zeidlerCredit='Architectural massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario. Independent city placement and visualisation by Future Mississauga.';
const compactCredits=Object.freeze({
 [zeidlerCredit]:'Massing © Zeidler Architecture Inc.; supplied by Infrastructure Ontario.'
});
const acceptedCameraScopes={
 "wide/lakeview-skyline-future.png":{"scope":"Lakeview Village, coastal neighbourhoods and source-backed project context; bounded camera framing to avoid finite inland scene boundary.","manifest":"0f2ddf35f4459ff02b22091a09a7984c6b1228e5886fbcd5015b1cf27cab89e9"},
 "wide/lakeview-portrait-future.png":{"scope":"Lakeview Village, coastal neighbourhoods and source-backed project context; bounded camera framing to avoid finite inland scene boundary.","manifest":"4a4af72a73a8b8a31f347a30c9f3d3b3269896a0a1bc3c9285c14261924b5dbb"},
 "portraits/lakeview-portrait-future.png":{"scope":"Lakeview Village, coastal neighbourhoods and source-backed project context; bounded camera framing to avoid finite inland scene boundary.","manifest":"736c82e6a3e04d5c5bbe310059eb5dfbf30a2b56d7a086b7f1804078f3a62aa5"},
 'wide/airport-corporate-future.png':{scope:'Airport Corporate office core and immediate native context; not wholeairportoverview',manifest:'745a236ca60e9d68ac03d17d5a1d110dd0aadb40dd11555c87900bfe953e9033'},
 'wide/dixie-applewood-future.png':{scope:'InteriorDixie/Applewood district focus with immediate native context',manifest:'2f091fc41b7116a86526f4db2e0ac37fb03d0fd083b70746267898af229d129f'},
 'wide/malton-future.png':{scope:'Malton district interior and immediate native context; tighter framing of the same focus',manifest:'f6c42aac80bfe96e80bb6504b83a4b063259f430296ed8a801fe457383dda854'},
 'portraits/port-credit-skyline-future.png':{scope:'Port Credit skyline and existing coastal source context, framed inward from finite water extent',manifest:'d538e14351a32307748d0bfa900677f8add8cf95f23e99ee7336eabc308fc121'}
};

const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const text=value=>typeof value==='string'&&value.trim().length>0;
const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((value,i)=>value===b[i]);
const fail=message=>{throw new Error('Invalid clean media: '+message);};
function captionText(value,max=500){return text(value)&&value.length<=max&&!/[\u0000-\u001f<>]/.test(value)&&!/\/Users\/|\/private\/|\/tmp\/|file:\/\//i.test(value);}
function publicURL(value,baseURL){
 if(!text(value)||/^(?:file:|\/Users\/|\/private\/|\/tmp\/)/i.test(value))fail('public URL required');
 let url;try{url=new URL(value,baseURL);}catch{fail('invalid URL');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('invalid public URL');
 return value;
}
function actualUTC(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value))return false;
 const parsed=new Date(value);
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,19)===value.slice(0,19);
}
function asset(value,baseURL){
 if(!value||!Array.isArray(value.dimensions)||value.dimensions.length!==2||!value.dimensions.every(positive)||!positive(value.bytes)||!hash(value.sha256))fail('complete asset dimensions, bytes and hash required');
 return {url:publicURL(value.url,baseURL),width:value.dimensions[0],height:value.dimensions[1],bytes:value.bytes,sha256:value.sha256,format:value.mimeType};
}
function renderDate(timestamp){
 const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Toronto'}).formatToParts(new Date(timestamp));
 const get=type=>parts.find(part=>part.type===type).value;
 return get('year')+'-'+get('month')+'-'+get('day');
}

// This is a declared offline representation change, never an unchanged-source
// geometry claim. The small public record retains its original/derived evidence.
export function normalizeRenderRepresentation(value,{identity,sourceSceneSHA256,deliveryManifestSHA256}={}){
 if(value===undefined)return undefined;
 const fields=['kind','adapterProofSHA256','clipProofSHA256','originalNativeSourceSHA256','derivedPackedSceneSHA256','derivedUnderlayGeometryEdited','originalSourceFilesUnchanged','waterUnionSymmetricDifferenceM2','maximumNewVertexFloat32DisplacementMetres','shadowRestoredFromFrozenSource','shadowSourceCodeSHA256','qualification'];
 if(!value||Object.keys(value).length!==fields.length||fields.some(key=>!Object.hasOwn(value,key))||value.kind!=='source-bound-water-underlay-priority-clip'||!/^((wide|portraits)\/(port-credit|lakeview)-)/.test(identity))fail('unsupported render representation');
 for(const key of ['adapterProofSHA256','clipProofSHA256','originalNativeSourceSHA256','derivedPackedSceneSHA256','shadowSourceCodeSHA256'])if(!hash(value[key]))fail('representation evidence hash required');
 if(!hash(deliveryManifestSHA256)||value.originalNativeSourceSHA256!==sourceSceneSHA256||value.derivedPackedSceneSHA256===sourceSceneSHA256||value.derivedUnderlayGeometryEdited!==true||value.originalSourceFilesUnchanged!==true||value.shadowRestoredFromFrozenSource!==true)fail('representation must distinguish original source, derived geometry and restored shadow');
 if(!['waterUnionSymmetricDifferenceM2','maximumNewVertexFloat32DisplacementMetres'].every(key=>Number.isFinite(value[key])&&value[key]>=0)||value.maximumNewVertexFloat32DisplacementMetres>.00025)fail('representation precision evidence required');
 if(value.qualification!=='Only derived water underlay representation is changed. Float32 seam differences remain measured; no mathematically exact union or unchanged native-render claim.')fail('representation qualification must retain its measured limits');
 return Object.fromEntries(fields.map(key=>[key,value[key]]));
}
function validateWaterPairMember(member,row,policy,shadowLines=[35,38]){
 const v=member.renderRepresentation,r=row.renderRepresentation;
 if(!v||!r||v.kind!==r.kind||policy?.kind!==r.kind)fail('comparison representation must be disclosed in both records');
 for(const key of ['adapterProofSHA256','clipProofSHA256','derivedPackedSceneSHA256'])if(v[key]!==r[key])fail('comparison representation evidence differs');
 for(const key of ['originalNativeImportSHA256','originalPackedSceneSHA256','independentAuditSHA256'])if(!hash(v[key]))fail('comparison original and derived evidence required');
 if(v.originalPackedSceneSHA256===v.derivedPackedSceneSHA256||v.originalSourceFilesUnchanged!==true||v.derivedUnderlayGeometryEdited!==true||v.districtWaterAndAllOtherGeometryPreserved!==true||v.materialsAndTexturesPreserved!==true||v.waterElevationMapY!==5)fail('comparison source-preservation declaration differs');
 if(member.evidenceSHA256?.deliveryManifest!==row.renderInfo.sourceProofSHA256s.deliveryManifest||policy.clipProofSHA256!==r.clipProofSHA256)fail('comparison must bind the accepted delivery and common clip policy');
 const shadow=v.shadowRestoration,common=policy.shadowRestoration;
 if(!shadow||!common||shadow.object!=='LakeOntarioUnified'||shadow.visibleShadowBefore!==true||shadow.visibleShadowAfter!==false||shadow.frozenSourceCodeSHA256!==r.shadowSourceCodeSHA256||!hash(shadow.nativeUnderlayRowSHA256)||!same(shadow.sourceLines,shadowLines))fail('comparison frozen shadow restoration differs');
 for(const key of ['object','visibleShadowBefore','visibleShadowAfter','frozenSourceCodeSHA256'])if(common[key]!==shadow[key])fail('comparison shadow policy differs between members');
 const precision=v.precision,keys=['removedUnionAreaM2','addedUnionAreaM2','totalSymmetricDifferenceM2','rawAllBoundariesHausdorffMetres','exteriorRingHausdorffMetres','maximumNewVertexFloat32DisplacementMetres'];
 if(!precision||keys.some(key=>!Number.isFinite(precision[key])||precision[key]<0)||precision.totalSymmetricDifferenceM2!==r.waterUnionSymmetricDifferenceM2||precision.maximumNewVertexFloat32DisplacementMetres!==r.maximumNewVertexFloat32DisplacementMetres||Math.abs(precision.removedUnionAreaM2+precision.addedUnionAreaM2-precision.totalSymmetricDifferenceM2)>1e-12||v.changedAreaSourceEdgeBandMetres!==.00025||precision.maximumNewVertexFloat32DisplacementMetres>v.changedAreaSourceEdgeBandMetres)fail('comparison measured precision differs');
 if(v.qualification!=='The original source union is preserved only within measured float32 rounding. Hairline seam topology changes make raw boundary Hausdorff unsuitable as a shoreline-displacement claim. Primary district shoreline geometry remains exact. No mathematically exact union claim.')fail('comparison must retain its precision qualification');
}

// Only the independently accepted final Lakeview camera pair is eligible.
const acceptedLakeviewComparisons=Object.freeze({"6642d10b15eed782d9769bc28aa5ee9c3707ace211c39aa4ee7decb2e50dc477": "fm-matched-view-6b59d9899389aa74cad57e96"});
const lakeviewOHN={"assetId":"ohn-lakeview-offshore-supplement-v1","sourceSHA256":"f2d917c4bdcf5277b9e934a5a6bd0b0a52431bbe033353be28a1fc667eab597c","assetSHA256":"0f27774f67dc09a29e0713d401b40dcabc6e14011874a0bb8daf7c654bcd814d","assetRevision":"offshore-margin-v2","vertices":93,"triangles":91,"unchangedByOfflineAdapter":true,"nativeShadowRestored":true,"sourceCredits":["Ontario Hydro Network Waterbody, Ontario Ministry of Natural Resources.","Contains information licensed under the Open Government Licence – Ontario."],"independentEncodedAssetAuditSHA256":"b70ca5102efd7b09a496b0eaa5f38dd19605740c28741a61d84e250cb5abbfa9","encodedPrecision":{"sourceAreaM2":1696093.933661471,"float32AreaM2":1696093.8568029404,"removedAreaM2":0.13898916831252053,"addedAreaM2":0.062130637593168454,"symmetricDifferenceM2":0.20111980594040213,"maximumVertexQuantizationMetres":0.00024762839387452236,"boundaryHausdorffMetres":0.00023669100641025243,"outsideOfficialPolygonAreaM2":0.0,"mathematicallyExactSourcePolygonUnion":false,"encodedNativeWaterOverlapM2":1.9331019356860768e-05,"allAreaDifferenceWithinQuarterMillimetreSourceBoundaryBand":true,"waterResidueOutsideQuarterMillimetreNativeBoundaryBandM2":0.0,"encodedAreaOutsideExact20mApproximationM2":0.06211130742041344},"qualification":"Official 2D medium-scale western Lake Ontario partition. Source accuracy category Within 5 metres is not surveyed certification. Inherited map Y5 is illustrative. Float32 polygon residuals and tiny encoded native-water overlap remain as measured; no mathematically exact source-polygon or absolute-zero-overlap claim."};
const lakeviewLightingPolicies=[{"kind":"flat-directional-shadow-receiver-v3","wrapperVersion":1,"source":{"path":"flat-shadow-receiver.js","bytes":5492,"sha256":"cd2f365042ed246bfc90780f0a71d9d8ce75e29f6ecf448094135baa14c1ee7e"},"priorPolicy":"Three.Material default","operation":"Remove only the registered WebGL directional-shadow sampling wrapper from the detached clone. Existing coverage is baked separately. Reviewed Cycles lighting replaces runtime lighting; pixel-lighting equivalence is not claimed.","sourceMaterialModified":false,"PBRAndTexturesChanged":false},{"kind":"flat-directional-shadow-receiver-v3","wrapperVersion":1,"source":{"path":"flat-shadow-receiver.js","bytes":5492,"sha256":"cd2f365042ed246bfc90780f0a71d9d8ce75e29f6ecf448094135baa14c1ee7e"},"priorPolicy":"source-context-coverage-v1","operation":"Remove only the registered WebGL directional-shadow sampling wrapper from the detached clone. Existing coverage is baked separately. Reviewed Cycles lighting replaces runtime lighting; pixel-lighting equivalence is not claimed.","sourceMaterialModified":false,"PBRAndTexturesChanged":false}];
function sameJSON(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!==typeof b||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameJSON(a[key],b[key]));
}
function validateLakeviewPairMember(member,row,policy){
 validateWaterPairMember(member,row,policy,[39]);
 const full=member.renderRepresentation,lighting=full.nativeLightingRepresentation;
 const fields=['kind','adapterProofSHA256','originalNativeImportSHA256','originalPackedSceneSHA256','derivedPackedSceneSHA256','clipProofSHA256','independentAuditSHA256','originalSourceFilesUnchanged','derivedUnderlayGeometryEdited','districtWaterAndAllOtherGeometryPreserved','waterElevationMapY','materialsAndTexturesPreserved','shadowRestoration','precision','changedAreaSourceEdgeBandMetres','qualification','integratedOHN','nativeLightingRepresentation'];
 if(Object.keys(full).length!==fields.length||fields.some(key=>!Object.hasOwn(full,key))||!sameJSON(full.integratedOHN,lakeviewOHN)||!sameJSON(policy.integratedOHN,lakeviewOHN))fail('Lakeview must retain its complete OHN identity, precision, credits and qualification');
 if(Object.keys(policy).length!==5||!sameJSON(policy.nativeLightingPolicies,lakeviewLightingPolicies)||!lighting||Object.keys(lighting).length!==4||!Number.isInteger(lighting.affectedRecordCount)||lighting.affectedRecordCount<=0||!hash(lighting.nativeRecordsSHA256)||lighting.runtimePixelLightingEquivalenceClaimed!==false||!sameJSON(lighting.policies,lakeviewLightingPolicies))fail('Lakeview must retain its exact native-lighting qualification');
 if(!row.caption.requiredModelCredits.includes(lakeviewOHN.sourceCredits[1]))fail('Lakeview OHN attribution must remain visible');
}

// Public records use the native owner's v2 contract, with versioned public URLs
// in place of private delivery paths. This checks the proof's declared bounds and
// hash bindings; release validation must separately verify decoded RGB equality.
export function normalizeCleanMedia(entry,baseURL,{neighbourhood=false}={}){
 const allowed=neighbourhood?ACTIVE_NEIGHBOURHOOD_IDENTITIES:ACTIVE_PICTURE_IDENTITIES;
 if(entry?.schema!=='future-mississauga-current-native-media/v2'||!allowed.includes(entry.identity))fail('unsupported active identity');
 if(entry.aliases?.length||entry.historicalURLsRebound!==false)fail('historical aliases cannot be rebound');
 if(entry.sourceFreezeState!=='FINAL_FROZEN'||!hash(entry.sourceSceneSHA256))fail('frozen source scene required');
 if(!actualUTC(entry.renderTimestampUTC))fail('actual render UTC required');
 const renderRepresentation=normalizeRenderRepresentation(entry.renderRepresentation,{identity:entry.identity,sourceSceneSHA256:entry.sourceSceneSHA256,deliveryManifestSHA256:entry.provenance?.deliveryManifest?.sha256});
 const master=asset(entry.displayMaster,baseURL),download=asset(entry.download,baseURL),[w,h]=entry.nativeSceneDimensions||[];
 if(!same(entry.nativeSceneDimensions,[w,h])||!positive(w)||!positive(h)||master.width!==w||master.height!==h||master.format!=='image/png'||entry.displayMaster.role!=='cleanNativeScene'||entry.displayMaster.captionBaked!==false)fail('clean native master must retain the complete native dimensions');
 const d=entry.download;
 if(download.format!=='image/png'||d.role!=='nativeSceneWithAppendedCreditFooter'||download.width!==w||download.height<=h||!same(d.sceneDimensions,[w,h])||!same(d.sceneBounds,[0,0,w,h])||!same(d.footerBounds,[0,h,w,download.height]))fail('footer must extend below the complete scene without overlap or gaps');
 if(d.sceneSourceSHA256!==master.sha256||d.allScenePixelsExact!==true||d.sceneCrop!==false||d.sceneResize!==false)fail('exact uncropped, unscaled scene hash proof required');
 if(master.url===download.url||master.sha256===download.sha256)fail('clean display and footer download must be separate assets');
 const derivatives=entry.responsivePreviews;
 if(!Array.isArray(derivatives))fail('responsive previews required');
 const widths=[...new Set([Math.min(w,1200),Math.min(w,3200)])],seen=new Set();
 const previews=derivatives.map(value=>{
  const a=asset(value,baseURL),key=a.format+'/'+a.width;
  if(!['image/avif','image/jpeg'].includes(a.format)||!widths.includes(a.width)||seen.has(key))fail('one AVIF and JPEG per responsive size required');
  seen.add(key);
  if(a.width>w||a.height!==Math.round(h*a.width/w)||value.sourceSHA256!==master.sha256||value.crop!==false||value.captionBaked!==false||value.lossyEncoding!==true||value.resized!==(a.width!==w)||value.role!=='responsivePreview')fail('responsive preview must derive proportionally from the clean master');
  return {...a,sourceSHA256:value.sourceSHA256};
 });
 if(previews.length!==widths.length*2)fail('responsive preview family incomplete');
 const urls=[master,download,...previews].map(a=>{const u=new URL(a.url,baseURL);u.search='';u.hash='';return u.href;});
 if(new Set(urls).size!==urls.length)fail('pixel roles must use distinct URLs');
 const c=entry.caption;
 if(!c||!['title','area','creator','scenario','geographicScope','cityCredit','sourceDates'].every(key=>captionText(c[key]))||typeof c.openStreetMap!=='boolean'||!Array.isArray(c.requiredModelCredits)||!c.requiredModelCredits.every(value=>captionText(value))||!Array.isArray(c.fullCredits)||!c.fullCredits.every(value=>captionText(value,2000))||c.renderTimestampUTC!==entry.renderTimestampUTC||c.title!==entry.title||c.scenario!==entry.scenario)fail('complete safe caption and matching render facts required');
 if(c.sourcesURL!=='https://futuremississauga.com/sources.html')fail('canonical Sources link required');
 if(!['existing','construction','future'].includes(c.scenario))fail('known scenario required');
 const areaId=neighbourhood?'fairview':Object.keys(areas).find(id=>entry.identity.split('/')[1].startsWith(id+'-'));
 const scenario=neighbourhood?'existing':entry.identity.match(/-(existing|construction|future)\.png$/)[1];
 if(c.scenario!==scenario||c.area!==(neighbourhood?'Fairview':areas[areaId]))fail('identity must match its area and scenario');
 const exception=acceptedCameraScopes[entry.identity],acceptedCameraScope=exception&&c.geographicScope===exception.scope&&entry.provenance?.deliveryManifest?.sha256===exception.manifest;
 if(c.geographicScope!==(neighbourhood?'neighbourhood':areaId==='citywide'?'whole_municipality':'named_district_scene')&&!acceptedCameraScope)fail('identity must match its geographic scope');
 if(areaId==='citywide'&&!['Citywide','All Mississauga'].includes(c.title))fail('whole-city title must retain its municipality scope');
 if(!/City of Mississauga/.test(c.cityCredit))fail('City attribution required');
 const allCreditText=[...c.fullCredits,...c.requiredModelCredits].join('\n');
 if((areaId==='citywide'||/275\s+Superior|David Lasker|Cityscape Photography/i.test(allCreditText))&&!c.requiredModelCredits.includes(superiorCredit))fail('275 Superior reference credit must remain visible');
 if(((areaId==='clarkson'&&scenario==='future')||/Zeidler Architecture/i.test(allCreditText))&&!c.requiredModelCredits.includes(zeidlerCredit))fail('Zeidler architectural massing credit must remain visible');
 if(areaId==='lakeview'&&renderRepresentation&&!c.requiredModelCredits.includes(lakeviewOHN.sourceCredits[1]))fail('Lakeview OHN attribution must remain visible');
 const caption=Object.fromEntries(['title','area','creator','scenario','geographicScope','cityCredit','openStreetMap','sourcesURL','renderTimestampUTC','sourceDates'].map(key=>[key,c[key]]));
 if(neighbourhood){
  const state=entry.identity.split('/').at(-1);
  if((entry.comparisonState&&entry.comparisonState!==state)||(c.comparisonState&&c.comparisonState!==state))fail('comparison state must match its identity');
  caption.comparisonState=state;
 }
 caption.requiredModelCredits=[...c.requiredModelCredits];caption.fullCredits=[...c.fullCredits];
 // No private paths or proof file names are copied into public metadata.
 const [kind,...rest]=entry.identity.split('/');
 const sourceProofSHA256s=Object.fromEntries(Object.entries(entry.provenance||{}).filter(([key,pin])=>/^[a-z][a-zA-Z0-9]*$/.test(key)&&hash(pin?.sha256)).map(([key,pin])=>[key,pin.sha256]));
 return {
  kind,file:rest.join('/'),identity:entry.identity,area:c.area,title:c.title,aliases:[],
  displayMaster:master,download,preview:previews.find(a=>a.format==='image/avif'&&a.width===widths[0]),responsive:previews.find(a=>a.format==='image/avif'&&a.width===widths.at(-1)),responsivePreviews:previews,
  cleanPresentation:{sceneDimensions:[w,h],sceneBounds:[...d.sceneBounds],footerBounds:[...d.footerBounds],sceneSourceSHA256:d.sceneSourceSHA256,allScenePixelsExact:true,sceneCrop:false,sceneResize:false},
  caption,sourceAttribution:{cityOfMississauga:true,openStreetMap:c.openStreetMap,cityCredit:c.cityCredit,requiredModelCredits:[...c.requiredModelCredits],creditLines:[...c.fullCredits],sourceURL:c.sourcesURL},
  renderInfo:{state:'rendered',renderDate:renderDate(entry.renderTimestampUTC),renderDateTimezone:'America/Toronto',renderTimestampUTC:entry.renderTimestampUTC,sourceDatesMixed:true,sourceModelDate:null,sourceEdition:c.sourceDates,sourceSceneSHA256:entry.sourceSceneSHA256,sourceProofSHA256s},
  nativeSceneDimensions:[w,h],...(renderRepresentation?{renderRepresentation}: {})
 };
}

export function imageAttribution(row){
 const source=row?.sourceAttribution||{},caption=row?.caption;
 const required=[...(caption?.requiredModelCredits||source.requiredModelCredits||[])];
 if(source.photoReference?.name){
  let host='';try{host=new URL(source.photoReference.url).hostname;}catch{}
  const credit='275 Superior Boulevard photo reference: '+source.photoReference.name+(host?' · '+host:'');
  if(!required.includes(credit))required.push(credit);
 }
 return {cityCredit:caption?.cityCredit||source.cityCredit||(source.cityOfMississauga?'City of Mississauga':''),openStreetMap:caption?.openStreetMap??source.openStreetMap===true,requiredModelCredits:required.map(value=>compactCredits[value]||value),sourcesURL:caption?.sourcesURL||source.sourceURL||'sources.html'};
}
const scenarios={future:'Future scenario',existing:'Existing context',construction:'Dated construction'};
export function mediaScenarioLabel(row){const caption=row.caption;return caption?[scenarios[caption.scenario]||caption.scenario,caption.comparisonState&&({before:'Before',after:'After'}[caption.comparisonState])].filter(Boolean).join(' · '):'';}
export function mediaPreviewInfo(row){
 const caption=row.caption,meta=pictureProvenance(row.renderInfo,row.displayMaster.width).meta;
 return {title:caption?.title||row.title,src:row.displayMaster.url,download:row.download?.url||row.url,preview:row.preview?.url||row.display?.url||row.displayMaster.url,width:row.displayMaster.width,height:row.displayMaster.height,
  meta:caption?[pictureProvenance(row.renderInfo,row.download.width).meta,(row.download.bytes/1e6).toFixed(1)+' MB'].join(' · '):meta,
  scenario:caption?.scenario,creator:caption?.creator,attribution:imageAttribution(row),osm:row.sourceAttribution?.openStreetMap===true};
}
export function matchedComparisonBinding(rows,proof,proofSHA256){
 if(!hash(proofSHA256)||!['future-mississauga-matched-view-proof/v1','future-mississauga-matched-view-proof/v2','future-mississauga-matched-view-proof/v3'].includes(proof?.schema)||!/^fm-matched-view-[a-f0-9]{24}$/.test(proof.proofID)||!Array.isArray(proof.members)||proof.members.length!==2)fail('matched comparison proof required');
 for(const key of ['cameraParametersExactlyEqual','lightingParametersExactlyEqual','sourceFreezeExactlyEqual','aspectRatioExactlyEqual','normalizedCameraFramingEqual','separateActualNativeScenarioExportsVerified','cleanPNGHashesAndDimensionsVerified','cleanOriginalFrameCompositionRGBVerified'])if(proof.checks?.[key]!==true)fail('comparison camera, lighting and image proofs must match');
 if(proof.checks.nativeMastersResizedOrCroppedByThisReview!==false||proof.shared?.sourceFreeze?.state!=='FINAL_FROZEN'||!proof.shared.camera||!proof.shared.lightingAndColourManagement||!same(proof.shared.pixelAspect,[1,1]))fail('comparison must retain uncropped native framing');
 const lakeview=proof.schema==='future-mississauga-matched-view-proof/v3';
 if(lakeview&&(acceptedLakeviewComparisons[proofSHA256]!==proof.proofID||!same(proof.members.map(member=>member.identity),['wide/lakeview-existing.png','wide/lakeview-future.png'])))fail('final revised Lakeview comparison is not accepted');
 if(!lakeview&&proof.members.some(member=>member.identity.startsWith('wide/lakeview-')))fail('Lakeview cannot downgrade its OHN and lighting proof');
 const adapterAware=lakeview||proof.schema==='future-mississauga-matched-view-proof/v2';
 if(adapterAware&&(proof.checks.sameDeclaredRepresentationPolicy!==true||proof.checks.renderedRepresentationAdapterDisclosed!==true))fail('comparison representation checks required');
 const members=proof.members,selected=members.map(member=>rows.find(row=>row.identity===member.identity));
 if(selected.some(row=>!row?.cleanPresentation)||members[0].scenario!=='existing'||members[1].scenario!=='future'||members[0].district!==members[1].district)fail('comparison must bind its exact existing/future scene identities');
 for(let i=0;i<2;i++){
  const member=members[i],row=selected[i],master=row.displayMaster;
  if(lakeview)validateLakeviewPairMember(member,row,proof.shared.representationPolicy);
  else if(adapterAware)validateWaterPairMember(member,row,proof.shared.representationPolicy);
  else if(member.renderRepresentation||row.renderRepresentation||proof.shared.representationPolicy)fail('adapted scenes require a representation-aware comparison proof');
  if(!member.identity.startsWith('wide/')||member.identity!=='wide/'+member.district+'-'+member.scenario+'.png'||member.geographicScope!==row.caption.geographicScope||member.sourceSceneSHA256!==row.renderInfo.sourceSceneSHA256||member.cleanPNG?.sha256!==master.sha256||member.cleanPNG.bytes!==master.bytes||!same(member.cleanPNG.dimensions,[master.width,master.height])||member.cleanPNG.nativePixelsNoUpscaling!==true||member.cleanPNG.crop!==false||member.cleanPNG.captionBaked!==false)fail('comparison member differs from the exact clean master');
  if(!Array.isArray(member.responsiveImages)||member.responsiveImages.length!==row.responsivePreviews.length||new Set(member.responsiveImages.map(image=>image.sha256)).size!==row.responsivePreviews.length)fail('comparison derivatives missing');
  for(const image of member.responsiveImages){const actual=row.responsivePreviews.find(a=>a.sha256===image.sha256);if(!actual||image.bytes!==actual.bytes||image.mimeType!==actual.format||!same(image.dimensions,[actual.width,actual.height])||image.crop!==false||image.resized!==(actual.width!==master.width))fail('comparison derivative differs from accepted preview');}
 }
 const [before,after]=selected,aspect=proof.shared.aspectRatio;
 if(!positive(aspect?.numerator)||!positive(aspect?.denominator)||selected.some(row=>row.displayMaster.width*aspect.denominator!==row.displayMaster.height*aspect.numerator))fail('comparison aspect ratio differs');
 const nativeEqual=before.displayMaster.width===after.displayMaster.width&&before.displayMaster.height===after.displayMaster.height;
 if(proof.checks.nativePixelDimensionsEqual!==nativeEqual)fail('comparison must disclose different native dimensions');
 const equal=proof.commonResponsiveFormats?.find(image=>image.mimeType==='image/avif'&&image.dimensions?.[0]===3200);
 if(!equal||equal.equalPixelDimensions!==true||equal.identicalImagePixelsClaimed!==false||!same(equal.memberSHA256,selected.map(row=>row.responsive.sha256))||selected.some(row=>!same(equal.dimensions,[row.responsive.width,row.responsive.height])))fail('comparison needs exact equal-size responsive images');
 return {proofID:proof.proofID,sha256:proofSHA256,existingSceneSHA256:before.displayMaster.sha256,futureSceneSHA256:after.displayMaster.sha256,existingResponsiveSHA256:before.responsive.sha256,futureResponsiveSHA256:after.responsive.sha256,responsiveDimensions:[...equal.dimensions],nativePixelDimensionsEqual:nativeEqual,cameraMatched:true,lightingMatched:true};
}
export function comparisonPair(pictures,district){
 const names=[district+'-existing.png',district+'-future.png'],rows=names.map(name=>pictures.images[name]);
 if(rows.some(row=>!row))return null;
 // Clean framing can change independently. A publisher-verified shared camera
 // and lighting proof must bind both clean files before the slider switches.
 if(rows.some(row=>row.cleanPresentation)){
  const proof=rows[0].comparisonProof,other=rows[1].comparisonProof;
  const matched=rows.every(row=>row.cleanPresentation)&&proof&&other&&hash(proof.sha256)&&proof.sha256===other.sha256&&proof.existingSceneSHA256===rows[0].displayMaster.sha256&&proof.futureSceneSHA256===rows[1].displayMaster.sha256&&other.existingSceneSHA256===proof.existingSceneSHA256&&other.futureSceneSHA256===proof.futureSceneSHA256&&proof.existingResponsiveSHA256===rows[0].responsive?.sha256&&proof.futureResponsiveSHA256===rows[1].responsive?.sha256&&same(proof.responsiveDimensions,[rows[0].responsive?.width,rows[0].responsive?.height])&&same(proof.responsiveDimensions,[rows[1].responsive?.width,rows[1].responsive?.height])&&proof.cameraMatched===true&&proof.lightingMatched===true&&other.cameraMatched===true&&other.lightingMatched===true;
  if(!matched)return names.map(name=>pictures.comparisonImages?.[name]||pictures.images[name]);
 }
 return rows;
}
