# Historical transit visibility correction

**Superseded display method.** This audit records the earlier always-visible route display. The current Transit Depth edition restores physical occlusion and route-specific display heights. Read the [current correction and source review](../../transit-depth/Transit-depth-review.md).

Reviewed September 21, 2026. GO is consistently green (`#25825e`), the Transitway blue (`#1175b6`), and the Hazel McCallion Line gold (`#d6ac39`). The coloured strips are continuous cartographic guides, 3 m wide, separate from the restrained grey physical railway and guideway display.

The earlier lines had 2,323 below-surface or near-contact samples among 60,265 checks of route centres at no more than 3 m spacing. Of those, 2,006 were strictly below a checked surface. The revised actual strip geometry passed 509,181 checks of its centre and both edges at no more than 1 m spacing, with zero below-surface or near-contact samples; 508,179 had an overlapping context triangle. Minimum checked clearance is 0.192 m. The before and after totals use different sampling densities and are not an identical paired observation set.

The audit used 77 actual render and browser source files and 854,834 nearby triangles. It includes ground, roads, parks, woodland surfaces, mapped landscape, bridge decks, station display and accepted street details. Geometry hashes identify the precise sources in `visibility-audit.json`.

All 23 horizontal route paths are unchanged to less than 0.001 m. All 810 checks of physical mesh positions, faces and transforms match the original sources. The original 3D `physicalPoints` are retained in the route JSON. The coloured guide alone follows a separately disclosed upper display profile, with an 8% visualization slope cap and a maximum local lift of 7.779 m. Neither value is surveyed railway engineering. Port Credit and other below-grade routes remain below grade in the physical representation while the guide stays legible.

Both Transitway segment types use the same blue. Segment labels still distinguish dedicated busway from the existing Highway 403 and street connection. A colour change no longer implies that the route ends. HML has a separate gold service guide instead of depending on lighting of its track-bed material. All guide primitives have uniform `COLOR_0` and `KHR_materials_unlit`.

Full municipal system assets are used for composed camera views. The interactive citywide assets also contain the full municipal network; the previous western Milton clipping is removed. Ordinary district assets remain intentionally clipped to their browsing windows, and `districtBoundaryExits` supplies explicit continuation markers.

Buildings and illustrative tree crowns are outside this ground-surface clearance test. The renderer must composite the guide as a separate unlit cartographic pass, and the browser must disable depth testing and writes for guide meshes only. This keeps the service path readable without claiming the railway has moved above buildings or bridge decks. Physical rails use ordinary scene depth and can be correctly hidden by a surface.

## Matching checks

The six context-only native Blender views use identical before/after cameras and source context. They demonstrate ground and crossing continuity; the final application's full-scene colour and overlay integration is a separate check.

| Location | Before | After |
|---|---|---|
| Downtown Junction | [Before](visibility-checks/downtown-junction-before.png) | [After](visibility-checks/downtown-junction-after.png) |
| Port Credit Go | [Before](visibility-checks/port-credit-go-before.png) | [After](visibility-checks/port-credit-go-after.png) |
| Milton Crossing | [Before](visibility-checks/milton-crossing-before.png) | [After](visibility-checks/milton-crossing-after.png) |

The `before` and `after` labels identify successive transit display editions, not real-world construction dates. The municipal building model and geographic route alignment are not changed by this visibility correction.
