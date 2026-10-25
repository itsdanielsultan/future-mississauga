# Individual model previews — release candidate

This candidate follows published source `808760edbde6b4913f6e52a87c6089de9d92b090`. It is prepared locally for exact-scope approval; this document does not assert deployment.

## Proposed pages and models

- `model.html?model=artform`: one accepted Artform Rev03 exterior study, with exact original GLB download and source/design credits.
- `model.html?model=mcity-m1`, `model=mcity-m2`, and `model=mcity-pair`: individual/paired previews of the two already-published M City web derivatives. The paired preview offers the two existing individual GLB downloads; no combined ZIP or native scene is added.
- `model.html`: chooser for those four views. The map project cards for Artform and M City link to the matching preview; the register and Sources page link to the chooser/credits.

Only Artform adds model bytes. Its accepted ZIP is `Artform_Rev03_20261025.zip`, Library `libfile_cf9399f695088191aca3b9244b708b21` v0, 7,182,751 bytes, SHA-256 `2a4bfb61e489aecc0eca530a6b0bdd19621d36a01c049f3a677ed40a0be1a54c`. The source model is `Artform_Rev03_20261025/models/Artform_Exterior_Study_rev03.glb`, 15,798,312 bytes, SHA-256 `8bcba67694f6f80553a505ca037fa5bbc3451d7cadd11c554b9221625c50964e`. `scripts/prepare-artform-preview.py` verifies both input hashes and creates a lossless gzip with a pinned platform header: 1,888,394 bytes, SHA-256 `cf708ba198b87b9373b5c74a2311dccde96a72fb17f05dbef693f889c40e3da7`. Decompressed download bytes remain identical to the accepted GLB.

The source ZIP, original GLB/native files and provenance are retained outside the publication tree and in Library. No original website asset, URL, project record or geometry is removed or overwritten. The Artform model uses local coordinates and is shown in a standalone scene; it is not silently placed into the city map. All 231 baseline model files and the two published M City derivatives are unchanged. Four unavailable 3085 derivatives remain disabled. Maritz, private recovery scenes and unrelated batch models are excluded.

## User experience

The viewer fetches only the selected model(s), verifies compressed and decoded hashes, and loads pair assets sequentially. It reuses the existing local Three.js libraries and Lato font. Display centering does not alter source model bytes or download transforms. No source photographs, architectural PDFs, native BLEND files, hidden recovery meshes or new external runtime dependencies are published.

Page scrolling and zoom remain available until the visitor explicitly chooses model interaction. Canvas-only interaction can be exited with Escape or Done. Keyboard controls, 44px targets, safe-area spacing, responsive short-landscape layout and container resize handling are included. Touch drawing resolution follows the existing 1.5 DPR / 1.5M-pixel budget. Rendering stops at rest, offscreen and in background tabs. Model/download errors offer retry; context loss offers restore and a reload fallback. Unknown IDs fail closed without loading a substitute model.

Artform is described as an approximate completed-building exterior study, not certified as-built. April 2026 masonry/frontage observations are qualified; passage depth, rear continuation, hidden faces and finished heights remain unverified. Zoning maxima are not measured building heights. Design credit is Studio JCI; developer credit EMBLEM. Reference photographs are attributed to Edward Skira and Tim MacDonald / UrbanToronto; Google Street View is a dated reference only, with no pixels redistributed. Existing M City source/design and municipal data qualifications remain visible. Credits are provided both on screen and in `downloads/Model-study-credits.txt`.

## Capacity and next additions

The unchanged strict cap remains below 1,000,000,000 bytes. Publish only the exact validated `dist/` inventory; final totals are in `PUBLICATION-MANIFEST.json` and the release handoff.

No further compression exception is needed for this Artform release. Additional locally verified candidates measure 193,485 compressed bytes for Central Library and 215,176 for Living Arts Centre, before their credits/metadata. Neither should be added blindly to the current remaining space.

A separate bounded audit measured 561,087 bytes recoverable by whitespace-only publication encoding of `downloads/revamp/Inland-water-elevation-repair.json`. Its sole existing hash reference is an October 4 historical proof. If selected for a later release, preserve the original source and historical record, record exact source/current identities and recovery locator, and allow only this named historical-pin exception; do not weaken the generic source-hash guard. Adding `Model-layer-audit.json` would yield 806,713 bytes combined. These options have **not** been applied. Three sampled PNGs offered another 156,455 bytes of exact-pixel/scanline lossless encoding, also unapplied. External asset hosting would require a separate concrete storage/release decision and browser CORS verification.

## Validation and release boundary

Meaningful checks cover exact route selection, per-model request isolation, lossless input/output identities, all nodes reachable in the delivered study, raw downloads, failed integrity/HTTP responses, retry, context recovery, keyboard/touch controls, all ten supplied Duo CSS sizes and idle rendering. Prior map behaviour is retained and requires a built-site smoke check. Final passed/failed/unrun results are in the separate handoff.

New public use of Artform and the exact affected pages/assets require parent review of the concrete candidate. Prior Duo release approval covers its published commit, not this new geometry. No outreach is performed by this task. Physical Duo/Safari 27.1 testing remains unrun.
