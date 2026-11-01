export const mcityContentIds = new Set(['mcity-6','mcity-7-8']);
export function withoutReviewedMcityContent(project) {
 const result=structuredClone(project);
 if(!mcityContentIds.has(project.id))return result;
 for(const key of ['status','statusDate','summary','modelCaveat','sources','lastStatusReview','geometryCoverage','evidenceUpdateNote','ownershipReview','planningSnapshot','submittedDrawing'])delete result[key];
 if(project.id==='mcity-7-8')delete result.storeys;
 if(result.completion){delete result.completion.note;delete result.completion.reviewed;}
 return result;
}
export const mcityReviewedMeshIds = new Set(['63-6170','63-6171','63-6172','63-6173','63-6174']);
export function withoutReviewedMcityNote(record,id) {
 const result=structuredClone(record);if(mcityReviewedMeshIds.has(id))delete result.evidenceNote;return result;
}
