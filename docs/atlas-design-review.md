# Future Mississauga design

## Design decisions

The homepage opens with the Downtown print and four direct ways into the work. Keep the surrounding sections short. A reader can explore their neighbourhood, open an individual building, watch the skyline film and read the atlas directly from the homepage.

Use the oblique Square One camera, with light ground, legible grey towers and distinct planning colours. The inset title, author, legend, compass and attribution belong in the print. For a before-and-after view, keep the camera and framing identical.

Align page titles, navigation, previews and captions to the same outer margins. Use a subtle rounded grey rectangle for the current section and neighbouring options. Keep text accents neutral. Give internal links a right arrow, external destinations an up-right arrow and downloads a down arrow where a directional cue is helpful.

Show the entire collection when a visitor enters Buildings, Gallery or the accuracy register. Load images as they approach the screen. Buildings are detailed studies, grouped by area and project, with a consistent thumbnail grid. A profile names the contributors, links to Google and Apple Maps, and credits any photograph shown on the page. Preserve the selected place, scenario and filters when the reader returns.

## Page details

Start with the visitor’s question. The homepage heading is “What’s being built in Mississauga?” Give each destination one clear preview and a direct link. The full directory lives one click away. In a building profile, identify the building, designer and developer, show the real site with its photograph credit, and give map links. Keep each research qualification beside the building or drawing it concerns.

Use the shared page margins and heading spacing from `atlas-edition.css`. Buildings, Exterior studies and Model revisions share a title baseline. Related controls share one height and equal padding. A selected link sits in a rounded grey rectangle. Moving between sections slides the selection into place. Respect reduced motion. Keep a visible keyboard focus ring, and give links a grey hover surface without underlining. Place the footer at the lower edge of a short page and after the content on a long page.

Use a short place name and scenario under a gallery picture. Put full model licences in Sources and keep required notices with the published image. Give each signed downloadable the inset author line. Reserve clean, unlabelled scenes for side-by-side comparisons. Keep neutral grey towers distinct from light ground. Apply lifecycle colours only to evidenced buildings and preserve architectural detail at podium level. Avoid touch gestures that interfere with scrolling the page.

Build print pages from freshly rendered, native-size scenes. Measure resolution at the final printed size. Include linked contents, page numbers, selectable text and a readable source index. Generating a new thumbnail from an old print does not count as re-rendering a view.

## Checks for each release

| Journey | Expected result |
| --- | --- |
| Open the homepage on a phone or laptop | The opening identifies the project and provides direct entries to its major collections. |
| Switch the Downtown cover | The picture, credited PNG and print PDF match the selected scenario. |
| Choose Lakeview in Compare and open its neighbourhood | The destination is Lakeview. Back restores the selected comparison. |
| Browse Buildings | Every detailed study is visible without expansion. A return from a profile restores its filter. |
| Open a gallery picture | The byline stays with the artwork. Keyboard navigation, swipe and outside-click dismissal work. |
| Open the atlas, zoom and follow a contents link | The detailed reader and download show the same numbered page. |
| Switch chapters in the skyline film | Each labelled stage starts at its designated time. The stages share a camera. |
| Open the downloaded Mac edition | Styles, navigation, model and print files work from the local folder. |

The site was opened on desktop and phone layouts. Browser checks included all twenty neighbourhoods, both galleries, all building profiles, the map, the skyline film and the atlas. The complete Mac edition opens through `outputs/Future-Mississauga.html` in the project workspace, using the accompanying `Future-Mississauga` folder.

The November 20 edition provides a measured reference for future exports. Its 71 native Blender views include two homepage covers. The Downtown comparison uses the same 22.81° downward angle in each stage. Across the 56-page atlas, model images measure 309–330 pixels per printed inch. The eleven four-page building booklets measure 365 and the two Downtown prints measure 384. The reader offers 1,200-pixel page images and 2,880-pixel zoom images. Check those figures at the final placed size when a new edition changes the layout.

## Evidence still needed

The fourth Greenpark tower's footprint and height pairing, exact Voya roof details, Port Credit bridge drawings and LRT turnout alignment depend on further source evidence. Keep these qualifications with their individual records.
