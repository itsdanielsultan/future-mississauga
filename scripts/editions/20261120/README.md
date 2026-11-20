# November 20, 2026 render edition

The 69 city plates and two homepage views use 28 packed Blender scenes. Each entry in `cameras.json` records its camera, lighting, render dimensions, sample count, and the checksums of the packed scene and its original import record. The final Downtown material rule preserves Voya’s concrete podium and planted roofs. The six dated Blender adapters retain the source checks used for the general city, Downtown and waterfront captures.

## Rebuild a city view

Run these commands from the repository root. Set `MODEL_ARCHIVE` to the owner’s local model archive directory containing the original model-work folders. Set `RENDER_WORK` to an empty working directory outside the website. The archive stays local. The checked-in recipes contain camera settings and source checksums.

```sh
recipe=scripts/editions/20261120
python3 "$recipe/replay.py" --list
python3 "$recipe/replay.py" --archive "$MODEL_ARCHIVE" --check
python3 "$recipe/replay.py" --archive "$MODEL_ARCHIVE" --workspace "$RENDER_WORK" \
  --view home/downtown-future.png --prepare
```

Open the generated `render-in-blender.py` in Blender’s **Scripting** workspace and choose **Run Script**. The original edition used Blender 5.2.2 LTS, Cycles and Metal. For a small proof add `--proof-edge 320`. Proofs go in a separate output folder. To build the entire edition, omit `--view`. For a background workstation build, replace `--prepare` with `--blender /path/to/blender`. Completed native runs write the RGBA image, actual projected north and a render receipt. The output folder for each view must be empty.

## Produce the website images, film and atlas

The publication tools use Pillow with WebP and AVIF support, NumPy, ReportLab, pypdf, PyMuPDF, ffmpeg and a C++17 compiler. Set `FM_INTER_FONTS` to the folder holding the Inter Regular and SemiBold TTFs. The calibrated Downtown colours use the measured values in `cover-colour-samples.json` and per-pixel masks calculated from the signed-off scene geometry.

```sh
python3 "$recipe/grade.py" "$RENDER_WORK"
python3 scripts/compose-city-originals.py "$RENDER_WORK"
python3 "$recipe/atlas.py" "$RENDER_WORK"
python3 "$recipe/film.py" "$RENDER_WORK"
python3 scripts/package-city-edition.py "$RENDER_WORK"
python3 scripts/build-document-reader.py atlas
python3 scripts/build-downloads.py
python3 scripts/build-edition-shares.py
```

The atlas producer lays out the 69 plates on 63 pages. The compare film shows the three skyline stages for four seconds each. The packaging step creates the two homepage print PDFs and WebP covers and records the actual files served by the galleries.

## Rebuild the building illustrations and booklets

The [building renderer](buildings/README.md) reproduces the 30 detailed building profiles and their directory thumbnails. The eleven separate printed studies use two studio angles each. The studio and PDF tools also use trimesh and Node.js. Set `APPROVED_ROOF` to the authorised local 41 Bay model. Set `ORIGINAL_BOOKLETS` to the folder containing the eleven originally published PDFs, with filenames as listed in `study-booklets.json`. The printed studies preserve their original qualifications and credits.

```sh
python3 "$recipe/booklet-studios.py" "$RENDER_WORK" --approved-roof "$APPROVED_ROOF"
python3 "$recipe/booklets.py" "$RENDER_WORK" --originals "$ORIGINAL_BOOKLETS"
python3 scripts/build-document-reader.py
python3 scripts/build-downloads.py
```

Private architectural references, source scenes and authorised model inputs remain outside GitHub. The public site uses the released images, PDFs and metadata. Compare regenerated files against their receipts after changing a dependency or hardware configuration.
