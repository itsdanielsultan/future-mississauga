# Oro composite candidate

This isolated candidate adds the unchanged public Oro Rev03 GLB to the city map at unit scale, rotation Y 46.764265665329 degrees and translation `[-4514.404296875,69.55,-275.9661610921224]`. The model represents the intended July 2020 design, not measured construction progress. It follows the existing project's construction/future scenario inclusion and remains absent from Existing. Other unverified construction models retain their existing visibility rules.

The residential lobby datum is drawing elevation 139.550 m minus the map's 70 m origin. The detailed local Y range remains 0–166.875 m, giving map Y 69.550–236.425 m. No native vertices, height, footprint, source file or download bytes are changed.

## Source-preserving lower portion

At runtime, only municipal nodes `63-6206` and `63-6207` are clipped below map Y 69.55. The complete originals remain intact as fallbacks. Source triangle signatures are verified before clipping. Crossing triangles are intersected with the plane rather than discarded. The resulting 136 podium and 46 tower triangles match the independent diagnostic's vertex sets at render precision.

The exposed top of each source shell is closed strictly along its actual planar cut section. The podium cap retains its tower-shaped hole; the separate tower cap fills that section. Their areas are 1843.812939886 m² and 861.876249671 m². The 68 and 22 cap triangles face upward, including near-collinear triangles after Float32 conversion. No skirt, extra retail façade, support wall, extended slab, convex hull or terrain change is added. The derived cut closure is identified in the expanded project details.

Detailed geometry, lower shell and cap form one atomic replacement. Integrity, source, clipping, cap or bounds failure preserves both original City nodes. Retry uses the same complete assembly. Scenario changes restore the original baseline whenever the replacement is not visible. The existing seven detailed buildings, source rights, credited previews and automatic loading remain intact.

## Known geometric limits for visual review

The City lower perimeter remains approximately 0.013–0.521 m above the rendered terrain. The detailed slab overlaps 92.55% of its area with the City section. About 204.45 m² of detailed slab extends beyond that section, while 164.89 m² of the City section projects outside it. Maximum measured overhang is 6.03 m; maximum City projection is 4.44 m. A planar closure does not remove these outline differences or reconstruct lower retail façades. Formal common vertical-datum certification remains unverified.

Private handoffs and review cameras are recorded in `release/independent-source-audit.json` alongside the candidate. They include the worst overhang, City projection, long positive-X edge, and maximum terrain gap. The release owner must judge normal and close desktop/phone views separately from these geometric checks.

## Verification

All 111 repository tests pass. The six new Oro tests cover the three district sources, exact clipped vertex signatures, upward planar caps and areas, original source preservation, unchanged detailed height and triangle count, atomic failure/retry and construction/future/Existing visibility. The publication model validator now distinguishes the intended Oro design from the seven completed buildings.

This document describes a local candidate. It does not establish publication or final visual acceptance.
