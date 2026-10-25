# Mobile viewer integration, 25 October 2026

The recovered M City integration and mobile implementation are complete for local review. Publication remains unauthorized. This status supersedes the historical build/browser blockers in `INTEGRATION-REVIEW.md`; its source and recovery caveats still apply.

## Implementation

- Two exact M City Rev02 derivatives remain opt-in. Selection persists in Existing, Construction and Future modes. Retry, request deduplication, stale-result disposal and precise 404-face source masking retain the municipal fallback.
- The four unavailable prior 3085 derivatives remain disabled. No substitute geometry was introduced. All 231 baseline model files and all non-M-City project records are retained.
- Responsive controls, search, readable details and native disclosures accommodate short landscape, inner display and split-window sizes. Safe-area spacing covers every edge; page zoom remains available. Touch controls are at least 44 CSS pixels and text-entry controls use 16px text. Search and panels respond to the visual viewport.
- Rendering follows the actual canvas container. Touch devices use at most 1.5 DPR and a 1.5-million-pixel drawing-buffer budget, with 2048px shadows. Static, background and offscreen maps stop requesting frames. Context loss preserves recovery controls and cannot produce a blank successful export.
- Optional surrounding context unloads when switched off. Compact/coarse-pointer devices decode the overview sequentially and skip neighbouring detailed district files. Actual source-asset verification retained 153,858,125 CPU geometry bytes before off and zero afterward; this is not total device or GPU memory.
- Startup and district failures expose retry and gallery fallback; obsolete optional failures cannot undo a user's return to the current view. The municipal scene remains interactive and requests its first frame before optional downloads complete.

## Publication output

Publish only validated `dist/`, never the larger preserved `public/` source tree. `npm run check` and `npm run build` prepare actual publication bytes and run the original strict validator, with no size-cap changes.

Final output: 749 files, **997,948,014 bytes**, leaving **2,051,985 bytes** below the largest permitted total of 999,999,999. `PUBLICATION-MANIFEST.json` hashes every output file. The generated, Sources-linked `data/publication-derivatives.json` distinguishes current encoded preview bytes from historical source hashes. Of 91 checked legacy PNGs, 69 are recompressed losslessly; 88 JSON files remove only whitespace. Pixels, filtered scanlines and non-IDAT chunks remain exact. Original source files and full-resolution release downloads/URLs are unchanged. See `publication-encoding-20261025.md`.

## Verification

- 67 Node tests and 6 Python tests pass, including asynchronous recovery regressions.
- Both M City gzip and decoded hashes regenerate exactly on this Mac. Original tower attributes, triangles, materials and transforms remain exact; fresh masks total 136 + 268 faces.
- Full build and explicit check pass. Independent Pillow decoding verifies all 91 preview PNGs.
- Chromium 145 and installed WebKit 26.0 each pass 23 interaction checks, including 14 responsive viewports, search, scenario persistence, resize, comparison, export, context recovery and optional retry. All ten documented Duo viewport combinations are included.
- Additional browser checks cover touch pan/pinch, page zoom, gallery previews, eight other-page/viewport smoke cases, five loading-failure cases and six asynchronous interruption assertions. Normal application flows have no console errors.

The documented Duo viewport widths/heights come from WebKit's [Safari 27.1 guidance](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/). The viewport matrix includes 382×580/618, 594×368/406, 669×867/902, 951×585/620 and 385×571/609. Default behavior does not depend on experimental posture or viewport-segment APIs.

These are browser and touch emulations on the Mac. Physical iPhone Duo, Safari 27.1, hardware safe areas, a real iOS software keyboard and sustained device thermal/memory behavior are untested. No simulator, browser dependency or permission was installed or changed.

## Release boundary

No push, merge, deployment or live-site modification has occurred. Publishing requires approval of the exact reviewed commit and generated `dist/` inventory, including public use of the qualified optional M City studies, followed by the established website owner's release process. Existing private-source holds remain in force. Raw source/public assets must not be substituted for `dist/` in that process. New detailed batches are not automatically loaded on phones.
