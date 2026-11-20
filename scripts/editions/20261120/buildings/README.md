# Building study renders

Every directory card and profile image for this edition has a matching record in `studies.json`. It stores the source checksums, camera direction, triangle count and checksums of both WebP sizes.

The renderer uses Node.js, a C++17 compiler, NumPy, trimesh and Pillow with WebP support. From the repository root, run a single public study with the following command.

```sh
python3 scripts/editions/20261120/buildings/render.py --output /tmp/building-studio --check mcity-m1
```

To reproduce all 30 studies, supply `--private-inputs /path/to/local-inputs.json` and omit the study name. The local JSON maps each `sourceKey` listed in `studies.json` to the corresponding GLB file on the owner's machine. The production website distributes the rendered pictures. The source geometry and architectural correspondence stay with the owner. Published files use 1440 × 1080 for the profile and 560 × 420 for the card.

The two warehouse views frame the studied frontage. The full warehouse model still casts the shadow and occludes geometry.
