# Future Mississauga: Transit Revamp model guide

Prepared for Daniel Sultan. Research reviewed on **September 20, 2026**. This is the separate Transit Revamp edition; the preceding complete edition and original source archive remain preserved.

This package provides a City-derived three-dimensional context model and a separately researched record of development proposals. Its strongest feature is traceability: a source mesh, planning decision and current project record can be checked independently. It is a visualization of available evidence, not a promise that every proposal will be built or a complete architectural reconstruction of the future city.

## What is in the model

The original city-wide conversion contains **30 tiles and 153,021 source components**, comprising 152,256 components marked Existing, 738 marked Proposed and 27 marked Under Construction. These are **components, not distinct buildings or projects**. A podium, tower, townhouse block or separate roof volume can be a different record. The converter omitted 276 records marked Demolished. Its manifest reports 8,884,086 triangles and no failed records. These counts describe the converted source archive; they do not establish that every source status or surface is correct.

Ten initial district extracts cover Downtown, Port Credit, Lakeview, Clarkson, Cooksville, Uptown & Hurontario, Erin Mills, Streetsville, Meadowvale & Lisgar, and Malton. The manifest has now expanded that baseline with Dixie & Applewood, Erindale & Sheridan, Airport & Corporate, Heartland & Gateway, and an All Mississauga overview: fifteen presentation views in total. Extracts use overlapping rectangular viewing windows, not official neighbourhood boundaries. Their component totals must not be added together to calculate a city total.

The composed All Mississauga picture uses the full reviewed thirty-tile building geometry, including low-rise context. The interactive All Mississauga performance overview is a different assembly: it selects taller existing components and development geometry. Other interactive districts retain their local low-rise context. Composed pictures can extend surrounding context beyond the interactive viewing windows. Neither an extract's component count nor the source status field establishes current completeness or accuracy.

The City describes its existing-building product as LOD2, with roof information derived from LiDAR. Proposed buildings can instead be LOD1 massing. The same file can therefore contain different levels of detail. [City 3D model portal](https://data.mississauga.ca/pages/mississauga-3d), [current scene metadata](https://www.arcgis.com/home/item.html?id=1c60543e3f1c4ccd8418b1a218cfedbf).

## Use the right version

| Material | What it represents | How to use it |
|---|---|---|
| Original tile GLBs and companion JSON in `models/` | Converted municipal source snapshot | Preserve for reference, source inspection and reproducing the original extraction. These keep source status and outdated forms. |
| Original district GLBs in `models/districts/` | Local extracts from the original conversion | Reference extracts, before all review exclusions. Overlapping districts can repeat geometry. |
| Reviewed GLBs in `models/reconciled/` and its `districts/` folder | Municipal geometry with documented exclusions and status corrections | Recommended standalone municipal massing exports. These carry the current reviewed corrections; read the companion JSON and manifest. Context and detailed supplements remain separate. |
| Native, traced and schematic GLBs in `models/supplemental/` | Exchange source detail, dated building refinements, recorded construction and mapped context details | Add according to each asset’s mode and replacement metadata. Preserve uncertainty labels and material exceptions. |
| Blender scenes in `scenes/` | Composed views containing building, terrain, landscape, transit, materials, camera and lighting | Open in Blender to adjust a picture. Textures are packed when the scenes are saved; scenes represent the assembled presentation rather than only the building GLB. |
| Pictures in `renders/` and the interactive website in `mississauga-future/` | Ready-to-view presentation and exploration | The website assembles layers at runtime. Its full appearance is not contained in one downloaded district building file. |
| Project inventory | Researched names, stages, dates, height conventions, evidence and caveats | Read this before interpreting an individual proposal. |
| Geometry overrides | Decisions about identified source components | Exclude demonstrated superseded geometry; flag unresolved mismatches; update stale construction status. |
| Context and transit layers | Roads, parks, water and transit display | Use for orientation. Some vertical placement is inferred for presentation. |

The untouched municipal source archive is provenance-only and is not the recommended current city model. The main reviewed-model archive and interactive downloads use the repaired/reconciled geometry. The full source archive intentionally preserves geometry that the current research identifies as outdated. A standalone source GLB is therefore not equivalent to a completely reconciled future scenario. The project record can remain in the inventory even when its obsolete mesh is excluded. Where a current footprint is unavailable, a labelled project entry records the proposal without claiming an exact building shape.

## Pictures, comparisons and editable scenes

The picture collection uses original lossless PNGs in `renders/`, including district and overview aerials, matched skyline stages, closer perspectives and revision close-ups. The website downloads the original PNG masters. The picture index identifies the packaged files and dimensions; the atlas manifest identifies which images a particular PDF contains. The PDF may embed smaller JPEG streams for portability without changing the PNG masters. A checkpoint picture is identified separately from a final scenario render.

The aerial pairs use the same camera, framing and context. The Downtown panorama progresses from existing context to **recorded construction** and the illustrated future. Recorded construction uses dated evidence: M3’s topped structure and approximate crown, Voya’s topped silhouettes, M4 clipped at the reported level-41 slab, and the sourced topped Exchange phases. M5’s full proxy and EX3’s unmeasured height are omitted from that stage. Future views may show their full source or planned envelopes. This is a comparison of model layers, not a prediction that everything completes together. Completed-status corrections retain older geometry where no reliable replacement exists, so the existing view is not a September 2026 photographic reconstruction.

The Blender scene files preserve the assembled presentation views with camera, lighting, materials, building geometry and context. The retained original scene set was opened without saving and checked for recoverability; all hashes matched and no required external assets were missing. Textures are packed. They are broader scene assemblies than the standalone reviewed building GLBs. A picture made from a scene can include a supplemental asset or expanded context that is deliberately supplied as a separate file in the model exports.

The distribution archives are `Future-Mississauga-Pictures.zip`, `Future-Mississauga-Reviewed-Models.zip`, `Future-Mississauga-Editable-Scenes.zip` and `Future-Mississauga-Public-Research.zip`. The original municipal conversion remains separately available in `models/`; it must not be mistaken for the reviewed model export. The public research collection excludes the private correspondence review. Preserve the included metadata and licence notices when sharing any archive.

**Violet geometry marks unresolved source versions or explicitly uncertain new reconstructions. It is visible by default in the illustrated future scenario.** Each asset retains its reason: an unresolved current design, a phase mismatch, approximate marketing-plan registration or an unverified developer proxy. These are different limitations and must be read from the record. Visibility does not mean verification. Demonstrably superseded geometry is excluded from the reviewed scenario and remains in the original archive. A violet envelope must not silently become an approved current design.

## Status colours

| Colour | Meaning |
|---|---|
| Cool grey | Existing context, including documented completed-status corrections. The shape may still be an older partial capture. |
| Blue | Construction-stage development. Recorded-construction mode uses dated supported progress; future mode can show a sourced planned envelope. |
| Terracotta | Retained proposed development. It does not guarantee approval, start or completion. |
| Violet | Unresolved source versions or explicitly uncertain supplemental geometry, visible by default. Read each record’s specific limit. |
| Gold transit | Hazel McCallion Line cartographic guide; physical tracks, inferred counterpart geometry and display profiles are separately disclosed. |
| Green transit | Existing GO service corridors; grey individual track detail comes from City mapping. |
| Blue transit | Existing Transitway service, including dedicated busway and its current street/highway connection. Segment labels retain that distinction. |

Exchange keeps its native texture colours, so it is an exception to the plain status palette. Its phase classification must be read from the record rather than its facade colour. Shades also differ between the web display and rendered lighting.

## Dates and currentness

Three dates need to remain distinct:

1. **Acquisition date:** the current City scene describes LiDAR acquired in 2024. The broader web scene also refers to 2021 material.
2. **Source publication or revision date:** the saved current scene item was modified June 22, 2026. The tile index, web scene and Tile 63 item show February 2, 2026 metadata modifications. An item timestamp does not prove that every feature was surveyed or revised that day.
3. **Research review date:** September 20, 2026. This is when the evidence was checked for this package, not the date all buildings were measured.

Individual projects retain their own drawing, approval and construction-report dates. A newer webpage can still summarize an older proposal; revision-dated drawings and adopted decisions take precedence over stale overview copy. [Tile index](https://www.arcgis.com/home/item.html?id=31010f1289214539b9d175be3ea9694f), [web scene](https://www.arcgis.com/home/item.html?id=6460ae262aad4bf4ba493f5b048d51bb).

## Research method

The research separates **project existence**, **planning status**, **current design** and **available geometry**. Evidence supporting one does not automatically establish the others.

The principal sources are municipal application records and revision-dated drawings; adopted bylaws and Ontario Land Tribunal decisions; provincial and transit-agency documents; and developer or contractor construction updates. UrbanToronto and other reporting provide additional checks and help locate revisions. Forum titles, sales pages and old renderings are not treated as definitive when a later primary source disagrees.

For a major project, the review looks for multiple sources, reconciles the address and municipal file number, checks the newest identifiable revision, and records unresolved differences. A submission is not an approval; an approval is not a construction start; an interim tribunal order can have outstanding conditions. Older proposals stay in scope unless superseded or officially cancelled. Financial restructuring, a withdrawn sales campaign or a builder licence issue alone does not prove cancellation.

The project inventory also distinguishes `actualCompletionDate` from `targetCompletionDate`. An actual date names its milestone, such as first occupancy, registration or public opening; a forecast is labelled as a forecast. Topping off is not completion. Reclassifying Mason’s source component as completed updates its status only: any partial captured shape is retained without stretching it into a guessed finished building. When evidence supports only a year, quarter or season, the record preserves that precision rather than assigning a day. Null means a verified date was not found. The waterfront audit, for example, separates Mason’s 2025 occupancy/closings, Harbourwalk’s Summer 2028 forecast, Bridge House’s revised 2030 forecast and Jim Tovey’s May 30, 2026 public opening.

Each research log records actual operations. A search query, opened page, PDF attempt and screenshot attempt are different events; their combined count is not a count of unique sources. Failed access is recorded as a limitation. No claim is made that every search result, every profile post or every planning document was read.

Examples of changes caught during reconciliation include 70 Park Street East moving to a 33-storey settlement, 170 Lakeshore Road East changing from a tower to a twelve-storey slab, and 900 Lakeshore Road West being reduced to nine storeys. The corrected project remains relevant even when the older source mesh is unsuitable. [City October 2025 report](https://pub-mississauga.escribemeetings.com/filestream.ashx?DocumentId=78584), [170 Lakeshore tribunal order](https://www.omb.gov.on.ca/e-decisions/OLT-22-004584-FEB-24-2025.PDF), [900 Lakeshore current application](https://www.mississauga.ca/services-and-programs/planning-and-development/development-applications/active-development-applications/900-lakeshore-road-west-oz-opa-25-8-w2/).

## Coordinates and scale

The model uses metres. The downloaded multipatch horizontal coordinates were transformed from Web Mercator, **EPSG:3857**, to **NAD83 / UTM zone 17N, EPSG:26917**. Source vertical values were retained; no separate vertical-datum conversion was applied.

The GLB uses a local origin and a Y-up convention:

```text
GLB x = UTM easting  − 615000
GLB y = source Z     − 70
GLB z = 4827000      − UTM northing
```

The inverse is:

```text
UTM easting  = GLB x + 615000
source Z     = GLB y + 70
UTM northing = 4827000 − GLB z
```

Positive X is east, positive Y is up, and positive Z is south. The 70-metre vertical offset makes coordinates more convenient; it is not a surveyed ground level or a replacement vertical datum. When combining files, preserve this origin and the metre scale. Do not recenter each tile independently.

The conversion triangulates municipal surface rings, retains their positions and drops degenerate triangles. It does not invent facades or turn the model into architectural BIM. Existing geometry is combined by tile for rendering efficiency; companion JSON retains component identifiers and metadata. Proposed components retain identifiers such as `92-4844`, meaning tile 92 and source record index 4844.

## Heights need a stated convention

A storey count is not a metric height. No universal floor-height multiplier was applied. Mezzanines, amenity levels and mechanical enclosures can also explain apparently conflicting counts.

The City’s `Bldg_Hght` attribute can describe one portion of a building. Neither that value nor the model’s maximum vertical coordinate should automatically be called the overall height above grade. Compare the architectural established-grade datum, main roof and mechanical roof explicitly. For example, the latest 900 Lakeshore drawing labels a 29.2 m building-height dimension and a separate 3.5 m mechanical enclosure. [March 2026 elevation](https://www.mississauga.ca/wp-content/uploads/2025/09/26112747/Elevation-Plan-East-OZ-OPA-25-8-W2-March-2026.pdf).

## Ground, landscape and transit

Building surfaces come from the municipal multipatches. Road, wooded-area, water and park outlines come from City planimetric and park boundary layers. Ground elevations now come from the **Ontario LiDAR-derived Digital Terrain Model**, exported as a 10 m floating-point raster in EPSG:26917 with bilinear resampling. Its vertical reference is CGVD2013 (service VCS EPSG:6647). The exported mosaic combines acquisition projects: a checked location returned 2015 primary data and 2023 overview records. September 20, 2026 is the retrieval date, not a new terrain survey. [Ontario DTM service](https://ws.geoservices.lrc.gov.on.ca/arcgis5/rest/services/Elevation/Ontario_DTM_LidarDerived/ImageServer), [Ontario dataset catalogue](https://data.ontario.ca/en/dataset/ontario-digital-terrain-model-lidar-derived).

Inland water surfaces were corrected after a low-angle review found that the earlier builder had placed every mapped `Shoreline` polygon at Lake Ontario’s elevation. The repair groups 420 City source polygons into 398 connected waterbodies and estimates a level inland surface from the median of DTM samples along each full waterbody’s exterior boundary. Eight directly connected Lake Ontario polygons retain the illustrative 75 m ASL datum. All mapped horizontal coordinates and triangle indices remain unchanged. These are display estimates from a mixed-date, 10 m terrain raster, **not surveyed water levels**; small basins, steep banks and seasonal changes have greater uncertainty. The widest checked boundary elevation range is about 7.4 m on a small 608 m² source polygon. A Heartland outline has one pre-existing 1.083 m simplification discrepancy; its full footprint has a 99.0085% overlap with the sole intersecting source water polygon, so its horizontal outline was preserved. River surfaces were not flattened by this repair. [Water repair, sources and exact file hashes](revamp/Inland-water-elevation-repair.json).

The context builder subdivides horizontal polygons before draping them over the DTM. **Road footprints retain the actual unsimplified City polygons and are cut out of competing terrain and green surfaces.** This prevents the earlier independently triangulated terrain from covering highways and ramps. Checks at 25,000 road points in each of Downtown, Uptown and Port Credit found zero covered points after the correction. Seventeen accepted bridge spans use mixed-date Ontario surface-data fits; this is limited coverage, not a survey of every overpass. Ground uses GLB Y = DTM elevation − 70, with the documented building-base fallback where terrain data is unavailable. Building vertices remain unchanged. City building bases versus the DTM had a median difference of +0.20 m, with tenth and ninetieth percentiles −0.46 m and +0.41 m; no alignment shift was applied. These checks show internal consistency, not certified survey accuracy. Display offsets and unmeasured retaining walls, flood levels and platform heights remain approximate.

The landscape contains two different kinds of tree placement. **Public-tree inventory instances retain actual municipal point coordinates**: the prepared extract holds 270,911 active, non-private City records, with relevant records selected for each view. Its item was updated June 30, 2026. The drawn heights and crown diameters are illustrative; ground placement follows the DTM display with the documented fallback. [City tree inventory service](https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2023_City_Owned_Tree_Inventory/FeatureServer/0).

**Additional woodland canopy instances are illustrative points placed inside City-mapped wooded-area polygons.** Their individual positions, sizes and species are not surveyed tree records. A reproducible 10 m placement grid with small positional variation depicts woodland coverage, avoiding nearby inventory points. The prepared citywide context contains 229,032 such additional instances; district views overlap, so their counts must not be summed. Per-view data identifies inventory and illustrative counts separately. A mapped wooded polygon supports the presence of woodland cover, not the exact position or number of its drawn trees.

Waterfront land needs special care. The municipal boundary predates the completed Jim Tovey reclamation. The reviewed City park layer has no Jim Tovey outline. A CVC layer titled ELC 2026 contains local polygons mapped from 2023 imagery; its broad construction polygon is not the finished 26-hectare park. A current park or shoreline survey was not recovered during this review. Do not infer new land from the park’s area or treat an old jurisdiction boundary as a current shoreline. Lakeview picture captions must flag that the completed Jim Tovey reclamation outline is not fully verified in the terrain model. This uncertainty can affect visible land/water edges, even though the park’s public opening is confirmed.

The Transit Revamp edition includes the **existing Milton, Lakeshore West and Kitchener GO corridors** and the **existing Mississauga Transitway** in every scenario. GO route membership and nine station points follow Metrolinx’s September 17, 2026 GTFS. City 2024 photogrammetric Railway lines supply physical track detail. Both current MiWay route 109 directions serve the Transitway’s 12 stations. Its Erin Mills–City Centre link includes Highway 403 and street running; it is not shown as uninterrupted dedicated busway. [GO data](https://www.gotransit.com/en/partner-with-us/software-developers), [MiWay data](https://www.mississauga.ca/miway-transit/developer-download/).

The **HML core network appears in construction and future modes**. Its north, south and City Centre arms now join; the mapped first track is retained and incomplete second-track mapping is reconciled with disclosed schematic counterparts. Mapped maintenance access connects to the core and is distinguished from passenger service. Route ends have a purpose: station terminal, connected junction or labelled municipal-boundary exit. Segment clipping preserves connected paths instead of joining unrelated surviving points. The close-up wye bed is one joined surface to prevent overlapping-ribbon artifacts. [Transit manifest](../models/supplemental/transit-revamp/transit-layer-manifest.json), [route, station and exit data](../models/supplemental/transit-revamp/transit-network.json).

**The new flyover is represented, but its engineering profile is not verified.** The displayed Highway 403 junction deck is at 165 m above CGVD2013, or model Y = 95 m; 165 m is an illustrative elevation, not bridge length or a measured deck level. Three mapped bridge spans receive restrained guideway envelopes with illustrative margins and depth. Exact pier positions, switch geometry and the missing counterpart connector are not established by public engineering drawings. The inferred wye crossing, track spacing where absent from mapping and Port Credit descent remain schematic. This must not be presented as an as-built track model.

The coloured routes are **cartographic annotations**: GO stays green, the Transitway blue and HML gold. The dedicated busway and its current street/highway connection use the same blue, with their meaning retained in segment labels. The 3 m guide strips have uniform unlit colours and are separate from grey physical tracks. Their horizontal paths are unchanged. A separately disclosed upper display profile and an 8% visualization slope cap keep the guides clear of checked ground, road, bridge and platform surfaces. Original physical profiles retain their earlier 3.5% GO, 6% HML and 8% bus display caps. Neither set of values is measured engineering.

The surface audit checks the actual guide centres and both edges at no more than 1 m spacing: 509,181 samples, including 508,179 with an overlapping context surface, and no remaining surface-contact risks. The audit covers 77 source files. The browser and rendered pictures treat the guide as a cartographic overlay, so it may draw across a foreground building in an oblique view. This does not imply a railway above a roof or a changed geographic alignment. Physical rails retain normal depth and remain below ground where the schematic profile is below grade. Composed pictures use full municipal transit assets; ordinary district windows label continuations at their clip boundaries. [Visibility correction and matching tests](revamp/transit-visibility/Visibility-audit.md), [current transit manifest](../models/supplemental/transit-revamp/transit-layer-manifest.json).

The station layer has nine GO, 12 Transitway and 16 HML locators inside Mississauga. City Centre and North Service are approximate corridor locators with explicit uncertainty; none of these points is a newly verified station footprint. The two earlier mapped HML platform polygons at Derry and Courtneypark and the separately labelled future LRVs may be retained, with their original schematic canopy/vehicle limits. The previous disconnected rail ribbons and broad duplicate gold alignment are replaced, not stacked with the rebuilt tracks. The downtown HML extension remains a separate planning/design project; an invented loop or extension to Brightwater or Lakeview is not drawn. [Metrolinx downtown extension](https://www.metrolinx.com/en/projects-and-programs/hazel-mccallion-line-downtown-mississauga-extension).

Pearson’s supplemental airfield layer uses retrieved OpenStreetMap runway, taxiway and apron geometry, clipped to Mississauga and draped over the Ontario DTM. Seven runway way records represent five runway references, not seven runways. Tagged runway portions use their 60.96 m width; one untagged continuation uses the same display fallback. Untagged taxiways use an illustrative 15 m width. The recovered taxiway and apron portions are incomplete. Small vertical offsets keep the surfaces legible. This is contextual map geometry, not a complete airport or navigation model. The [airfield metadata](../models/supplemental/pearson-airfield-context.json) retains source requests and limitations; the layer carries the same OSM attribution and ODbL terms as the track extract.

## Reading the transformation accurately

For a before-and-future comparison, use the same camera, projection, scale and context. Change only the relevant development layers. Label the research cut-off and whether the view contains municipal source geometry, reviewed current massing, or unresolved proposals. Do not label a scenario with a completion year unless its timing is supported.

The presentation uses composed skyline cameras, real source geometry, restrained materials, water, shadows and landscape context to make the transformation readable. The controlled lighting checkpoint records the original camera and unchanged building geometry, with aerial atmospheric fade disabled; lighting changes can therefore be assessed independently of model changes. These are rendered pictures, not photographs of a predicted future. Lighting is for presentation unless a separately documented sun study supplies the date, time, location, terrain and obstruction assumptions.

The revision checkpoints separate lighting and landscape changes. The [lighting record](../checkpoints/01-lighting/Checkpoint.json) records fixed framing, unchanged geometry and the lighting settings. The [landscape record](../checkpoints/02-landscape/Checkpoint.json) keeps the same camera and documents unchanged building geometry during that step. These are controlled comparisons, not claims that later model corrections were already present in the earlier picture.

The Downtown landscape overlay uses City-mapped sidewalk, playground, sport and field outlines plus the registered 2023 Celebration Square amenities plan. The lawn and central paving are distinguished; ambiguous broad enclosures, invented trail widths and unbuilt refurbishment designs are omitted. Original inventory-tree coordinates remain intact. Conflicting crowns may be reduced or suppressed for display, with separate baseline/future decisions; suppression does not establish that a tree was removed. The expanded crown-conflict audit covers all fifteen district windows using their mapped inventory and illustrative woodland records; it does not establish current tree removal or exact crown dimensions. Detailed sidewalk coverage remains concentrated in Downtown. Small terrain-clearance lifts are display adjustments, not kerb heights. [Landscape source and limits](../models/supplemental/revamp-landscape/READ-ME.md).

The website retains original PNG downloads, direct district/model links, native selection controls, comparison handles and recorded-construction mode. A downloaded building GLB is only one part of that layered assembly; it does not contain the landscape, transit, camera or lighting by itself.

Sourced textures can improve fidelity where they exist. Repeated invented facades, fabricated roof details or generated buildings would suggest evidence that the package does not have, so they are not substituted for missing architecture. Stephen Velasco’s publicly visible work informs camera composition and visual clarity; his artwork and model files have not been copied into the deliverables.

## Detailed and schematic supplements

The supplements have different evidential strength and must retain their labels:

| Supplement | Source and treatment | Limits |
|---|---|---|
| Exchange District | Native City I3S geometry and embedded textures, decoded from nine full-detail public leaf resources. The phase-aware derivative distinguishes completed EXS from EX1/EX2/EX3 and shared podium. Replaces source components `63-6155` and `63-6156` when loaded. | Original extraction: 18 material meshes and 97,896 triangles. The phase-aware split preserves all triangles and UV coordinates without moving vertices; 15,639 triangles are assigned to EXS and 82,257 to construction/shared elements. Classification is based on the sourced EXS footprint, not a separate detailed survey. Texture detail alone does not prove completion. |
| M4 | Schematic envelope traced from published plans, registered to M1/M2/M3, scaled to the architect’s 926 m² typical plate and the published 215.65 m main-roof height. Included by default in illustrated future pictures and the viewer with its schematic label. | The full plate uses the maximum envelope. The shorter 200.7 m crown is documented but its exact footprint is unresolved. Podium steps, balconies and cladding are simplified. Estimated placement uncertainty is ±10 m, contour uncertainty ±2 m and base elevation uncertainty ±2 m; these are working estimates, not survey guarantees. |
| M3 upper envelope | An illustrative interpolation between the developer’s lower typical floor plans and floor 74, added above the unchanged City partial capture. Included by default in illustrated future views with a direct caption. | Its solid section stops at an estimated floor 74 height of about 238 m. The flat cap is not a roof. A separate approximate stepped-crown supplement now completes the illustrative skyline silhouette; it does not supply measured roof geometry. Assumed floor elevations carry estimated ±15 m vertical uncertainty, with ±4 m contour and ±5 m placement uncertainty. It is excluded from a verified as-built view. |

The current [refinement manifest](../data/refinement-models.json), project inventory and [transit manifest](../models/supplemental/transit-revamp/transit-layer-manifest.json) are the authoritative current lists. They record source dates, display modes, replacement controls and specific limitations. Project records, municipal groups, source components, research operations and supplemental assets are different units. An operation is not an independent source, and an asset is not necessarily a whole building. [Refinement notes](Refinement-notes.md) explain the revisions.

The added building models include dated Cooksville GO envelopes, Promenade infill, Square One Block 5 T1, Voya, current Port Credit infill and settlement envelopes, Clarkson GO, Brightwater concept blocks, and Aura townhomes. Their individual drawing, height, registration and geometry limitations remain binding. Cooksville reflects the public 2025 concept because the matching revised 2026 architecture is unavailable. Brightwater concept blocks are explicitly approximate; they are not final architecture.

**Absolute World now uses distinct completed tower forms.** The south tower at 60 Absolute is represented at the published 175.6 m architectural height and 56 floors, with a varying 209° twist; the north tower at 50 Absolute uses 157.9 m, 50 floors and a constant 4° per-storey rotation. Conflicting source tower geometry is removed while the shared municipal podium remains. Intermediate south rotations, registration, floor subdivisions and facade details remain interpreted; the nominal heights do not make the whole model a certified as-built reconstruction. [Absolute correction and primary sources](revamp/Absolute-model-correction.md).

**1315 Bough Beeches uses the March 2026 proposal.** Its dimensioned 13-storey envelope rises 52.0 m above the stated grade, with a 47.8 × 18.1 m typical plate. The survey and existing tower support registration. Podium and screen outlines follow the published plan; screen thickness, material appearance and simplified floor bands are illustrative. The existing building is retained, and the new proposal appears only in the future scenario. [Bough Beeches model and sources](revamp/Bough-Beeches-plan-model.json).

**70 Park Street East uses the 33-storey settlement’s 105.7 m height limit.** The settlement zoning envelope does not establish exact facade architecture. The superseded 38-storey scheme remains excluded.

**M3’s crown is now represented by an approximate stepped silhouette.** It reaches the published 260.29 m maximum, but the intermediate terrace widths, heights and closure are interpreted from July 2026 photography. The estimated profile uncertainty is ±6 m; its inherited contour, placement and join limits still apply. Mechanical cavities, steel frame and complete balcony geometry are omitted. The legacy M3 upper envelope and M4 shells also had their inward triangle winding corrected without moving any vertices or changing their shapes. M3’s lower join remains intentionally open.

**M5 uses a registered developer interaction proxy, future-only.** The native solids support interactive photographic views on the developer’s site; they are not a verified architectural mesh. Its full height and facade are unverified. Voya’s two topped structural silhouettes are plan-derived and schematic, with their published maximum and scale uncertainty disclosed. M4’s recorded-construction derivative uses the dated Spring 2026 slab level rather than showing the full future envelope as current progress. Exchange’s recorded view retains only phases whose topped structures are supported by the dated evidence; EX3 remains an explicit unknown-height gap.

**Aura adds ten uncertain townhome envelopes.** Seven are from the June 2026 plan and three additional highlighted blocks from the currently linked image, whose filename suggests August 2026 without a visible issue stamp. They lie outside all 26 old Lakeview City components. Two City street junctions and four shared roof points support approximate registration. The image scale bar conflicts with City spacing and is not used as survey scale. The envelopes use **13 m estimated height ±3.5 m**, derived from a registered bay width and the developer’s illustrative facade proportions; no exact dimensional height was recovered. Placement and outline tolerances are approximately ±10 m and ±3 m. Roofs, balconies, basements and facade articulation are omitted.

Existing waterfront detail adds **13 closed City pier polygons from 2024 linework and one complete mapped OSM beach polygon**. Horizontal outlines follow their sources; deck thickness, elevations and small DTM offsets are illustrative. This does not reconstruct proposed Cultural Pier upgrades, a future marina, boardwalk or new park furniture. Pier House remains a documented footprint gap. [Lakeview sources and limitations](../models/supplemental/refinement-lakeview/README.md).

Final surface checks remove overlapping internal cap areas from Brightwater’s P/Q concept podiums while retaining their exterior footprints and source height limits. Five existing municipal building records have their exact source triangles separated from combined meshes so replacement visibility can target them correctly; the original vertex positions and baseline geometry are preserved. These corrections improve rendering and layer control without upgrading the underlying architectural evidence. [Surface validation](Brightwater-surface-validation.json), [existing-building replacement validation](Existing-building-replacement-validation.json).

The native Exchange asset uses the same coordinate transform as the source tiles. Its footprint and bounds were checked against the two corresponding municipal multipatches: one component matches within about 0.00022 m in the numerical conversion; the other has a 0.157 m lower source top. These are internal conversion checks, not measurements of accuracy against the real building. [Public City scene service](https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/LOD2_Buildings_Scene/SceneServer/layers/0).

The Exchange phase-aware model is the appropriate assembled-view asset; the unsplit original remains for provenance. EXS is documented as operating, while the other towers retain their dated construction evidence. Shared podium elements are kept with construction. Do not add the old overlapping construction capture `63-6253` to the full reviewed future. A strictly historical municipal baseline and a baseline updated for completed EXS are different scenarios; neither should contain both overlapping versions. The phase-aware JSON records the classification tolerance and phase evidence.

M4’s three-anchor registration has a 0.57 m fitting residual; this does not eliminate uncertainty in the tower offset, printed plan or tracing. [CORE M4 project](https://www.corearchitects.com/project/m4-condominium/), [published CORE elevation](https://urbantoronto.ca/forum/attachments/1590440570442-png.247627/).

M3’s separate 260.29 m height marker represents the published architectural maximum. It is optional reference geometry and is **not shown in the composed skyline pictures**. The marker is not a reconstructed crown. A bounded audit of nearby full-detail City scene resources found no full-height M3 replacement, so the partial municipal capture was not stretched. [Official M3 floor plans](https://mcitycondos.com/assets/img/condominiums/m3/floorplans/M3_2.pdf), [structural designer’s project record](https://andrewfisher.ca/portfolio/m3-at-mcity/), [developer construction updates](https://www.mcitycondos.com/construction.php).

The M3, M4 and other supplemental tolerances are estimates of reconstruction uncertainty. They are not statistical confidence intervals. Their published metric heights and their reconstructed visible geometry should not be treated as equally precise.

## Attribution and terms

The applicable linked document is **City of Mississauga — Terms of Use**, reached from the City massing tile index. The archived four-page copy accompanies this guide as `City-of-Mississauga-Open-Data-Terms.pdf`. The terms permit use, modification and distribution, require the terms to accompany redistributed data by copy or link, and prohibit implying City endorsement. Credit is encouraged. [Item-linked Terms of Use](https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data).

Use this attribution with the models and derived illustrations:

> Building and geographic data: City of Mississauga, used under the City of Mississauga Terms of Use. Data converted, selected and annotated for Future Mississauga. Research reviewed September 20, 2026. Independent visualization; not endorsed by the City of Mississauga.

For the terrain, include **Contains information licensed under the Open Government Licence – Ontario.**, with a link to the [Open Government Licence – Ontario](https://www.ontario.ca/page/open-government-licence-ontario).

For the transit and airfield display, also include: **© OpenStreetMap contributors, ODbL**, with a link to the [OpenStreetMap copyright page](https://www.openstreetmap.org/copyright). Distributed extracted track and airfield data should also link directly to [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Stephen Velasco’s model files and imagery were not incorporated into these municipal-derived GLBs.

The current GO and MiWay service feeds have separate attribution and terms from OSM. Preserve the City terms for MiWay and this Metrolinx notice for the GO data:

> Data used in this product or service is provided with the permission of Metrolinx. Metrolinx makes no representations or warranties of any kind, express or implied, with respect to the Data and assumes no responsibility for the accuracy or currency of the data used in this product or service.

The browser’s supplied Three.js 0.186.0 and meshoptimizer 1.2.0 code is MIT licensed. Full upstream notices accompany the package in `licenses/`, together with a [credits index](../licenses/CREDITS.md). Preserve those notices when copying the website. Blender produces the pictures and editable scenes; the Blender application itself is not part of this package.

The older City website terms URL contains a different three-page copy, including an inconsistent municipality name in its licence paragraph. This package preserves the version linked by the actual data item rather than merging the documents. The source model’s own metadata also describes it as approximate visualization, unsuitable as an authoritative basis for permits, real-estate decisions or legal purposes. This guide does not expand those permissions or accuracy claims.

## Remaining limits

The archive is city-wide and all 181 municipal source groups received inventory and web review. That does not mean every project has complete current geometry. Some approved projects lack downloadable drawings, some municipal massing is superseded, and some Lakeview components remain imperfectly matched to named phases. Exact facade detail, a uniform recent survey date and verified completion dates for every proposal are unavailable.


Lakeview needs a separate completeness warning. The source model contains 26 proposed components associated with four site-plan files; these do not reconstruct the whole village. The 2019 master plan and 2022 massing embedded in a later-uploaded report predate the 2026 townhome revisions. Ten approximate Aura envelopes now supplement that baseline, with explicit placement and estimated-height limits. Pier House and other current blocks still lack complete registered, height-dimensioned geometry. Historical high-rise concepts must not be used to fill those gaps. The companion Lakeview review and refinement manifest identify the usable sources and unresolved blocks.

The inventory, geometry exclusions and source links make these gaps inspectable. A building can enter the illustrated scenario as sourced or traced schematic geometry only with its provenance and unresolved limits visible. A verified current scenario requires its location, footprint, height convention and current design to be established. Unresolved source massing and schematic envelopes must remain distinguishable from that verified subset. The accompanying `Model-reference-index.csv` identifies the original tile and district files for further inspection.
