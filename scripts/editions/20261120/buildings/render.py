"""Rebuild full views and directory cards without putting original private models in the website."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile

from PIL import Image

from studio import build_raster, model_geometry, render_view


def digest(data):
    return hashlib.sha256(data).hexdigest()


def get_glb(source, work, public, private_files):
    if source['type'] == 'original-model':
        data = Path(private_files[source['sourceKey']]).read_bytes()
    else:
        key = source['url']
        if key.startswith('https://raw.githubusercontent.com/'):
            path = public.parent / 'model-assets' / key.split('/model-assets/')[-1]
        else:
            path = public / key
        data = path.read_bytes()
    if digest(data) != source['sha256']:
        raise ValueError('Unexpected geometry checksum for ' + (source.get('sourceKey') or source['url']))
    raw = gzip.decompress(data) if data[:2] == b'\x1f\x8b' else data
    metadata = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
    if 'EXT_meshopt_compression' not in metadata.get('extensionsUsed', []):
        return raw
    encoded = work / 'compressed.glb'
    decoded = work / 'expanded.glb'
    encoded.write_bytes(raw)
    subprocess.run(['node', str(Path(__file__).with_name('decode-meshopt.mjs')), str(encoded), str(decoded)], check=True)
    return decoded.read_bytes()


def main():
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=here.parents[3] / 'public')
    parser.add_argument('--private-inputs', type=Path, help='Local JSON mapping the seven study IDs to source GLB files.')
    parser.add_argument('--output', type=Path, required=True, help='Directory for the full WebP images and cards/ folder.')
    parser.add_argument('--check', action='store_true', help='Verify outputs against the published camera and image receipts.')
    parser.add_argument('studies', nargs='*')
    args = parser.parse_args()
    profiles = json.loads((here / 'studies.json').read_text())
    private_files = json.loads(args.private_inputs.read_text()) if args.private_inputs else {}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'cards').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary)
        raster = build_raster(work)
        for name in args.studies or profiles:
            study = profiles[name]
            parts = []
            for source in study['modelInputs']:
                parts.extend(model_geometry(get_glb(source, work, args.public, private_files)))
            master = args.output / (name + '.webp')
            card = args.output / 'cards' / master.name
            count = render_view(parts, study['camera'], master, raster, frontage=study.get('frameDetailedFrontage', False))
            if count != study['triangles']:
                raise ValueError(f'{name} geometry count changed')
            with Image.open(master) as image:
                image.resize((560, 420), Image.Resampling.LANCZOS).save(card, quality=87, method=5)
            if args.check:
                for file, record in [(master, study['displayImage']), (card, study['cardImage'])]:
                    if digest(file.read_bytes()) != record['sha256']:
                        raise ValueError(f'{name}: mismatched {file.name} bytes')
            print(name, count, flush=True)


if __name__ == '__main__':
    main()
