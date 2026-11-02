// Exact accepted M3 full-replacement exception; every other field stays guarded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const M3_V7_SCOPE={
  "oldAsset": {
    "status": "Under Construction",
    "includedByDefault": true,
    "defaultVisible": true,
    "localOptional": false,
    "preserveMaterials": true,
    "preserveSourceNormals": true,
    "uncertainGeometry": true,
    "replacesSourceIds": [],
    "replacementModes": [],
    "viewerDistricts": [
      "downtown",
      "cooksville",
      "uptown",
      "heartland",
      "citywide"
    ],
    "sourceOriginalsEmbedded": false,
    "geometryAuthorship": "Daniel Sultan / Future Mississauga independent source-informed interpretation",
    "runtimeShadingPolicy": "Preserve PBR materials. Candidates omit NORMAL attributes by design; official GLTFLoader uses flat shading. Skip application-level normal recomputation.",
    "id": "mcity-m3-upper-detail-20261101",
    "assetId": "mcity-m3-upper-detail-20261101",
    "projectId": "mcity-3",
    "url": "models/studies-20261101/mcity-m3-exterior-overlay-v2.glb",
    "sha256": "de41aa0078aab3d32c0bdee631434878c8f0bed44dfaff66244b67dc50231699",
    "downloadSHA256": "de41aa0078aab3d32c0bdee631434878c8f0bed44dfaff66244b67dc50231699",
    "bytes": 1832884,
    "triangleCount": 96584,
    "bounds": [
      [
        -5744.306640625,
        84.88999938964844,
        468.69842529296875
      ],
      [
        -5651.8271484375,
        345.17999267578125,
        558.9814453125
      ]
    ],
    "modes": [
      "future",
      "construction"
    ],
    "recordedProgress": true,
    "modelFidelity": "Continuous approximate lower/upper exterior glazing and balcony articulation, podium bands/mullions and qualified glass-pavilion facade treatment; exact City lower capture retained beneath overlays.",
    "warning": "Exact City 63-6249 geometry is retained beneath newly authored facade overlays. Lower floor outlines follow the coarse City footprint; bay spacing, balcony returns, depths and pavilion corner treatment are approximate. The inherited 7 m join, ±15 m floor schedule and closed six-strip crown remain qualified; mechanical steel/cavities are not reconstructed.",
    "credit": "Independent interpretation: Daniel Sultan / Future Mississauga. Exact lower geometry: City of Mississauga. Architecture/reference plans: IBI Group / M City. Height: Andrew Fisher. Crown references: Tim MacDonald via UrbanToronto and Walters Group.",
    "qualification": [
      "The original City geometry and placement remain exactly unchanged beneath exterior layers. No source photographs or drawing pixels are embedded.",
      "Below the originally detailed upper floors, bands follow the coarse City footprint. Exact lower floor contours, per-floor white return phase, facade bay count and metric depths are not measured.",
      "Podium six-level split is estimated within the captured28m envelope: [0, 5.8, 10.2, 14.6, 19.0, 23.5, 28.0]. Pavilion is an approximate corner facade treatment and shallow roof frame, not a measured freestanding volume.",
      "Source reconciliation join and inherited floor schedule remain. Inherited floor height uncertainty15m, footprint4m, placement5m, crown6m remain.",
      "Crown is still a closed simplified six-strip envelope; exact open mechanical steel/cavities remain unmodeled.",
      "Opaque glazing represents exterior material only. No interior geometry or present-day as-built claim."
    ],
    "sourceRevision": "2026-11-01 v2 lower facade and podium overlay; mixed source dates retained",
    "sourceEvidenceDate": "2026-07-15 / undated developer plans",
    "sources": [
      {
        "url": "https://mcitycondos.com/assets/img/condominiums/m3/floorplans/M3_2.pdf",
        "publisher": "M City / IBI Group",
        "claim": "Traced lower typical balcony types and floor74 contour"
      },
      {
        "url": "https://www.waltersgroupinc.com/project/m-city/",
        "publisher": "Walters Group",
        "claim": "Crown appearance reference, not measured steel geometry"
      },
      {
        "url": "https://urbantoronto.ca/news/2026/07/crown-materializing-crane-dematerialzing-m3-canadas-tallest-building-outside-toronto.61378",
        "publisher": "Tim MacDonald via UrbanToronto",
        "claim": "Dated crown and full lower tower/podium photographic references; no current as-built claim"
      },
      {
        "publisher": "M City / IBI Group",
        "title": "Saved official M3 brochure, pages 4, 13, 14 and 24",
        "claim": "Six-storey metal/glass podium and multi-level glass pavilion; exterior visual language. Exact private source pin is in m3-v2-proof.json."
      }
    ],
    "loadWithMunicipalMesh": "63-6249",
    "municipalMeshIncluded": false,
    "architecturalHeightM": 260.29,
    "supersedesAssetIds": [
      "mcity-m3-crown-silhouette"
    ],
    "supersedesSupplementalModels": [
      "mcity-m3-upper-envelope.glb"
    ],
    "modelAccuracy": "Approximate",
    "geometryConfidence": "Source-supported exterior interpretation with the explicit dimensional and registration limits in qualification and warning.",
    "name": "M3 exterior overlay v2",
    "geometryCoverage": "Continuous approximate lower/upper exterior glazing and balcony articulation, podium bands/mullions and qualified glass-pavilion facade treatment; exact City lower capture retained beneath overlays.",
    "legacyAssetIdNote": "Stable asset ID retains upper-detail wording for integration compatibility; this v2 file also includes lower-facade and podium overlays.",
    "decodedSHA256": "de41aa0078aab3d32c0bdee631434878c8f0bed44dfaff66244b67dc50231699",
    "lifecycle": "under_construction"
  },
  "newAssetId": "mcity-m3-likeness-20261101-v7",
  "newAssetFingerprint": "a2463ba3713bdcea934e41119fcd37a0f105555d234cfa4d6743c0022704214b",
  "oldProjectFields": {
    "supplementalAssetIds": [
      "mcity-m3-upper-detail-20261101"
    ],
    "geometryCoverage": "Approximate serrated upper slabs, recessed glazing and stepped crown fascia, with exact City lower capture retained.",
    "modelCaveat": "City lower capture geometry is unchanged and remains simple. Its gray comparison material is an authored neutral display material, not a claim about source-native finish. Upper detailed model retains inherited 7m join, ±15m floor-height schedule and approximate closed crown; no mechanical steel layout is claimed."
  },
  "newProjectFingerprint": "918a2aec63af67e239f9bc39a84c1b90dcfe20eb72aa80781cb612cb4ccf29e6",
  "priorProjectsFingerprint": "1a44d41722cf2f3bddf074f79638b8255f454853a01f10bd416f59b4cd548f63",
  "versions": [
    {
      "url": "models/studies-20261101/mcity-m3-exterior-v7-425f374d4a72.glb.gz",
      "sha256": "46069389dca1b1f6f129b0a88d96f19ff8c00aa6d2fb2d87ddf05e0106c0c78f"
    },
    {
      "url": "models/studies-20261101/mcity-m3-exterior-v7-425f374d4a72.glb",
      "sha256": "425f374d4a72f53471dc19e0222bafaf38058ed570793674cfa5a065ea3eeca1"
    }
  ]
};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const fingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export function restoreM3V7Asset(data){const matches=data.assets.filter(a=>a.projectId==='mcity-3');assert.equal(matches.length,1);const row=matches[0];assert.equal(row.id,M3_V7_SCOPE.newAssetId);assert.equal(fingerprint(row),M3_V7_SCOPE.newAssetFingerprint);data.assets[data.assets.indexOf(row)]=structuredClone(M3_V7_SCOPE.oldAsset);return data;}
export function restoreM3V7Projects(rows){const p=rows.find(p=>p.id==='mcity-3');assert.equal(fingerprint(p),M3_V7_SCOPE.newProjectFingerprint);Object.assign(p,structuredClone(M3_V7_SCOPE.oldProjectFields));return rows;}
