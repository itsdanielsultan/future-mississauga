# Building study renders

Every directory card and profile image for this edition has a matching record in `studies.json`. It stores the source checksums, camera direction, triangle count and checksums of both WebP sizes.

The renderer uses Node.js, a C++17 compiler, NumPy, trimesh and Pillow with WebP support. From the repository root, run a single public study with the following command.

```sh
python3 scripts/editions/20261120/buildings/render.py --output /tmp/building-studio --check mcity-m1
```

To reproduce all 30 studies, supply `--private-inputs /path/to/local-inputs.json` and omit the study name. The local JSON maps each `sourceKey` listed in `studies.json` to the corresponding GLB file on the owner's machine. The production website distributes the rendered pictures. The source geometry and architectural correspondence stay with the owner. Published files use 1800 × 1350 for the signed profile and 640 × 480 for the card. The signed images use Inter from the system font directory or the directory named by FM_INTER_FONTS.

The two warehouse views frame the studied frontage. The full warehouse model still casts the shadow and occludes geometry.

The eight additional landmark and artwork pictures in Model revisions are rebuilt using revision-plates.py with its private-inputs argument. The four original owner-supplied meshes stay off the website. The 23 current model views sit beside their historical revision comparisons. The separately rendered Fairview pair uses the signed city edition.
