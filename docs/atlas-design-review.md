# Future Mississauga design guide

These are the design decisions and checks for the site. Each release needs its own results.

## Interface

**Links and selection.** Give hover and current links a soft rounded grey surface. Keep a visible keyboard focus outline. Use a right arrow for navigation, an up-right arrow for an external destination and a down arrow for a file when a cue helps.

**Motion.** Move one grey rectangle between choices in about 180 milliseconds. Preserve scroll position and page geometry. With reduced motion enabled, place it immediately.

**Spacing and type.** Use the shared page gutters and title spacing. Start with 8 px between related details, 16 px within cards, 24 px between cards and 48 px between sections. Reserve two lines for building titles. Compare actual baselines at the same viewport width.

**Icons and menus.** Keep controls at least 44 px high. Give the chevron its own space and centre the menu label vertically. Check native select text, long names, keyboard focus and the narrowest supported screen.

**Surfaces and footer.** Use warm paper tones, charcoal text and grey borders. The compact footer carries the project name and byline and reaches the bottom on short pages. Put attribution inside signed artwork and beside the map. Sources and Contact belong in the header.

## Artwork and print

**Camera and light.** Use the approved oblique Downtown view, looking down about 23°. Lock the camera, lens, crop and light across comparison stages. Check the existing buildings and streets stay in the same place.

**Towers and details.** Use a slightly darker grey for existing towers than for the ground and small buildings. Check the same building in the print, gallery, film and live map. At Exchange, the light façade bands, dark windows and pale shared podium should stay visible.

**Planning colours.** Use grey for existing and completed buildings, blue for construction, pink for proposed and approved projects, and violet for uncertain projects. Keep the exact planning status in the project record. Use the same four swatches on maps, images and print. Use building IDs to check the actual visible surfaces. A correct legend can sit beside a wrongly coloured tower. Sample the shaft in the exported image and compare its tone with the approved view. Preserve genuine glass, concrete podiums and roof finishes.

**What the stages show.** Today shows buildings already in use. Dated construction adds the work visible in dated evidence. A future view may show the full planned shape of a project that has just broken ground. Keep each tower in a mixed development tied to its own evidence.

**Model version.** Check the actual geometry in every affected camera against the current building model. Record the date of the survey separately from the file update. State where a roof, height or façade remains approximate.

**Specific corrections.** Check the podium behind the M towers near Rathburn Road and the upper roof at 1422 Aldo Drive. Verify bridge decks against available drawings and approach grades. At 275 Superior, photographs support the entrance. The roof and other elevations use municipal massing.

**Authorship.** Keep the place name and “by Daniel Sultan” inside every downloadable finished render. An inset footer can also carry a key, compass and required attribution. In comparisons, keep the clean view on screen and link the signed image. Credit outside photographs beside the actual image.

**Every deliverable.** A native render, an exported PDF and an image resized for the web are distinct steps. Track the model, camera, stage, dimensions and source master for each current asset. Keep historical artwork dated. Open each derivative at its final destination.

Build current print pages from native model renders. Target at least 300 pixels per printed inch at final placement. Keep the contents, source index, labels and page numbers readable. A new thumbnail or credit strip alone does not establish a new render.

## Page checks

| Page | Design decision | What to check |
| --- | --- | --- |
| Homepage | Keep “What’s being built in Mississauga?” and the one-sentence introduction. Place the full-width oblique Downtown picture first and the six ways to explore directly below. Give each major collection a visual preview. Credit Daniel near the opening and explain why he made the model at the end. | From the homepage, reach a neighbourhood, an individual building, Compare, the film, the gallery, the atlas and the 3D map. |
| Compare and film | Compare has two choices, Before and after and Skyline film. Keep all three signed Downtown stages on the homepage. Use the same camera in each stage and place film controls below the signed frame. | Choose Lakeview, open its neighbourhood and return. Test the slider, each stage, film chapters, play, seeking, fullscreen and the short-page footer. |
| Neighbourhoods and map | Show one area picker, one useful preview and a clear map action. Keep the chosen area and stage through navigation. Make pan, rotate and reset discoverable. | Change the area near the bottom of the page. The page stays in place and the map opens at that area. Check touch movement and keyboard reset. |
| Buildings | Use All buildings, Building studies and Before and after. Keep their heading baselines and sticky switcher aligned. Show all detailed models and pictured study cards from the start, grouped by area, project or subject. Keep simple city massing in the map. | At 320, 390 and 1280 px, compare headings, filter padding and one- and two-line cards. Search for 275 Superior, open its profile, then return to the same search and card. |
| Building profiles | Put the building and address first, followed by verified team roles, model and real-life view. Label a dated aerial as an aerial. Give the original photo or gallery link when available. Keep photo credit with the image and its source record. | Open Google Maps and Apple Maps for the same address. Check Street View when coordinates are available. Verify the artist and photo source independently of architect, builder and developer. |
| Building studies | List every study with an image. Its own view shows the subject, pictures, sources and one path into the PDF reader. A revision can keep dated earlier evidence beside today’s work. | Open a bookmarked study and a directory card. Read and download the PDF, test image preview, then return to the same card. Retired references retain their archived status. |
| Gallery and portraits | Keep the picture, short place and scenario, and signed download together. Use a shared crop and image-to-caption gap. Keep extended licences in Sources. | Check portrait and landscape, keyboard arrows, touch swiping, Escape and outside-click dismissal. Match the signed image to its preview. |
| Downloads and atlas | Group files by what a visitor wants to read, study or print. Show subject, format, size and one aligned action. Distinguish historical editions. | Scroll through consecutive pages at phone and desktop widths. Check the centred page selector, filename, bytes and first page. Follow the atlas contents; zoom into labels and compare the reader page to the downloaded PDF. |
| Updates | Group documented days by month. Move one grey rectangle along the left rail with scrolling. Each day links to a short story and can credit contributors with verified, publishable information. | Open a day, read its summary, then return to the same date. Check adjacent months, phone navigation, keyboard focus and reduced motion. |
| Sources and study notes | Use a short section rail and readable records. Identify the provider, the exact drawing, dataset or photograph, its contribution and its source link. Keep research limits beside the affected project. | Follow one section link and its original provider record. Check the selected section as you scroll and verify that limits describe the building in view. |
| Contact, creator and suggestions | Use Contact for email, creator information and suggestions. Identify any verified coverage by its outlet. A suggestion is public only after Daniel approves it and adds his response. | Find Contact in the header. Follow its links and verify the suggestion moderation flow in a non-public test. Keep private correspondence out of public copy. |
| Offline edition | The saved HTML opens the complete styled site with its matching files. Keep the launch page, directory and file links together. | Open the saved edition on a Mac. Follow a building and study, view a local image and read a PDF. Identify features that require an internet connection. |

## Release checks

**Open the actual page.** Check at 320, 390 and 1280 px with a mouse, keyboard and touch where available. Measure heading baselines, card heights, control padding and scroll restoration. Inspect each representative page visually.

**Follow a complete journey.** Use the homepage to reach a detail page, view its image or PDF, then go back. Open deep links directly as well. A local build, hosted preview and live page each need their own check.

**Check the actual exports.** Compare the native render and signed output, then inspect the full-size PNG, reader, downloaded PDF and film. Measure pixels per printed inch at final placement. Record which files were rebuilt.

**Keep evidence with the decision.** Record the page, viewport, checked destination and result. Missing elevations at 275 Superior, the fourth Greenpark tower pairing, exact Voya roof details, Port Credit bridge drawings and LRT turnout alignment remain individual evidence questions.
