# Exact Edge / Oro / Avia web assets

Five building studies and one shared-podium component. Gzip decoding reproduces the accepted GLB bytes exactly; no geometry simplification, quantization, registration or hidden-source export is performed. MANIFEST.json pins each source ZIP part, Library identity, member and both compressed/decoded hashes. Source/native masters remain in their original packages.

Read CREDITS.txt before using or sharing these assets. Avia retains City envelope geometry and its terms apply. Edge/Oro contain authored plan/photo-informed geometry, with separate architectural and reference-image rights. No reference images, native recovery scenes or unrelated assets are included.

Avia tower files exclude the shared base. Each standalone preview combines its tower with the exact shared podium in common coordinates; only the display parent is centered. The other tower is omitted. The podium is a component, not an additional building.

Reproduce with Python3.9.6 / zlib1.2.12:

    python3 scripts/prepare-batch-previews.py /path/to/verified/ZIP-parts

Assets are served using this existing repository's full commit-pinned raw URLs. They are not part of the Pages dist inventory. This is bounded public file delivery, subject to GitHub rate and repository limits; no unlimited CDN or physical-device performance claim is made. Keep the asset commit reachable. Existing Pages files, model URLs and the 1GB publication cap are retained.
