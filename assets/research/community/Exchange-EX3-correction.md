# Exchange EX3: current floor-count correction

Reviewed 26 September 2026. The architect [Arcadis](https://www.arcadis.com/en/projects/north-america/canada/exchange-district) identifies the largest tower as **66 storeys** and explains that its rectangular blocks alternate every six floors. The older native City model has an additional upper black six-floor block. An [August 28 construction observation](https://urbantoronto.ca/forum/threads/toronto-exchange-district-condos-232m-72s-camrost-felcorp-arcadis.29739/page-77) reports topping at 66 with the mechanical roof forming; the [September 5 photograph](https://urbantoronto.ca/forum/attachments/20260905_155540-copy-jpg.762969/) provides a qualitative cross-check.

The corrected future view removes that one native module and places the existing planned blue crown above the final white block. It retains the original mapped tower position, every lower floor level, the white roof, the other three towers, the shared podium, and all source textures. It does not rescale the entire tower.

## What is measured and what is inferred

The removed module is **18.954590 m high within the source model**. The original white roof is at model Y 288.046417 m, and the translated planned crown reaches model Y 295.389313 m. These are model coordinates, **not a verified revised architectural height**. The current floor count is sourced; the decision to preserve all lower levels and reuse the original crown dimensions, orientation and placement relative to the white roof is an architectural interpretation. Revised dimensioned roof/elevation drawings have not been recovered. The old 232 m / 72-storey headline must not be presented as the verified current design.

The existing native crown overhang/orientation is retained. No new mechanical equipment, facade treatment, roof survey, completion date, or occupancy is invented. The recorded-progress view remains separate and does not show the planned blue crown as completed construction.

## Verification

The preferred GLB contains 24 meshes and 95,008 triangles, down from 97,896. Nineteen meshes remain unchanged. All retained whole triangles preserve their source positions, normals, UVs and winding. Forty facade triangles that crossed the cut were clipped at the source white-roof level with interpolated boundary attributes. The obsolete black module's 42 bottom triangles were removed while the original white roof remains intact. The native crown is translated only vertically. Encoded texture bytes and all other building/podium parts are unchanged.

The local comparison uses the same native Blender camera, lighting, materials and render settings before and after. Detailed values and invariants are in [the correction record](Exchange-EX3-correction.json) and [geometry QA](Exchange-EX3-invariant-QA.json).
