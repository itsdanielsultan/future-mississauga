"""Render the current artwork and landmark studies behind the dated revision comparisons."""
import argparse
import hashlib
import json
import re
import tempfile
from html import unescape
from pathlib import Path
from PIL import Image
from render import get_glb
from studio import model_geometry, build_raster, render_view
from plate import signed_plate

here = Path(__file__).resolve().parent
public = here.parents[3] / 'public'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--private-inputs', type=Path, required=True)
parser.add_argument('--edition', default='20261120')
parser.add_argument('--receipt', type=Path)
args = parser.parse_args()
if not re.fullmatch(r'\d{8}', args.edition):
    parser.error('Use an eight-digit edition date.')
if args.edition != '20261120' and not args.receipt:
    parser.error('A new edition requires a separate receipt.')
local_files = json.loads(args.private_inputs.read_text())
records_file = here/'revisions.json'
records = json.loads(records_file.read_text())
page = (public/'reference-updates.html').read_text()
titles = dict(re.findall(r'<section class="model-change" id="([^"]+)"[^>]*>.*?<h2>(.*?)</h2>', page, re.S))
edition = public / 'gallery' / ('edition-' + args.edition)
output = edition / 'building-revisions'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as directory:
    temp = Path(directory)
    raster = build_raster(temp)
    for key, record in records.items():
        glb = get_glb(record['source'], temp, public, local_files)
        scene = model_geometry(glb)
        raw = temp/'studio.webp'
        count = render_view(scene, record['camera'], raw, raster)
        destination = output/(key+'.webp')
        with Image.open(raw) as image:
            sheet = signed_plate(image.convert('RGB'), unescape(titles[key]), 'Render by Daniel Sultan', record['credit'])
            if args.edition != '20261120' or key in ('benares-visitor-centre', 'bradley-barn'):
                collection = 'buildings' if key in ('benares-visitor-centre', 'bradley-barn') else 'building-revisions'
                card = edition / collection / 'cards' / (key + '.webp')
                card.parent.mkdir(parents=True, exist_ok=True)
                image.thumbnail((640, 480), Image.Resampling.LANCZOS)
                image.save(card, 'WEBP', quality=90, method=4)
                record['cardImage'] = dict(url=card.relative_to(public).as_posix(),
                    width=image.width, height=image.height, sha256=hashlib.sha256(card.read_bytes()).hexdigest())
        sheet.save(destination, 'WEBP', quality=94, method=4)
        record['triangles'] = count
        record['image'] = dict(url=destination.relative_to(public).as_posix(), width=sheet.width,
                               height=sheet.height, sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
        print(key, count, flush=True)
(args.receipt or records_file).write_text(json.dumps(records, indent=2, ensure_ascii=False)+'\n')
