// Exact accepted M4 V3 metadata exception to earlier intake guards.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const M4_V3_ASSETS=[
  {
    "id": "mcity-m4-future-detail-20261101",
    "url": "models/studies-20261101/mcity-m4-future-v3-685ea68ae21c.glb.gz",
    "rawSHA256": "685ea68ae21cbdf57be970a2a38e23da180297a782863c39d6da84266da448b1",
    "downloadSHA256": "c29a55cdc94e15748a826087415fecbb84be0a0bd324f15dac1023450cb943a2",
    "bytes": 138450,
    "decodedBytes": 597028,
    "meshes": 107,
    "triangles": 34740,
    "materialCount": 7
  },
  {
    "id": "mcity-m4-spring2026-detail-20261101",
    "url": "models/studies-20261101/mcity-m4-spring2026-v3-78e0bc6f549a.glb.gz",
    "rawSHA256": "78e0bc6f549a36d463a573b92f895af07f9b5cd9bf46ef27033ecac170c32332",
    "downloadSHA256": "3383b5178f56a75fb709a1d201d812e6887cdd3f4255728bb8c2bc1701eaac60",
    "bytes": 68472,
    "decodedBytes": 372468,
    "meshes": 106,
    "triangles": 20528,
    "materialCount": 6
  }
];
const PRIOR_FIELDS={
  "mcity-m4-future-detail-20261101": {
    "url": "models/studies-20261101/mcity-m4-future-detail.glb",
    "sha256": "193a33d5866adb9dbdd2aa8915ed802d9c4420918b4a34c9453d9aa12397fd3a",
    "downloadSHA256": "193a33d5866adb9dbdd2aa8915ed802d9c4420918b4a34c9453d9aa12397fd3a",
    "decodedSHA256": "193a33d5866adb9dbdd2aa8915ed802d9c4420918b4a34c9453d9aa12397fd3a",
    "bytes": 338492,
    "triangleCount": 17816,
    "bounds": [
      [
        -5780.54248046875,
        84.88999938964844,
        527.4463500976562
      ],
      [
        -5696.23974609375,
        300.5400085449219,
        609.5144653320312
      ]
    ],
    "modelFidelity": "Partial projecting balcony strips traced from the official developer floor key; Glazing, floor spandrels and vertical curtain-wall mullions; Stacked three-storey podium frame language from official architecture render; Separate unchanged Spring2026 concrete height with recorded level26 glazing limit. Approximate source-informed exterior study.",
    "warning": "The exact 200.700m shorter crown footprint is unresolved. Maximum215.650m envelope retained; no exact four-crown allocation claimed. Podium frames use brochure language within the inherited mass, not a measured reconstruction of every projecting podium box. Construction retains Spring2026 concreteL41/glazingL26 only.",
    "qualification": [
      "Inherited plan registration and maximum215.65m height retained. Exact shorter crown footprints remain unresolved.",
      "Three-storey podium frame pattern is approximate within the inherited envelope; exact projecting podium subdivisions are not asserted.",
      "Slab0.20m, guard1.05m, mullion1.8m and podium fin2.4m spacing are visual estimates.",
      "Typical floor pitch2.95m is source-supported; upper special floor placement remains approximate. No interior geometry."
    ],
    "sourceRevision": "2026-11-01 independent detail revision; source dates mixed and retained",
    "geometryConfidence": "Source-supported exterior interpretation with the explicit dimensional and registration limits in qualification and warning."
  },
  "mcity-m4-spring2026-detail-20261101": {
    "url": "models/studies-20261101/mcity-m4-spring2026-level41-detail.glb",
    "sha256": "71ddefd801ed80defa5ccfeb7c2b36836c0a3ec0e14db93eef2f07c3ed4a4783",
    "downloadSHA256": "71ddefd801ed80defa5ccfeb7c2b36836c0a3ec0e14db93eef2f07c3ed4a4783",
    "decodedSHA256": "71ddefd801ed80defa5ccfeb7c2b36836c0a3ec0e14db93eef2f07c3ed4a4783",
    "bytes": 205772,
    "triangleCount": 10460,
    "bounds": [
      [
        -5780.54248046875,
        84.88999938964844,
        527.4463500976562
      ],
      [
        -5696.23974609375,
        208.5399932861328,
        609.5144653320312
      ]
    ],
    "modelFidelity": "Partial projecting balcony strips traced from the official developer floor key; Glazing, floor spandrels and vertical curtain-wall mullions; Stacked three-storey podium frame language from official architecture render; Separate unchanged Spring2026 concrete height with recorded level26 glazing limit. Approximate source-informed exterior study.",
    "warning": "The exact 200.700m shorter crown footprint is unresolved. Maximum215.650m envelope retained; no exact four-crown allocation claimed. Podium frames use brochure language within the inherited mass, not a measured reconstruction of every projecting podium box. Construction retains Spring2026 concreteL41/glazingL26 only.",
    "qualification": [
      "Inherited plan registration and maximum215.65m height retained. Exact shorter crown footprints remain unresolved.",
      "Three-storey podium frame pattern is approximate within the inherited envelope; exact projecting podium subdivisions are not asserted.",
      "Slab0.20m, guard1.05m, mullion1.8m and podium fin2.4m spacing are visual estimates.",
      "Typical floor pitch2.95m is source-supported; upper special floor placement remains approximate. No interior geometry."
    ],
    "sourceRevision": "2026-11-01 independent detail revision; source dates mixed and retained",
    "geometryConfidence": "Source-supported exterior interpretation with the explicit dimensional and registration limits in qualification and warning."
  }
};
const KEYS=["url","sha256","downloadSHA256","decodedSHA256","bytes","decodedBytes","triangleCount","bounds","modelFidelity","warning","qualification","sourceRevision","modelReviewDate","geometryConfidence","pairedRoofDatumsM"];
const EXPECTED_RECORDS={"mcity-m4-future-detail-20261101":"f7c47df7d7afcd4812579c950d41c083c3df5a57491138185efef22ae4661cad","mcity-m4-spring2026-detail-20261101":"f8cca4fb7993fe33b104e644582b4129f8bc6bf1d9ad7ace8e5a7b599b1ca5ee"};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function restoreM4V3Fields(data){
 for(const [id,prior]of Object.entries(PRIOR_FIELDS)){
  const rows=data.assets.filter(a=>a.id===id);assert.equal(rows.length,1,id);const row=rows[0];
  assert.equal(createHash('sha256').update(JSON.stringify(stable(row))).digest('hex'),EXPECTED_RECORDS[id],id+' exact accepted metadata');
  for(const key of KEYS)delete row[key];Object.assign(row,structuredClone(prior));
 }
 return data;
}
