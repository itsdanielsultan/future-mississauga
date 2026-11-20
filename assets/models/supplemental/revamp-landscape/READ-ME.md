# Landscape layers and scene recoverability · Transit Revamp

All 15 district windows now have separate source-mapped landscape overlays, baseline/future tree-crown corrections and corrected ground-surface normals. The integration register is [landscape-layer-manifest.json](../../../data/landscape-layer-manifest.json). It records every asset path, hash, category and tree-file mapping. No original-edition file or saved before checkpoint was changed.

| District | Surface features | Triangles |
|---|---:|---:|
| citywide | 847 | 165,289 |
| downtown | 355 | 28,211 |
| port-credit | 8 | 934 |
| lakeview | 20 | 3,314 |
| clarkson | 29 | 8,294 |
| cooksville | 75 | 8,145 |
| uptown | 106 | 14,370 |
| erin-mills | 82 | 33,542 |
| streetsville | 41 | 13,982 |
| meadowvale | 79 | 20,837 |
| malton | 33 | 8,122 |
| dixie-applewood | 68 | 14,986 |
| erindale | 50 | 11,047 |
| airport-corporate | 13 | 4,339 |
| heartland | 59 | 14,782 |

These are overlapping spatial exports. Do not add their feature counts together as though they were unique city features. The citywide asset contains 847 surfaces: 303 narrow sidewalk faces, 261 playground footprints, 134 court/sport surfaces, 147 playing-field outlines, the Celebration Square lawn and its central paved surround. Sidewalk coverage remains concentrated in the initially retrieved Downtown extent. Other districts receive verified closed public play/sport/field footprints; open trails and unverified widths are omitted.

## Source geometry and interpretation

The [City’s planimetric line service](https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/Planimetric_Lines/FeatureServer/0) supplies the mapped 2024 boundaries. Closed `AreaOutline` faces are used for courts and fields only when corroborated spatially by the [City Landmarks inventory](https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/CITY_POI/FeatureServer/0). Actual outlines are retained. Sport striping, equipment and generic path widths are not invented. Muted surface colours are illustrative, rather than a material survey.

The [City’s 2023 Celebration Square amenities map](https://www.mississauga.ca/wp-content/uploads/2023/04/MCS_Amenities_Site_Map_2023.pdf) labels a 156 × 189 ft lawn. A matching exact 2024 GIS boundary anchors the mapped lawn and affine registration of the central paved surround. The fit residual is 0.022 m, but this mathematical residual does not establish survey accuracy: the traced plan carries roughly 0.5 m manual tracing tolerance and its original schematic precision. The library, raised garden, trellis and main stage are excluded from the paving polygon. No future refurbishment design is invented.

Review date is September 20, 2026. Source geometry dates are 2023/2024 and may predate subsequent construction. Per-feature source IDs and semantics remain in each GLB’s adjacent JSON. Broad ambiguous sidewalk enclosures, including the Scholars’ Green planting lattice, are omitted.

## Terrain and surface placement

Coordinates use EPSG:26917 metres: `x = easting − 615000`, `y = elevation − 70`, `z = 4827000 − northing`.

The overlay follows the existing mixed-date Ontario LiDAR DTM and samples the actual displayed terrain/park/woodland triangle planes. Eight-metre cells and three-metre contour subdivisions retain terrain relief. Surfaces sit normally 0.45 m above sampled DTM, or at least 0.14 m above the competing context. Larger local lifts can occur where the existing context’s coarse triangulation and the DTM differ; exact quantiles and maxima are disclosed per asset. These are display offsets, not reconstructed kerb or pavement elevations. No ground is flattened.

Exact retained City building footprints and overlapping supplemental proposal envelopes are excluded. Mapped roads and water carry a 0.05 m numerical exclusion margin. The current Hurontario LRT alignment receives a 30 m exclusion buffer so older sidewalk edges are not imposed on current transit works. This conservative common layer does not invent future landscape designs around new buildings.

Final encoded-geometry checks found no non-finite vertices. Winding is upward and collapsed projected-area triangles are removed; actual coordinates remain unchanged. Clearance was checked at vertices and triangle centroids against the displayed context, so final close-view visual review is still useful.

## Tree data and crown corrections

The audit covered **499,976 unique tree records**, queried **23,396 exact City building footprints**, and checked **20 supplemental envelopes**. It found **6,789 conflicting tree records** across the reviewed future model.

Actual municipal inventory IDs are below 2,000,000,000. Higher IDs represent illustrative woodland canopy instances placed within mapped wooded polygons. Every actual inventory position, species and diameter record is retained. Corrections affect only the illustrative crown rendering.

| Scenario | Inventory crowns made narrower | Inventory crowns suppressed, points retained | Illustrative woodland crowns suppressed |
|---|---:|---:|---:|
| Baseline | 2,057 | 129 | 4,036 |
| Reviewed future | 2,076 | 136 | 4,577 |

These are unique audit counts; district files overlap. A suppressed inventory crown indicates conflicting mixed-date geometry or overhangs, not confirmed tree removal. Tree dimensions and woodland instance placement remain illustrative. No source tree point is moved.

Use the manifest’s per-district `baseline` or `future` tree mapping. Tuple index 7 is the horizontal crown scale; default to 1, and omit crown geometry when it is 0. Preserve vertical crown height and all source coordinates. Construction-stage views should use baseline corrections unless documented built geometry supports further exclusions. Mapped pavement alone is not used to delete inventory trees.

The expanded audit supersedes the initial compact Downtown audit. The latest source overrides exclude source72-6104, so those superseded footprint conflicts are correctly absent from the final files.

## Highway and terrain shading repair

Raycasts of the black triangular marks in the saved Downtown junction view found ordinary terrain faces with upward geometric normals but almost vertically inverted smoothed vertex normals. They were shading defects rather than missing Highway403 road geometry. All 30 editable context exports, and their public/model copies, were corrected by reversing downward surface triangles, removing collapsed projected-area triangles and recomputing normals. Exact vertex coordinates were verified before and after export.

The complete path/hash record is `work/revamp/landscape/context-normal-repair.json`. The same-camera proof `work/revamp/landscape/downtown-junction-normal-repair-proof.png` shows the marks gone. It was rendered at 1920 × 1200 with 24 samples; it is a diagnostic preview, not a replacement final picture. The original saved before scene was opened read-only and never saved.

A packed scene still contains its old surface data until reloaded or repaired. `work/revamp/landscape/repair_blender_context_normals.py` supplies `repair_context_normals()` for a new checkpoint scene. It retains coordinates and explicitly sets stable area-weighted normals. Do not apply it by overwriting the saved before checkpoint.

## Editable-scene recoverability

All 15 copied original `.blend` scenes were loaded headlessly with automatic script execution disabled. None was saved, and all 15 before/after SHA256 hashes matched. No required external asset was missing; no file-backed image was left unpacked. Five scenes contain 32 packed images each, Dixie/Applewood contains 14, and the other nine rely on generated images/materials with no external image file dependency. The full report is `work/revamp/landscape/blender-recoverability-audit.json`.

## Credits

City geometry and derived landscape data: **City of Mississauga**, under the accompanying [City Open Data Terms of Use](../../../research/City-of-Mississauga-Open-Data-Terms.pdf). Keep those terms or their source link with redistributed data. The City’s map is a cited planning reference; its original artwork is not bundled in this public overlay folder. No endorsement is implied.

Terrain: **Contains information licensed under the Open Government Licence – Ontario.** [Licence](https://www.ontario.ca/page/open-government-licence-ontario).

The alignment used to exclude older source geometry follows OpenStreetMap data: **© OpenStreetMap contributors, ODbL 1.0.** [Copyright and attribution](https://www.openstreetmap.org/copyright). No data from unsuccessful new Overpass landscape requests was used.

This addition does not claim photographic realism, complete current landscape coverage, surveyed materials or precise tree dimensions.
