# Mississauga transit revision

This package adds the existing Milton, Lakeshore West and Kitchener GO corridors and the existing Mississauga Transitway, and replaces the disconnected Hurontario LRT display with a connected network. The initial sources were checked on September 20, 2026. The September 21 Transit Depth review rechecked official HML routing evidence and corrected route depth in the separately backed-up edition.

The network includes 37 station locators: nine GO stations, all 12 Transitway stations and the 16 Hazel McCallion Line stations inside Mississauga. The three northern HML stops in Brampton remain outside this city model. Station markers locate stops; they are not architectural station models. City Centre and North Service carry explicit approximate-location notes.

## Layers and modes

| Layer category | Existing | Construction | Future | Appearance |
|---|---|---|---|---|
| GO | Yes | Yes | Yes | Green service lines, restrained grey railway detail |
| Transitway | Yes | Yes | Yes | One blue guide; labels distinguish dedicated and street/highway stretches |
| HML | No | Yes | Yes | Gold route guide with separate grey physical track display |
| SchematicVehicle, retained from the previous edition | No | No | Optional | Illustrative future LRV; no operating-service claim |

`transit-network.json` contains connected route polylines, station labels and positions, named city-boundary exits, mode information, provenance, and the City Centre junction focus. `transit-layer-manifest.json` lists all full-city and district GLBs, exact hashes, dimensions, source links and limitations. District assets are clipped at the actual view extents; unrelated vertices are never joined across a clipped-out area.

The legacy broad HML gold lines and old `LRT` track components must be disabled when this replacement is used. Existing street markings, bus shelters and source-derived existing bridges remain valid. The two previous mapped platform polygons may be retained. Do not place a second broad tube over every detailed HML track. Use the three full-city assets for composed render cameras. Ordinary interactive district assets are clipped to their browsing windows; the citywide browsing assets cover the complete municipal network. Never stack the full-city and district versions.

## What was corrected

The earlier builder deliberately omitted every elevated or below-grade HML segment. It also accepted a partially mapped second track as independent line pieces. That combination left the Highway 403 / City Centre junction disconnected and created apparent mid-route ends. The replacement preserves the mapped first-track network, reconciles the mapped portions of the second track, and supplies disclosed schematic counterparts where mapping is incomplete. The north, south and City Centre arms now join, and the maintenance spur is connected.

The renderer's earlier surviving-vertex clipping could also connect points across a section outside the view. The replacement is delivered as connected polylines and district meshes clipped by segment/triangle intersection. Every endpoint is classified: 14 municipal-boundary exits, four Transitway terminal endpoints, 24 connected route/track junctions, two Port Credit terminal track ends and two City Centre terminal track ends. No unexplained internal endpoint remains in this network.

The close-up render also exposed coplanar overlapping track-bed polygons at the wye. Their footprints are now combined into one bed surface; the black intersection artifacts are removed.

## Accuracy and limits

GO service membership and station points come from Metrolinx's official GTFS feed version `20260917132342`. Physical railway detail uses City of Mississauga photogrammetric `Railway` lines from 2024 imagery; 232 components within the three GO corridors are included. The service line does not assert which individual track each train uses. The grey track display does not invent GO expansion tracks or classify freight sidings as scheduled GO service.

The Transitway follows both directions of current MiWay route 109 between Winston Churchill and Renforth. City `OPEN` StreetCentreline features identify its physical busway stretches. The Erin Mills–City Centre section includes the existing Highway 403 and street connection. It is not portrayed as an uninterrupted dedicated busway, and it is existing in every scenario. Future downtown transitway and HML loop works are not silently substituted for the current service arrangement.

HML's core 18 km / 19-stop project is under construction. The City Centre spur is distinct from the downtown extension, which Metrolinx still describes as planning and design. Public sources establish the flyover layout and ongoing construction but do not supply current engineering coordinates for every switch or a surveyed vertical profile. The second-track gaps, counterpart wye connector and diamond crossing are schematic. Their geometry is not final turnout CAD.

The Highway 403 guideway is displayed at **165 m above the CGVD2013 datum**, equivalent to model Y = 95 m after the 70 m origin offset. **165 m is an illustrative elevation, not bridge length or a surveyed deck elevation.** The three mapped bridge spans have display envelopes following their paired tracks, with 2 m outer margins from track centres and 1 m structural depth. These dimensions are illustrative. No unverified pier positions are added. Port Credit's below-grade descent is also schematic; its underground physical track may be occluded by the surface in an exterior view. The gold marking now obeys the same normal occlusion; the connected underground path remains in the data.

Bare-earth DTM samples dip below existing bridge decks. The unchanged physical display profiles avoid implausible spikes by applying declared slope limits of 3.5% for GO, 6% for HML and 8% for bus routes. These limits are **visualization constraints, not measured or approved engineering grades**. They raise the display above direct draping by a median of zero; localized bridge/ravine adjustments are itemized in the profile audit. The terrain itself is unchanged. Ontario elevation data combines acquisition dates and is not a September 2026 survey.

## Depth-tested service markings

The current Transit Depth edition uses 3 m wide, unlit markings with ordinary 3D depth. GO stays green, the Transitway blue and HML gold. Buildings, bridge decks, roofs and terrain hide routes behind them. A route hidden by a foreground structure remains continuous in the underlying data.

The markings follow the unchanged route-specific physical display profiles with small local clearance. Surfaces more than 0.65 m above that local reference are not used to lift a lower route onto a bridge or roof. This window and the marking width are display choices, not engineering dimensions. The 403 flyover retains its disclosed schematic deck; the Port Credit approach retains its below-grade physical profile. No horizontal reroute was made without evidence.

Guide meshes retain `geometryRole: service-guide`, uniform `COLOR_0`, `semanticColour` and `KHR_materials_unlit`. Use `toneMapped=false`, `depthTest=true`, `depthWrite=true` and `renderOrder=0`. Keep guides in the same scene as the rest of the city. Do not reintroduce a foreground compositing pass. [Current depth review](../../../research/transit-depth/Transit-depth-review.md).

## Validation

All 28 delivered GLBs were reopened and checked for finite geometry. The network has no self-intersecting route polylines and no unexplained internal endpoints. All station locators are within 50 m of their corresponding displayed corridor, with additional uncertainty notes for the two inferred station locators. Shared-node elevation constraints preserve connected heights across split route pieces. The final close-up Blender image was inspected after correcting the wye track-bed overlap.

The current geometry correction checks all 28 assets and preserves all 810 physical mesh position/face checks, plus guide horizontal coordinates, faces and colours. The 25 active compressed website assets preserve their decoded triangles and colours; all 74 guide instances retain the new depth metadata and constant system colours. See the [current geometry proof](../../../research/transit-depth/Geometry-depth-correction.json) and [website audit](../../../research/transit-depth/Public-transit-guide-and-reference-audit.json). The staged views and full final picture checks are separate from source-coordinate validation.

The 509,181-sample zero-contact audit in `visibility-audit.json`, the earlier `transit-qa.json` file hashes, and `district-colour-repair-audit.json` describe prior editions. They are retained as history and do not certify the current depth geometry. Normal underpass and building occlusion is now required, so zero occlusion is no longer an acceptance criterion.

See `transit-qa.json`, `endpoint-station-audit.json`, `vertical-profile-audit.json`, `transit-sources.json` and `research-log.json`. The source list contains 20 linked source entries, and the research log records 68 actual source operations, including failed or rejected/historical sources where applicable. An operation count is not a count of independent confirmations.

## Attribution

© City of Mississauga. City data is used subject to the City's open-data terms. © OpenStreetMap contributors; OpenStreetMap data is available under the Open Database License. Contains information licensed under the Open Government Licence – Ontario.

Data used in this product or service is provided with the permission of Metrolinx. Metrolinx makes no representations or warranties of any kind, express or implied, with respect to the Data and assumes no responsibility for the accuracy or currency of the data used in this product or service.
