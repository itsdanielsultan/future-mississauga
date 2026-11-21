# Future Mississauga

The [November 20 city and building render recipes](scripts/editions/20261120/README.md) accompany the current visual edition.

Future Mississauga is Daniel Sultan’s independent visual guide to the buildings, transit lines and neighbourhoods changing across the city. The homepage links directly to the 3D map, neighbourhoods, detailed building studies, skyline comparisons, galleries and print atlas.

The public website uses static HTML, locally served fonts and JavaScript. The interactive map uses Three.js and meshoptimizer. The skyline film uses Media Chrome. The online suggestions form uses a small Cloudflare Worker and a private D1 database. It publishes only the short question and reply Daniel approves. Reads of the public site work without an account. The design and release checks are recorded in [the design guide](docs/atlas-design-review.md).

The waterfront 3D context uses bounded display water in Clarkson, Lakeview and the city overview. Lakeview keeps a 400 m coastal band with the full mapped pier and breakwater surrounded by water. These are presentation extents; mapped shoreline, source water level, terrain, roads, buildings and camera controls are retained. The public geometry record is `public/downloads/Waterfront-viewer-water-extents.json`.

The Clarkson model also includes source-mapped mainland linking its original district crop to Harding Waterfront Estate, with complete supported existing building components from the City source data. No source building was reshaped or moved. The public source record is `public/downloads/Clarkson-mainland-context-repair.json`.

## Open and preview

Open `Future-Mississauga.html` beside the exported `Future-Mississauga` folder to browse the Mac edition. Keep the opener and folder together when moving them. Its pages, pictures, PDFs and model files are available locally. The dedicated exporter embeds the local presentation and resolves assets on the file protocol.

For development, run `npm run dev` with Node 22 or newer. To build the current hosting edition, run `npm ci`, then `npm run build`. Open the built pages and media with `npm run preview`. Run `npm run check` for the build and staged Worker checks. Use `node scripts/verify-cloudflare-preview.mjs --staged --full` for a complete local byte comparison and `node --test scripts/*.test.mjs` for the regression suite.

## Hosting and delivery

The Cloudflare builder writes `.cloudflare-release/` with static files, the Worker and a manifest mapping large public media to their hashes in R2. It caps static files at 20,000 and each static file at 25 MiB. Large PDFs, pictures and models keep their public URLs through the Worker. The upload helper checks the total bytes already in the project's R2 bucket together with requested additions against an 8 GB limit. The dashboard’s $20 billing alert is a notification. The project bucket is private. A visitor can trigger at most one bucket read through a Worker request. On Workers Free, its 100,000 daily request limit puts this single site below the R2 Standard allowance of 10 million reads a month. Account-wide usage and direct bucket operations are separate.

Cloudflare Workers Static Assets serves `https://futuremississauga.com/`. The production route is configured to fail open to the existing GitHub Pages origin on `gh-pages` if the daily Worker request quota is reached. On GitHub, `hosting/cloudflare-preview` holds the editable source and `hosting/cloudflare-deployment` holds the packaged deployment snapshot. The GitHub Pages build still uses `npm run build:pages`, writes `dist/` and records its inventory in the root `PUBLICATION-MANIFEST.json`.

For each release, upload the verified R2 media, then upload the Worker candidate with `wrangler versions upload --no-x-provision --config .cloudflare-release/wrangler.json`. Set `VERSION_URL` and `VERSION_ID` from that upload. Run `node scripts/verify-cloudflare-preview.mjs --version-url="$VERSION_URL" --full` to compare this candidate’s files against the local release. After the check passes, promote that same version with `wrangler versions deploy "${VERSION_ID}@100%" --config .cloudflare-release/wrangler.json`. Run `node scripts/verify-cloudflare-preview.mjs --live --full` to check the production address. To check the shared preview address, run `node scripts/verify-cloudflare-preview.mjs --full`.

The editable hosting branch includes `cloudflare/media-recovery.json`. In a fresh checkout of that branch, run `python3 scripts/restore-cloudflare-media.py` before building. The script restores each omitted public binary through its immutable digest URL and verifies its size and SHA-256. Before a subsequent release, the operator retains the verified `.cloudflare-release/published-media.json` as `cloudflare/published-media.json` to keep previously published digests available. Use `--from live` for an edition released to the public domain.

The October image releases, source hashes, model records and project attribution remain available at their established paths. The November edition has its own native render receipts, signed pictures and print publications. The city model and map are derived from mixed-date sources. The site publishes source notices and dates alongside their corresponding files.

## Model meaning

The Subway concept page was removed on 1 November 2026. Its earlier source files remain in Git history. Toronto context models and their source/licence metadata remain unchanged and are no longer linked from the website.

The explorer combines reviewed municipal building geometry, documented replacement models, context, landscape and transit. A standalone building GLB does not contain that complete layered assembly. The current reviewed/reconciled models are the recommended building exports. Untouched municipal source snapshots are provenance material and must not be presented as the current assembled model.

GO stays green, the Transitway blue and HML gold. These are unlit route guides, separate from grey physical tracks. They follow the physical display profiles and use normal scene depth, so buildings, roofs, bridges and ground hide obstructed sections. They are not surveyed engineering profiles. Incomplete second-track mapping and the HML turnout reconstruction retain explicit schematic labels. The current research and model guides explain the remaining building, landscape and transit uncertainties.

## Rights and attribution

Preserve [ATTRIBUTION.md](ATTRIBUTION.md), `public/licenses/`, all source notices, model metadata and linked terms. The project is independent and is not an official City of Mississauga, Metrolinx or developer publication. A single blanket licence is not asserted over the combined source models, mapping, imagery and third-party code.

Private correspondence, email extracts, credentials and local working files are excluded. The original reference creator's artwork and model files are not included.

`EXPORT-MANIFEST.json` retains the recovered source export's historical hashes and original PNG validation; it is not the current publication inventory. Each successful build writes `PUBLICATION-MANIFEST.json` with every actual `dist/` file hash, byte count and validation result. Neither a build nor its local inventory grants publication approval or proves that the public site has changed.

The shared site uses an off-white background, dark text, neutral selected controls and an Inter-first font stack. Planning colours are reserved for the model, legend and transit routes. Local font licences and source notices are under `public/vendor/fonts/`.
