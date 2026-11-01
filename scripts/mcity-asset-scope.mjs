// Separately pinned model revisions are verified by mcity-accepted-assets.test.
// This narrow scope lets the independent content/status guards keep comparing
// every factual field and every unrelated model against the earlier baseline.
export const acceptedMcityProjectIds=new Set(['mcity-1-2','mcity-3','mcity-4','mcity-5','mcity-6','mcity-7-8']);
export const acceptedModelProjectIds=new Set([...acceptedMcityProjectIds,'port-credit-50-high']);
export const acceptedMcityAssetIds=new Set(['mcity-m3-upper-detail-20261101','mcity-m4-future-detail-20261101','mcity-m4-spring2026-detail-20261101','mcity-m5-authored-detail-20261101','mcity-m6-20261101-dated-exterior','mcity-m7-m8-20261101-dated-exteriors']);
export const retiredMcityAssetIds=new Set(['mcity-m3-crown-silhouette','mcity-m4-recorded-level41','mcity-m5-developer-proxy']);
export function withoutAcceptedModelFields(kind,record){
 const row=structuredClone(record);
 const keys=kind==='projects'&&acceptedModelProjectIds.has(row.id)
  ?['supplementalAssetIds','supplementalModel','geometryCoverage','modelCaveat','recordedProgressModel','studyLabel','localReview']
  :kind==='assets'&&['mcity-m1-20261025-exterior-study','mcity-m2-20261025-exterior-study'].includes(row.id)
   ?['url','bytes','decodedBytes','sha256','downloadSHA256','downloadName','triangles','drawPrimitives','transparentPrimitivesRetained','sourceRevision','modelAccuracy','modelFidelity','localReview']
   :kind==='assets'&&row.id==='wf-50high-current-plan'?['url','sha256','bytes','triangles','downloadSHA256','downloadBytes','decodedSHA256','decodedBytes','preserveMaterials','preserveSourceNormals','modelFidelity','modelQuality','geometryReviewDate','simplifications','bounds','credit']:[];
 for(const key of keys)delete row[key];return row;
}
export const comparableMcityAssets=rows=>rows.filter(row=>!acceptedMcityAssetIds.has(row.id)&&!retiredMcityAssetIds.has(row.id));
