# Detailed models in the city map

The map now loads seven already-public completed building studies by default: M City M1/M2, Avia 1/2 with their shared podium, Edge 1/2, and Artform. All original GLB files, catalogue identities, source tiles, status records and source-rights metadata remain unchanged. The optional-study filter still controls unrelated alternate studies.

## Placement

- M City uses the existing source-registered web derivatives unchanged. No extra rotation or translation is applied. Its 404 exact municipal faces remain as recoverable fallback geometry.
- Avia uses the Rev02 documented local-to-map translation `[-6040,88.3,-10]`, without rotation or scale changes. All three components load atomically before municipal node `63-6237` is hidden. Its base is the captured source vertex, not a surveyed floor datum.
- Edge 1/2 use unit-scale rigid fits to the independently matched municipal podium corners. Their fit RMS errors are 0.200 m and 0.212 m. The registered model heights remain the authored values. Their 92 and 44 exact municipal fallback faces are preserved.
- Artform uses a unit-scale rigid fit of five shared footprint controls, RMS 0.560 m and maximum 0.711 m. Its local base is placed at the existing City main-block base `40.189998626708984`; the model is not lowered to the terrain. Its 240 exact municipal faces use separate replacement bounds because the old footprint extends beyond the new one. The opposite balcony edge differs by roughly 2 m, and the podium outline remains approximate. The existing City base sits roughly 0.5–1 m above mapped terrain at the front and 2.6 m at the rear wing. This inherited discrepancy is disclosed in model notes and is not claimed as verified ground contact.

`public/city-model-placements.js` records the Edge and Artform registration, fit residuals, source hashes and exact triangle keys. `public/city-model-studies.js` joins those placements to the unchanged public catalogue.

## Oro remains separate

Oro's public model is the full intended July 2020 design. It is not integrated into the city map. The existing municipal map geometry and its scenario behavior remain unchanged; the original standalone preview and download remain available. Its authored vertical datum was not lowered or altered to conceal the unresolved ground connection.

## Loading and display

Every new city-map load verifies both compressed and decoded catalogue hashes. Models use the existing public local or immutable GitHub URLs. Opaque batching is the same display-only batching used by standalone previews; original geometry, transparent surfaces, normals and materials remain intact. The Avia assembly reduces 1,149 meshes to 280 display meshes.

Municipal geometry remains visible until a full replacement has loaded, passed integrity checks and matched its registered bounds. A failed component disposes the incomplete assembly and exposes Retry models. District navigation disposes stale results. A missing detail catalogue leaves the municipal map usable. Completed replacements stay visible in existing, construction and future scenarios.

Focused building framing now adapts when the details panel moves below a narrow map. Deliberate camera navigation releases that automatic refit. Typing or clearing a search cancels pending URL focus so late detail loading cannot overwrite the new search.

## Validation

The focused integration, source-mask, loader, batching, model-preview, camera, resize, recovery, card and autostart suite passed 73 tests. Actual GLTFLoader tests verify source bytes, transformed bounds, triangle counts, exact fallback masks in Downtown/Citywide/Cooksville, atomic failure/retry and preservation of Oro. `validate-city-model-studies.mjs` is included in the existing publication validator without weakening the local-model or protected-asset checks. Browser review and publication remain the release owner's responsibility.
