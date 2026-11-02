import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {matchedFairviewBinding as productionBinding} from '../public/fairview-media.js';
const fixture=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('../../release/test_fairview_comparison.py',import.meta.url)),'--fixture'],{encoding:'utf8'}));
assert.equal(fixture.fixtureOnly,true);
const source=await fs.readFile(new URL('../public/fairview-media.js',import.meta.url),'utf8'),proofSHA='e'.repeat(64);
const acceptanceDeclaration=source.match(/const ACCEPTED_FAIRVIEW_PROOFS=Object.freeze\(\{[^\n]*\}\)/)?.[0];
assert.ok(acceptanceDeclaration);
// Test-only in-memory approval of an owner's generated synthetic contract. This
// never writes a public acceptance pin or pretends that fixture bytes are native.
const injected=source.replace(acceptanceDeclaration,`const ACCEPTED_FAIRVIEW_PROOFS=Object.freeze(${JSON.stringify({[proofSHA]:fixture.proof.proofID})})`);
const {matchedFairviewBinding}=await import('data:text/javascript;base64,'+Buffer.from(injected).toString('base64'));
const copy=()=>structuredClone(fixture);
const bind=d=>matchedFairviewBinding(d.normalizedRows,d.proof,proofSHA);
test('actual exact acceptance map rejects the otherwise valid generated contract',()=>assert.throws(()=>productionBinding(fixture.normalizedRows,fixture.proof,proofSHA),/accepted Fairview proof pin/));
test('the distinct Fairview contract binds both Existing images at their real 1800px size',()=>{
 const result=bind(copy());assert.equal(result.comparisonKind,'native-neighbourhood-pilot-visibility');assert.deepEqual(result.responsiveDimensions,[1800,1100]);assert.deepEqual(result.identities,['neighbourhood/fairview/before','neighbourhood/fairview/after']);assert.equal(result.beforeSceneSHA256,fixture.normalizedRows[0].displayMaster.sha256);assert.equal(result.afterResponsiveSHA256,fixture.normalizedRows[1].responsive.sha256);
});
test('every generated native proof invariant is mandatory',()=>{
 for(const key of Object.keys(fixture.proof.checks).filter(key=>key!=='imagesResizedOrCroppedByThisReview')){const d=copy();d.proof.checks[key]=false;assert.throws(()=>bind(d),/native invariant/);}
});
test('Fairview cannot become a future-development comparison or swap its phases',()=>{
 for(const mutate of [d=>d.proof.members[1].scenario='future',d=>d.normalizedRows[1].caption.scenario='future',d=>d.proof.members.reverse(),d=>d.proof.members[1].comparisonState='before',d=>d.normalizedRows.pop()]){const d=copy();mutate(d);assert.throws(()=>bind(d));}
});
test('transition scope, exact count and context invariance cannot drift',()=>{
 for(const mutate of [d=>d.proof.comparison.trianglesAdded=9721,d=>d.proof.comparison.sourceComponentsAdded=232,d=>d.proof.comparison.genericContextUnchanged=false,d=>d.proof.comparison.actualNativeTransitionProofSHA256='',d=>d.proof.shared.background='#888888',d=>d.proof.shared.pixelAspect=[2,1],d=>d.proof.members[0].renderRepresentation={kind:'water-adapter'}]){const d=copy();mutate(d);assert.throws(()=>bind(d));}
});
test('clean native master, derivative hashes and actual size are bound independently',()=>{
 for(const mutate of [d=>d.normalizedRows[0].displayMaster.sha256='0'.repeat(64),d=>d.proof.members[0].cleanPNG.dimensions=[3200,2000],d=>d.proof.members[0].responsiveImages[0].bytes++,d=>d.proof.members[0].responsiveImages[2].resized=true,d=>d.proof.members[0].responsiveImages.pop(),d=>d.normalizedRows[0].responsive={...d.normalizedRows[0].responsive,width:3200,height:2000},d=>d.normalizedRows[1].renderInfo.sourceSceneSHA256=d.normalizedRows[0].renderInfo.sourceSceneSHA256]){const d=copy();mutate(d);assert.throws(()=>bind(d));}
});
const actual=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('../../release/test_fairview_accepted.py',import.meta.url)),'--fixture'],{encoding:'utf8'}));
test('the one accepted final native pair binds actual 1800px images and rounded smaller previews',()=>{
 const result=productionBinding(actual.normalizedRows,actual.proof,actual.proofSHA256);
 assert.deepEqual(result.responsiveDimensions,[1800,1100]);assert.equal(result.proofID,'fm-fairview-pilot-d85914f94b931b996c6871c1');
 assert.deepEqual(actual.proof.members[0].responsiveImages[0].dimensions,[1200,733]);
 assert.equal(actual.proof.members[0].responsiveImages[0].integerPixelRounding.nativeAspectExactlyPreserved,false);
});
test('final proof cannot omit or misstate rounding, alter clean masters or downgrade the proof',()=>{
 for(const mutate of [d=>delete d.proof.members[0].responsiveImages[0].integerPixelRounding,d=>d.proof.members[0].responsiveImages[0].integerPixelRounding.nativeAspectExactlyPreserved=true,d=>d.proof.members[0].responsiveImages[0].integerPixelRounding.integerHeightRoundingPixels=0,d=>d.proof.members[0].cleanPNG.dimensions=[1200,733],d=>d.proof.schema='future-mississauga-fairview-pilot-matched-view-proof/v1',d=>d.proof.members[1].scenario='future']){
  const d=structuredClone(actual);mutate(d);assert.throws(()=>productionBinding(d.normalizedRows,d.proof,d.proofSHA256));
 }
});
