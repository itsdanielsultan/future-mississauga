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
args = parser.parse_args()
local_files = json.loads(args.private_inputs.read_text())
records_file = here/'revisions.json'
records = json.loads(records_file.read_text())
page = (public/'reference-updates.html').read_text()
titles = dict(re.findall(r'<section class="model-change" id="([^"]+)"[^>]*>.*?<h2>(.*?)</h2>', page, re.S))
output = public/'gallery/edition-20261120/building-revisions'
output.mkdir(exist_ok=True)
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
        sheet.save(destination, 'WEBP', quality=94, method=4)
        record['triangles'] = count
        record['image'] = dict(url=destination.relative_to(public).as_posix(), width=sheet.width,
                               height=sheet.height, sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
        print(key, count, flush=True)
records_file.write_text(json.dumps(records, indent=2, ensure_ascii=False)+'\n')
