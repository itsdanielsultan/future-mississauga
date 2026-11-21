"""Prepare the two exterior images, credited downloads and public links for each study."""
import argparse
from html import escape, unescape
from pathlib import Path
import hashlib, json, re
from PIL import Image, PngImagePlugin
from buildings.plate import signed_plate
here = Path(__file__).resolve().parent
public = here.parents[2] / 'public'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path, help='Working directory used by booklet-studios.py')
args = parser.parse_args()
photos = args.workspace.resolve() / 'booklet-models'
edition = Path('gallery/edition-20261120/exteriors')
out = public / edition
out.mkdir(exist_ok=True)
records = {item['id']: item for item in json.loads((here / 'study-booklets.json').read_text())}
oldPictures = {item['projectId']: item['url'] for item in json.loads((public / 'data/building-study-media.json').read_text()) if item['kind'] == 'neighbourhood'}
seen = set()

def convert(match):
    section = match.group()
    key = re.search('id="([^"]+)"', section)[1]
    record = records[key]
    title = record['title']
    mapURL = re.search('href="(explore\\.html\\?[^"]+)"', section)[1]
    references = record['reference']
    directions = ('reverse', 'front') if key in ('merner-42-john', 'south-common-community-centre') else ('front', 'reverse')
    figures = []
    for (direction, label) in zip(directions, ('Exterior', 'Opposite side')):
        source = photos / (key + '-' + direction + '.webp')
        receipt = json.loads((photos / (key + '.json')).read_text())
        assert hashlib.sha256(source.read_bytes()).hexdigest() == receipt[direction]
        image = Image.open(source).convert('RGB')
        sheet = signed_plate(image, title, byline='by Daniel Sultan   ·   ' + label, reference=references)
        png = edition / (source.stem + '.png')
        meta = PngImagePlugin.PngInfo()
        meta.add_text('Author', 'Daniel Sultan')
        meta.add_text('Description', references + '  See the project booklet for full sources and model limitations.')
        sheet.save(public / png, pnginfo=meta, compress_level=5)
        preview = edition / source.name
        sheet.thumbnail((1800, 1350), Image.Resampling.LANCZOS)
        sheet.save(public / preview, 'WEBP', quality=93, method=4)
        w, h = sheet.size
        thumb = edition / (source.stem + '-640.webp')
        sheet.thumbnail((640, 480), Image.Resampling.LANCZOS)
        sheet.save(public / thumb, 'WEBP', quality=88, method=5)
        a = f'<a href="{preview}" data-edition-plate="{escape(key)}-{direction}" data-preview-title="{label}" data-preview-width="{w}" data-preview-height="{h}" data-preview-download="{png}">'
        figures.append(f'<figure>{a}<img src="{thumb}" srcset="{thumb} 640w, {preview} {w}w" sizes="(max-width:700px) 90vw, 42vw" width="{w}" height="{h}" loading="lazy" decoding="async" alt="{escape(title)}, {label.lower()} view"></a><figcaption>{label} <a class="file-download" data-download href="{png}" download aria-label="Download {escape(title)}, {label.lower()} view as PNG">PNG ↓</a></figcaption></figure>')
    pair = f'<div class="render-pair" data-picture-area="{escape(title)}" data-picture-map="{mapURL}">' + ''.join(figures) + '</div>'
    attrs = re.match(r'<section[^>]*>', section).group().replace(' data-archive-study', '')
    label = re.search(r'<div class="eyebrow">(.+?)</div>', section)[1]
    old_profile = re.search(r'href="(building-[a-z0-9-]+\.html)"', section)
    profile = f'<a href="{old_profile[1]}">Building profile →</a>' if old_profile else ''
    pdf = record['url']
    actions = (f'<div class="render-actions"><a href="{pdf}" data-document-preview>Read study PDF →</a>'
               f'<a href="{pdf}" data-download download>Download PDF ↓</a></div>')
    section = (attrs + f'<div class="eyebrow">{label}</div><h2>{escape(title)}</h2>'
               f'<p class="study-intro-line">{escape(record["summary"])}</p>'
               f'<nav class="study-links" aria-label="Explore {escape(title)}">{profile}<a href="{mapURL}">3D map →</a></nav>'
               + pair + actions + '<aside class="study-source"><h3>Study sources</h3>'
               f'<p>{escape(references)}</p></aside></section>')
    seen.add(key)
    return section
page = public / 'review-renders.html'
updated = re.sub('<section class="render-project"[^>]*>.*?</section>', convert, page.read_text(), flags=re.S)
assert len(seen) == 11
page.write_text(updated)
print('Rebuilt and bound', len(seen) * 2, 'current exterior views, full-resolution PNG downloads and responsive thumbnails.')
