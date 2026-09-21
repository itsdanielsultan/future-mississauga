# Future Mississauga

An independent visual atlas for Daniel Sultan: original 4K pictures, a research register, and an interactive city model with existing GO rail corridors, the Mississauga Transitway and the Hazel McCallion Line.

The website is entirely static. It requires no Sites or OpenAI service, account, server API, application database, or secret. Three.js and meshoptimizer are included locally with their upstream notices. DM Sans and Manrope web fonts are bundled under `public/vendor/fonts/`, including the official Google Fonts source record and SIL Open Font License notices; font rendering makes no external request. The original PNG files live at `public/gallery/originals/` and are checksum-verified against the picture index. They are not recompressed.

## View locally

With Node 22 or newer, run `npm run dev` and open the printed local URL. No dependency installation is required. Opening the HTML directly through `file://` may prevent the browser from fetching the model files.

Run `npm run check` to verify HTML and Markdown links, local stylesheet/font dependencies, original image hashes, publication size and excluded private artifacts. `npm run build` validates and copies the static files into `dist/`. `npm run preview` serves that built folder. For a project-path check, use `node scripts/serve.mjs --base /future-mississauga/`.

## GitHub Pages

This repository uses **branch deployment**. `main` retains the public source, provenance and build/preview tools. The separate `gh-pages` branch contains only the validated contents of `public/`, at its root, with `.nojekyll`. Configure Pages to deploy from `gh-pages`, folder `/`. The initial static branch has no parent; subsequent updates are ordinary fast-forward commits. Identical image and model blobs are shared Git objects across both branches.

This setup uses ordinary repository permission and adds no active Actions workflow. `docs/github-actions-example.yml` is an optional future example, outside `.github/workflows`; it does not execute. No extra workflow permission is needed for the current site. Repository creation, pushing and optional custom-domain setup are separate deliberate actions.

All application and image URLs are relative. The intended primary address is `https://futuremississauga.com/`, with `futuremississauga.ca` redirecting to `.com` while preserving paths and queries. `https://itsdanielsultan.github.io/future-mississauga/` remains the publishing fallback. Domain ownership, DNS, redirects and HTTPS must be verified separately before claiming the custom addresses are live. Configure only the `.com` primary in `public/CNAME` and GitHub Pages; the `.ca` redirect is a separate hosting/DNS task. The repository contains no DNS credentials.

The guarded exporter defaults publication metadata to the GitHub project address. After domain ownership is confirmed, re-export with `--site-origin https://futuremississauga.com/` before configuring the custom domain. Canonical links, social preview metadata, robots and sitemap follow the selected origin; research links remain unchanged.

The exporter enforces a conservative published-size limit below 1,000,000,000 bytes and a per-file limit below 100,000,000 bytes. These are slightly stricter than GitHub's stated limits. Native Blender scenes, immutable backups and the untouched municipal archive remain in the local deliverable collection and are not published here. Large downloadable archives can be distributed separately through an explicitly prepared release if needed.

Official guidance: [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Git file-size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Model meaning

The explorer combines reviewed municipal building geometry, documented replacement models, context, landscape and transit. A standalone building GLB does not contain that complete layered assembly. The current reviewed/reconciled models are the recommended building exports. Untouched municipal source snapshots are provenance material and must not be presented as the current assembled model.

GO stays green, the Transitway blue and HML gold. These are unlit cartographic route guides, separate from grey physical tracks. Their display elevations keep service paths readable through bridge and below-grade crossings; they are not surveyed engineering profiles. Incomplete second-track mapping and the HML turnout reconstruction retain explicit schematic labels. The current research and model guides explain the remaining building, landscape and transit uncertainties.

## Rights and attribution

Preserve [ATTRIBUTION.md](ATTRIBUTION.md), `public/licenses/`, all source notices, model metadata and linked terms. The project is independent and is not an official City of Mississauga, Metrolinx or developer publication. A single blanket licence is not asserted over the combined source models, mapping, imagery and third-party code.

Private correspondence, email extracts, credentials and local working files are excluded. The original reference creator's artwork and model files are not included.

`EXPORT-MANIFEST.json` records the final export's file hashes, byte count and original PNG validation. It is created only after the final render lock; the prepared repository skeleton alone is not a finished publication.
