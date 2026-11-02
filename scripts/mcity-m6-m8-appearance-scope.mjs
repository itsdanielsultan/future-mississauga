// Exact accepted M6/M7-M8 appearance revisions; all other fields stay guarded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const M6_M8_APPEARANCE=[
  {
    "id": "mcity-m6-20261101-dated-exterior",
    "url": "models/studies-20261101/mcity-m6-appearance-d53f79a74e73.glb.gz",
    "rawSHA256": "d53f79a74e73066252cbc79bdd3ac93f9301b63e0a93af88a17ecb4feebd1c99",
    "downloadSHA256": "cad1af48cf240c74696e9d60a59694d7423092801e1f30f0bc9cc044e6976493",
    "decodedBytes": 9959008,
    "bytes": 1678043,
    "meshes": 27,
    "triangles": 172672,
    "materialCount": 17,
    "newFingerprint": "92aec5e1533d04e517d4bac09fc2998e2a48cc1c74c305201c9e01a4c7877e4e",
    "oldRecord": {
      "id": "mcity-m6-20261101-dated-exterior",
      "assetId": "mcity-m6-20261101-dated-exterior",
      "projectId": "mcity-6",
      "url": "models/studies-20261101/mcity-m6-dated-exterior.glb.gz",
      "sha256": "03cffd7b17cae8d431f3e30b567ac628415b87a09746951137d47a5ddab29693",
      "downloadSHA256": "03cffd7b17cae8d431f3e30b567ac628415b87a09746951137d47a5ddab29693",
      "decodedSHA256": "e42444feaca9794c97f4bce64b9e0936e0f224493d0eebd72d943d4e354c83c1",
      "bytes": 1549077,
      "bounds": [
        [
          -5862.970703125,
          83.9869613647461,
          599.799560546875
        ],
        [
          -5765.55908203125,
          282.1199951171875,
          701.1045532226562
        ]
      ],
      "status": "Proposed",
      "lifecycle": "proposed",
      "modes": [
        "future"
      ],
      "replacementModes": [
        "future"
      ],
      "replacesSourceIds": [
        "63-6173",
        "63-6174"
      ],
      "preserveMaterials": true,
      "preserveSourceNormals": true,
      "defaultVisible": true,
      "localOptional": false,
      "uncertainGeometry": true,
      "modelAccuracy": "Approximate source-informed dated exterior",
      "geometryConfidence": "Source floor levels, core dimensions and maximum highpoint. Balcony, crown screen, glazing depths and podium cadence interpreted. Lower lobby envelope joins the mapped podium; its exact glass line and fin depths are inferred. Terrain connection approximates actual viewer ground, not surveyed foundations.",
      "modelFidelity": "July 3 2025 fifth SPA submission, independently reconstructed from supplied exterior references. New owner plans under review.",
      "sourceDate": "2025-07-03",
      "credit": "Architectural design: Hariri Pontarini Architects. Model: Future Mississauga / Daniel Sultan. City of Mississauga reference placement.",
      "sourceOriginalsIncluded": false,
      "lifecycleReviewedOn": "2026-11-01",
      "lifecycleConfidence": "high for the stated planning stage; current physical delivery remains unverified",
      "statusEvidenceDate": "2026-10-29"
    },
    "changedKeys": [
      "url",
      "sha256",
      "downloadSHA256",
      "decodedSHA256",
      "bytes",
      "decodedBytes",
      "bounds",
      "triangleCount",
      "modelFidelity",
      "geometryConfidence",
      "sourceRevision",
      "modelReviewDate"
    ]
  },
  {
    "id": "mcity-m7-m8-20261101-dated-exteriors",
    "url": "models/studies-20261101/mcity-m7-m8-appearance-5ed5ca6a9a5a.glb.gz",
    "rawSHA256": "5ed5ca6a9a5ab4638ba87e453f2699c8f0c37f7054a49b250bc47012b7e2b9d2",
    "downloadSHA256": "ab9f1a2ebe1df2f2eb3260d2acd853ba56cc7d50a02ef2d9106ea79b9103b198",
    "decodedBytes": 17942420,
    "bytes": 3061801,
    "meshes": 37,
    "triangles": 309358,
    "materialCount": 16,
    "newFingerprint": "dde905734ab3e9754206ce0b688abf3b727cd548c8b8a7dd9fa8c3965c5ac562",
    "oldRecord": {
      "id": "mcity-m7-m8-20261101-dated-exteriors",
      "assetId": "mcity-m7-m8-20261101-dated-exteriors",
      "projectId": "mcity-7-8",
      "url": "models/studies-20261101/mcity-m7-m8-dated-exteriors.glb.gz",
      "sha256": "109c685cb649b359df4b7a1340f9b228101f75d7505bdf988d0fc894128351f8",
      "downloadSHA256": "109c685cb649b359df4b7a1340f9b228101f75d7505bdf988d0fc894128351f8",
      "bounds": [
        [
          -5795.11328125,
          81.00358581542969,
          639.2721557617188
        ],
        [
          -5691.71240234375,
          260.3999938964844,
          754.6295776367188
        ]
      ],
      "status": "Proposed",
      "modes": [
        "future"
      ],
      "replacementModes": [
        "future"
      ],
      "replacesSourceIds": [
        "63-6170",
        "63-6171",
        "63-6172"
      ],
      "preserveMaterials": true,
      "preserveSourceNormals": true,
      "defaultVisible": true,
      "uncertainGeometry": true,
      "geometryConfidence": "Source-dimensioned dated exterior; balcony depths, crown contours, materials and podium details are approximate. Lower foundation connects to sampled viewer terrain and is not surveyed grading.",
      "modelFidelity": "September 17 2024 submitted design, independently reconstructed from supplied exterior references. New owner plans under review.",
      "sourceDate": "2024-09-17",
      "credit": "Architectural design: Hariri Pontarini Architects. Model: Future Mississauga / Daniel Sultan. City of Mississauga reference placement.",
      "localOptional": false,
      "decodedSHA256": "168632db0d30a4eea06128add6be53b3fd31e39182e295a195df8d37d59a9266",
      "lifecycle": "proposed",
      "modelAccuracy": "Source-dimensioned dated exterior; balcony depths, crown contours, materials and podium details are approximate. Lower foundation connects to sampled viewer terrain and is not surveyed grading.",
      "sourceOriginalsIncluded": false,
      "bytes": 2621952,
      "lifecycleReviewedOn": "2026-11-01",
      "lifecycleConfidence": "high for the stated planning stage; current physical delivery remains unverified",
      "statusEvidenceDate": "2026-10-29"
    },
    "changedKeys": [
      "url",
      "sha256",
      "downloadSHA256",
      "decodedSHA256",
      "bytes",
      "decodedBytes",
      "bounds",
      "triangleCount",
      "modelFidelity",
      "geometryConfidence",
      "sourceRevision",
      "modelReviewDate"
    ]
  }
];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const fingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export function restoreM6M8Appearance(data){for(const spec of M6_M8_APPEARANCE){const matches=data.assets.filter(a=>a.id===spec.id);assert.equal(matches.length,1);assert.equal(fingerprint(matches[0]),spec.newFingerprint);data.assets[data.assets.indexOf(matches[0])]=structuredClone(spec.oldRecord);}return data;}
