# Future Mississauga design

Daniel chose Linear as the visual reference. Use a quiet header, clear type, and consistent controls. Keep the original Mississauga renders, source credits, and model evidence. A selected building or skyline scenario should stay selected when the visitor moves between views.

The city model is the main image. For Downtown, use an oblique camera that shows Square One, the roads, and the space between buildings. Match the camera when comparing scenarios. Preserve the city plate’s original light, frame, inset legend, author, compass and source credit. Keep the picture date with its source record. Align the header, titles, media, captions and downloads to the same margins. Mark the selected section with a quiet filled rectangle. Daniel prefers neutral text accents and controls without glow. Use the original drawing, photograph, model or a clearly labelled location for building thumbnails.

## Private review, 20 November 2026

For the complete offline edition, open `outputs/Future-Mississauga.html` from Finder. This Mac opener points to the complete edition in the adjoining `Future-Mississauga` folder. Developers can also run `npm run dev` from the checkout.

| Try this | Expected result |
| --- | --- |
| Switch among Today, Construction and Proposed in the Before & after skyline view | The skyline, status key, download and map destination follow the selected scenario. |
| Open and zoom a skyline image | Fit restores the whole image. Back closes the viewer and Forward opens the same picture. |
| Search Buildings for M City, then open M City M1 and M2 | The study opens the M City model. Its map link points to the same project. Returning to the directory restores the filters. |
| Open a named reference study and select another | Back returns to the previous study. An unavailable study link displays a message and a chooser. |
| Select a researched building in the city map | Wide screens place details beside the canvas. Small screens show the panel below it. |

Automated checks cover the site, model startup, mobile camera math, building and gallery routes, full-size images, and credited downloads. DOM interaction checks exercised the three skyline states, links, zoom, fit, Back, Forward, focus return, directory search and invalid study links. The local preview server could not accept a browser connection during this review. Desktop and phone visual checks and real WebGL interaction remain open.

The skyline stage comparison uses the three reviewed 9 November aerials. The home page and the two-way Square One comparison use the earlier 23 October pictures Daniel identified as his reference. Keep the ground and small buildings pale. Give plain existing towers a slight grey separation and retain authored façades and planning colours. On 20 November, the full-resolution masters received a median seven-level sRGB adjustment on existing tower pixels. Pixels outside the visible tower masks and the credit strips matched the reviewed originals exactly. The masks, source hashes and per-scenario evidence are in `model-assets/downtown-tower-tone/`. The full-screen image displays the scene portion. The more recent gallery, skyline film and map geometry have their own records. The interactive Downtown view opens diagonally across the grid, and the other neighbourhoods retain their original bearings.

## Local city atlas edition, 20 November 2026

The main sections and individual building profiles open as local HTML pages. The home page explains the model in one sentence and features the native 8:5 Square One plate. The gallery, comparisons and film each have their own page. The skyline film keeps its native aspect ratio and video controls. The map camera opens at the compass bearing of the Square One plate.

Buildings is a curated collection of detailed architectural models. City massing, plain project blocks and place locators belong in the 3D map. Adding a named project to the map does not put it in the Buildings directory. A featured building opens its own page with the actual address, a sourced project team, model views, real-world photography, Google Maps and Apple Maps. Credit the photographer and distinguish completed buildings from images of a construction site or an earlier house. The city record and original study deep links remain accessible.

File-mode checks exercised the gallery, horizontal swipe, backdrop dismissal, comparison states, project links, menus and PDF paging. Local HTML links and fragments resolved. The source-model loader decoded the Downtown scene. Computed styles were checked at 320, 390, 768, 1024 and 1440 pixels. Live browser painting and GPU frame rate were unavailable for this review.

Across the 107 recorded road-crossing profiles, 12,477 surface samples found a road deck within the model tolerance. Unrecorded crossings and historical images were outside that measurement.

For a later model review, identify the tower by the park on Rathburn Road behind M City and check the blue podium against reference material before revising its finish.

## Earlier items still open

- The production build requires public delivery receipts for 144 current image files. The release map contains 60. The other 84 are the 14 Downtown pictures in six formats or sizes each. All 144 local files matched the owner manifests. The existing skyline film is included.
- The final citywide atlas, remaining neighbourhood captures, and waterfront render review are still in progress in the media work. The newer island and mainland geometry has supporting work and still needs visual acceptance before adoption.
- The exact Greenpark fourth-tower footprint and height pairing, Voya roof details, Port Credit bridge drawings, and LRT turnout alignment remain qualified in the model. Those require source evidence.
- The live website continues to use the earlier release. Its owner controls publication.
