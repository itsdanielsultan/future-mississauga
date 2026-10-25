# Recovered M City viewer review, 25 October 2026

HISTORICAL RECOVERY SNAPSHOT. The size and browser blockers recorded below are superseded by [the completed mobile integration review](docs/mobile-integration-20261025.md). Source caveats and the prohibition on unapproved publication remain. The original recovery report is retained below for provenance.

## Recovery boundary

Pinned source baseline: `bdc90b554778f27160f90d329fba1e0e7e67feb6`.
The unpushed review `5c58c5995183d94dc063a6ed8af455dc3cc5199e` and its final ZIP were lost during workspace cleanup. This branch is an equivalent reconstruction, NOT that commit restored.

- **Recovered exactly:** the two M City podium Rev02 web derivatives match both historical gzip and decoded SHA-256 values.
- **Reconstructed and freshly tested:** optional loading, selection labels, exact-source fallback masking and review tests. The mask JSON itself was lost; its 404-face scope was freshly re-extracted from ten surviving source components, then verified against both baseline district models.
- **Unavailable:** four prior September 2024 3085 Hurontario registered/skirt derivatives and their precise terrain/mask records. None are integrated here. No replacement registration or new 3085 Rev02 geometry has been substituted.
- **Retained:** every original baseline model/image/download inventory row and all non-M-City project records. Existing 3085 baseline records/surfaces remain unchanged. No new building count is claimed.

## What the review changes

M City is an explicit opt-in approximate completed exterior study. Initial model loading keeps municipal geometry and does not fetch these optional assets. Selecting the M City study or enabling the optional-studies control loads them lazily. Repeated requests are deduplicated; failed requests can retry. Results from an abandoned district are disposed, never attached to a newer district. Changing to Existing or Construction retains a selected completed study.

Gzip models support either raw gzip responses or server-decoded GLB responses. Unsupported decompression, HTTP errors and malformed payloads fail closed. Source faces stay visible until a replacement with nonempty geometry is actually visible. Turning studies off restores all source faces. No broad anonymous mesh ID is suppressed.

Exact source signatures use world coordinates rounded to 1 mm. Fresh real-GLTFLoader tests confirm 136 M1 + 268 M2 triangles are separated, not deleted, in downtown and citywide. Adjacent triangles are not removed. All three scenarios and partial-load/empty-replacement fallback are covered.

## Geometry and performance

| Study | Triangles | Primitives before / after | Raw source / web bytes | Gzip source / web bytes |
|---|---:|---:|---:|---:|
| M1 Rev02 | 310,063 | 653 / 166 | 17,253,368 / 18,386,320 | 2,364,152 / 2,905,404 |
| M2 Rev02 | 319,263 | 660 / 173 | 18,228,068 / 19,344,212 | 2,532,724 / 3,043,983 |

Combined draw primitives fall 74.18%, from 1,313 to 339. This is NOT a bandwidth reduction: combined gzip grows by 1,052,511 bytes versus the unregistered source exports. 132 / 133 transparent sort units remain separate. Opaque groups retain material, attribute schema and semantic boundaries. No decimation, texture substitution or material-value edits occur.

Fresh independent expanded-triangle checks verify all 629,326 triangles, positions, normals and UVs against corrected source transforms, with zero attribute differences. Material JSON is identical. The original 575,424 tower triangles, their materials and transforms independently match surviving pre-Rev02 inputs. Retained podium source vertices register within 0.000063 m. This proves source alignment, not architectural dimensional accuracy.

## Source and colour limits

M1 podium cues derive from May 2026 Street View. M2 Quartz/Webb cues derive from June 2024 Street View; the May 2026 pair view covers a different frontage. These dated observations were documented by the source-model review, not newly inspected by this integration recovery.

Pale slab/guard bands, dark recesses and selective coloured retail-screen cues are represented. Exact bay widths, portal locations, depths, colour calibration, floor schedules and tower footprints remain inferred. M2's unresolved pale patterned wall is omitted. CTBUH 199.2 / 200 m versus alternate 197.81 m heights and 61 versus 60/63 storey descriptions remain qualified. Completed status is not converted to a proposal. No reference panorama, screenshot, photograph or texture is bundled.

Each podium part receives its OWN retained source-base elevation correction before the shared rotation and tower-specific elevation. M1 entry parts map to P03; M2 to P07. The original presentation exports remain immutable.

## Fresh verification

- 46 Node tests pass, including 27 baseline tests, real GLTFLoader parses, exact-mask restoration, lazy loading/cancellation/retry, selected-study mode handling and unchanged baseline metadata.
- 4 Python datum/semantic tests pass.
- Fresh independent triangle/material/UV/source-registration and original-tower comparisons pass.
- Modified JavaScript syntax checks pass.
- 487 protected baseline inventory rows remain unchanged. This is a pinned Git/inventory preservation proof, NOT a fresh rehash of every unmaterialized baseline asset.
- Full `npm run check` and `npm run build` stop at the intentionally sparse-excluded atlas PDF. They do not pass; no `dist` is produced. The missing file is a checkout omission, not a source deletion.
- The separate complete-inventory size projection FAILS: 1,006,003,847 bytes, +6,006,538 from the 999,997,309-byte baseline. The unchanged requirement is strictly below 1,000,000,000 bytes. The projection is 6,003,848 bytes over the largest allowed total. Per-file sizes remain below 100,000,000 bytes.

Commands: `node --test scripts/*.test.mjs`; `python scripts/prepare-study-glb.test.py`; `node scripts/review-publication-size.mjs` (expected exit 1). Full repository validation remains required after a complete checkout and an approved size solution.

## Browser QA remains blocked

Target flow: open map, select M City, inspect Existing/Construction/Future, return to source, then interrupt/repeat navigation and failed optional loads, at desktop and mobile sizes.

No rendered page identity, nonblank/overlay check, console-health check, screenshot or interaction proof is claimed. Earlier executor Chromium failed with `process_singleton` socket `Operation not permitted`; an escalation wrapper failed before browser execution at a denied runtime bind. The separate cloud browser could not reach executor localhost. These routes were not retried or bypassed. A real permitted browser route is still required before publication.

## Pending publication decision

No cap weakening or asset removal is proposed as an automatic fix. A fresh read-only lossless analysis found a conditional URL-preserving option: 91 PNGs can save 5,443,566 bytes while retaining identical decoded pixels, filtered scanlines and every non-IDAT chunk, including colour/attribution metadata. Conservative JSON minification excludes 49 hash-pinned files and saves 2,767,004 bytes across 88 files. Together they project 997,793,277 bytes, or 2,206,722 bytes below the largest allowed total, before any new provenance record overhead. This option was NOT applied. All 91 PNGs have historical/original byte-hash records, so unconditionally unpinned PNG savings are zero; an explicit derived/version record and reference review must preserve the old claims and baseline bytes. With only unpinned JSON changes the gap remains 3,236,844 bytes. See `docs/lossless-size-review-20261025.md`. `build.mjs` already copies only `public/`, so excluding this review's native inputs, tests or source archives cannot create headroom: none are in that tree.

A separately reviewed legacy-preview option covers 91 PNGs totaling 464,921,126 bytes. The companion technical package lists every current public URL, exact immutable baseline-commit candidate URL, SHA-256 and literal reference location. Migration is an alternative, not established as necessary if the conditional lossless/versioning option is approved. Migration/removal requires explicit approval, complete URL/CORS/MIME/cache checks and browser regression checks. Existing public paths would break if files were simply removed; preserving all existing paths/files saves zero bytes. Original-download release masters are unaffected. No migration, upload, removal, new charge or external serving arrangement is implemented.

## Review and rollback

Apply the supplied binary patch only to a clean isolated branch at the pinned baseline. The package includes the recovered files, source inputs needed for the two derivative builds, regeneration scripts, comparisons and a patch-replay byte check. Baseline assets are not copied into the patch. Do not use the historical lost test result as a current pass.

Rollback is a reverse application of this exact patch on an otherwise unchanged isolated branch. Publication remains a separate exact staged review: resolve size, fully materialize and validate the site, pass permitted rendered-browser QA, inspect status/source/colour caveats, review the exact diff and only then request authorization for external actions.
