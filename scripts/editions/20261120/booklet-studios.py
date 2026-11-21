"""Rebuild the front and reverse views used in the November building booklets."""
import argparse
import hashlib
import json
import struct
import subprocess
import tempfile
from pathlib import Path

from buildings.studio import build_raster, model_geometry, render_view


HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / 'public'
ROOF_MODEL_SHA256 = '92c13720553d8ccae90f531351c5bc49ef66bc10431708ae2cd3fe1b0fdd6f03'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace', type=Path)
    parser.add_argument('--approved-roof', type=Path, required=True, help='Authorised corrected 41 Bay model')
    parser.add_argument('--only', nargs='+', default=[], help='Render one or more named studies')
    args = parser.parse_args()
    output = args.workspace.resolve() / 'booklet-models'
    output.mkdir(exist_ok=True, parents=True)
    published = json.loads((PUBLIC / 'data/refinement-models.json').read_text())['assets']
    books = json.loads((HERE / 'study-booklets.json').read_text())
    with tempfile.TemporaryDirectory() as folder:
        temp = Path(folder)
        raster = build_raster(temp)
        for book in books:
            name = book['id']
            if args.only and name not in args.only:
                continue
            models = [(row['id'], PUBLIC / row['url'], row['sha256']) for row in published if row['projectId'] == name]
            if name == 'merner-41-bay':
                models = [(name, args.approved_roof, ROOF_MODEL_SHA256)]
            geometry, sources = [], []
            for model_id, path, checksum in models:
                raw = path.read_bytes()
                if digest(raw) != checksum:
                    raise ValueError(f'{model_id}: different source geometry')
                sources.append(dict(id=model_id, sourceSHA256=checksum))
                size = struct.unpack_from('<I', raw, 12)[0]
                metadata = json.loads(raw[20:20 + size])
                if 'EXT_meshopt_compression' in metadata.get('extensionsUsed', []):
                    decoded = temp / 'decoded.glb'
                    subprocess.run(['node', str(HERE / 'buildings/decode-meshopt.mjs'), str(path), str(decoded)], check=True)
                    raw = decoded.read_bytes()
                geometry.extend(model_geometry(raw))
            if not geometry:
                raise ValueError(f'{name}: no mesh')
            angles = {'front': [-1, .59, 1.45], 'reverse': [1.18, .52, -1.05]}
            if name == 'merner-42-peter':
                angles = {'front': [1.18, .64, -1.3], 'reverse': [-1.6, .63, -.75]}
            receipt = dict(project=name, sources=sources)
            for side, direction in angles.items():
                path = output / f'{name}-{side}.webp'
                receipt['triangles'] = render_view(geometry, direction, path, raster, roof_sheen=name == "aldo-1422-study", output_size=(3600, 2700))
                receipt[side] = digest(path.read_bytes())
            (output / f'{name}.json').write_text(json.dumps(receipt, indent=2)+'\n')
            print(name, receipt['triangles'], flush=True)


if __name__ == '__main__':
    main()
