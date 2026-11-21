# November 21 artwork

The current city edition contains 72 native Blender views, including three matched Downtown home views. Thirty-four cameras use registered geometry revisions. The remaining 38 cameras use their original packed geometry, with the same shared print treatment. The previous published edition remains at its dated download and gallery URLs.

## Reproduce the city and its publications

Use the checked camera recipe in `../20261120`. `MODEL_ARCHIVE` points to the original packed model workspace. `REGISTERED_MODELS` contains the `exchange-phase` and `scene-refresh` folders. `RENDER_WORK` is a separate workspace. No source scene is saved by the Blender adapters.

```sh
recipe=scripts/editions/20261120
python3 "$recipe/replay.py" --edition 20261121 --archive "$MODEL_ARCHIVE" \
  --project-models "$REGISTERED_MODELS" --workspace "$RENDER_WORK" --prepare
```

Create the registered regional fragments, if required, with `python3 scripts/editions/20261121/prepare-regional-geometry.py --archive "$MODEL_ARCHIVE" --project-models "$REGISTERED_MODELS"`. The Exchange phase builder and its source proof are in the same edition directory.

Open the generated `render-in-blender.py` in Blender 5.3.0 and run it. For a single frame, add `--view` with the identity listed by `replay.py --list`. The correction adapter checks the source blend and every replacement model. Each completed native receipt identifies its actual camera, resolution, engine, timing, PNG checksum, and any added and hidden project surfaces.

The grade reads the date-specific planning review and the measured City tower surfaces. `measure-existing-facets.py` reconstructs those surface memberships from the original municipal mesh vertices. It uses NumPy and SciPy and accepts `--archive` and `--output`. The output is compared as JSON with `native-existing-facets.json`. The parallel `measure-square-one-mall.py` utility identifies the large connected mall shells inside the two municipal source footprints. `plan-massing-materials.json` identifies the plain schematic project materials that carry a scenario colour in the map. The offline grade excludes coloured vertices, texture maps, preserved finishes and named architectural materials from that assignment.

The commercial-building ink uses 1,266 polygons from the City of Mississauga’s December 31, 2025 existing land-use survey. The compressed copy is in `geometry-sources/commercial-parcels-2025.json.gz`. `fetch-commercial-parcels.py --output FILE` checks the live response against that dated copy. `measure-commercial-facets.py --archive "$MODEL_ARCHIVE" --output FILE` reconstructs existing commercial mesh face memberships using SciPy and Shapely. The smaller wings and dome around Square One are identified directly by existing building surfaces inside three City retail parcels. Roads, landscaping and residential buildings keep their own surfaces.

The stage verifier reads every active municipal and project input. Neutral municipal project geometry takes its dated stage when its native renderer supplied no material override. Fourteen uncertain source components use violet in the future scenario. The completed Block Nine and Perla tower shafts and the retained Eglinton office volumes have individually registered grey surfaces. Balcony slabs, architectural fins, podiums, glass finishes and photographic roof caps retain their original modelling.

```sh
python3 "$recipe/grade.py" "$RENDER_WORK"
python3 "$recipe/grade-cooksville.py" "$RENDER_WORK"
python3 scripts/compose-city-originals.py "$RENDER_WORK" --edition 20261121
python3 scripts/package-city-edition.py "$RENDER_WORK" --edition 20261121 --part covers
python3 "$recipe/booklet-studios.py" "$RENDER_WORK" --approved-roof "$APPROVED_ROOF"
python3 "$recipe/booklets.py" "$RENDER_WORK" --edition 20261121 \
  --originals "$ORIGINAL_BOOKLETS" --receipts "$RENDER_WORK/original-receipts"
python3 "$recipe/atlas.py" "$RENDER_WORK" --edition 20261121 \
  --studios "$RENDER_WORK/booklet-models" --receipts "$RENDER_WORK/original-receipts"
python3 "$recipe/film.py" "$RENDER_WORK" --edition 20261121
python3 scripts/package-city-edition.py "$RENDER_WORK" --edition 20261121 --part catalog
python3 scripts/build-document-reader.py --edition 20261121 --previous-edition 20261120 --force
python3 scripts/editions/20261121/verify-lifecycle-surfaces.py "$RENDER_WORK" --output "$RENDER_WORK/lifecycle-surfaces.json"
python3 "$recipe/verify-city.py" "$RENDER_WORK" --edition 20261121
python3 "$recipe/verify-publications.py" "$RENDER_WORK" --edition 20261121 --previous-edition 20261120
```

Use a Python installation with NumPy and Pillow for the grade and native verification, and a Python installation with ReportLab and PyMuPDF for PDF assembly. The reader needs Pillow with AVIF support. FFmpeg, ffprobe and pdfimages verify the film and print output. The model-study recipe accepts the owner-supplied 41 Bay roof source as `APPROVED_ROOF` and the original credited studies as `ORIGINAL_BOOKLETS`.
