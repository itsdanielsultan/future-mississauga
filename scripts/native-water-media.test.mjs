import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCleanMedia,matchedComparisonBinding,mediaPreviewInfo} from '../public/clean-media.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/port-credit-water-v3.json',import.meta.url)));
const base='https://futuremississauga.com/';
const normalized=()=>fixture.rows.map(row=>normalizeCleanMedia(structuredClone(row),base));

test('accepted water representation keeps its original and derived evidence without visible technical copy',()=>{
 const rows=normalized(),binding=matchedComparisonBinding(rows,fixture.proof,fixture.proofSHA256);
 assert.equal(binding.proofID,'fm-matched-view-140d4fbf29dd9feca365b198');
 assert.deepEqual(binding.responsiveDimensions,[3200,2000]);assert.equal(binding.nativePixelDimensionsEqual,true);
 for(const [i,row]of rows.entries()){
  assert.deepEqual(row.renderRepresentation,fixture.rows[i].renderRepresentation);
  assert.equal(row.renderInfo.sourceSceneSHA256,row.renderRepresentation.originalNativeSourceSHA256);
  assert.notEqual(row.renderInfo.sourceSceneSHA256,row.renderRepresentation.derivedPackedSceneSHA256);
  const info=mediaPreviewInfo(row);assert.doesNotMatch(info.meta,/adapter|underlay|float32|union|shadow/i);
  assert.equal(info.src,fixture.rows[i].displayMaster.url);assert.equal(info.download,fixture.rows[i].download.url);
 }
});

test('water declarations cannot hide edits, invent exact geometry, lose source binding or add private fields',()=>{
 const mutations=[
  r=>r.renderRepresentation.kind='unchanged-native',
  r=>r.renderRepresentation.originalNativeSourceSHA256='0'.repeat(64),
  r=>r.renderRepresentation.derivedPackedSceneSHA256=r.sourceSceneSHA256,
  r=>r.renderRepresentation.derivedUnderlayGeometryEdited=false,
  r=>r.renderRepresentation.originalSourceFilesUnchanged=false,
  r=>r.renderRepresentation.shadowRestoredFromFrozenSource=false,
  r=>r.renderRepresentation.shadowSourceCodeSHA256='missing',
  r=>r.renderRepresentation.waterUnionSymmetricDifferenceM2=-1,
  r=>r.renderRepresentation.maximumNewVertexFloat32DisplacementMetres=.001,
  r=>r.renderRepresentation.qualification='The geometry is unchanged.',
  r=>r.renderRepresentation.path='/Users/private/adapter.json',
  r=>delete r.provenance.deliveryManifest
 ];
 for(const mutate of mutations){const row=structuredClone(fixture.rows[0]);mutate(row);assert.throws(()=>normalizeCleanMedia(row,base));}
 const other=structuredClone(fixture.rows[0]);other.identity='wide/downtown-existing.png';assert.throws(()=>normalizeCleanMedia(other,base),/representation/);
});

test('the inward skyline scope requires its exact accepted portrait identity and package',()=>{
 const row=structuredClone(fixture.rows[1]);row.identity='portraits/port-credit-skyline-future.png';
 row.caption.geographicScope='Port Credit skyline and existing coastal source context, framed inward from finite water extent';
 row.provenance.deliveryManifest.sha256='d538e14351a32307748d0bfa900677f8add8cf95f23e99ee7336eabc308fc121';
 assert.equal(normalizeCleanMedia(row,base).caption.geographicScope,row.caption.geographicScope);
 for(const mutate of [r=>r.identity='wide/port-credit-skyline-future.png',r=>r.provenance.deliveryManifest.sha256='0'.repeat(64),r=>r.caption.geographicScope+=' enlarged']){
  const changed=structuredClone(row);mutate(changed);assert.throws(()=>normalizeCleanMedia(changed,base),/geographic scope/);
 }
});

test('v2 comparison binds clip, shadow, precision, delivery and derived-scene declarations independently',()=>{
 const mutations=[
  p=>p.schema='future-mississauga-matched-view-proof/v1',
  p=>p.checks.sameDeclaredRepresentationPolicy=false,
  p=>p.checks.renderedRepresentationAdapterDisclosed=false,
  p=>delete p.members[0].renderRepresentation,
  p=>p.members[0].renderRepresentation.adapterProofSHA256='0'.repeat(64),
  p=>p.members[0].renderRepresentation.derivedPackedSceneSHA256='0'.repeat(64),
  p=>p.members[0].renderRepresentation.originalNativeImportSHA256='missing',
  p=>p.members[0].renderRepresentation.originalPackedSceneSHA256=p.members[0].renderRepresentation.derivedPackedSceneSHA256,
  p=>p.members[0].renderRepresentation.originalSourceFilesUnchanged=false,
  p=>p.members[0].renderRepresentation.districtWaterAndAllOtherGeometryPreserved=false,
  p=>p.members[0].renderRepresentation.materialsAndTexturesPreserved=false,
  p=>p.members[0].renderRepresentation.shadowRestoration.visibleShadowAfter=true,
  p=>p.members[0].renderRepresentation.shadowRestoration.frozenSourceCodeSHA256='0'.repeat(64),
  p=>p.members[0].renderRepresentation.precision.totalSymmetricDifferenceM2=0,
  p=>p.members[0].renderRepresentation.precision.removedUnionAreaM2=0,
  p=>p.members[0].renderRepresentation.precision.maximumNewVertexFloat32DisplacementMetres=0,
  p=>p.members[0].renderRepresentation.qualification='Exact union preserved.',
  p=>p.members[0].evidenceSHA256.deliveryManifest='0'.repeat(64),
  p=>p.shared.representationPolicy.clipProofSHA256='0'.repeat(64),
  p=>p.shared.representationPolicy.shadowRestoration.visibleShadowBefore=false
 ];
 for(const mutate of mutations){const proof=structuredClone(fixture.proof);mutate(proof);assert.throws(()=>matchedComparisonBinding(normalized(),proof,fixture.proofSHA256));}
 const rows=normalized();delete rows[1].renderRepresentation;
 assert.throws(()=>matchedComparisonBinding(rows,fixture.proof,fixture.proofSHA256),/disclosed/);
});
