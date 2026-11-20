"""Prepare the two exterior images, credited downloads and public links for each study."""
import argparse
import os
from html import escape, unescape
from pathlib import Path
import hashlib, json, re, shutil
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
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
fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
heading = ImageFont.truetype(str(fonts / 'Inter-SemiBold.ttf'), 31)
body = ImageFont.truetype(str(fonts / 'Inter-Regular.ttf'), 18)
seen = set()

def convert(match):
    section = match.group()
    key = re.search('id="([^"]+)"', section)[1]
    record = records[key]
    title = record['title']
    mapURL = re.search('href="(explore\\.html\\?[^"]+)"', section)[1]
    references = unescape(re.findall('<p class="render-basis">(.*?)</p>', section)[-1]).removeprefix('References: ')
    directions = ('reverse', 'front') if key in ('merner-42-john', 'south-common-community-centre') else ('front', 'reverse')
    figures = []
    for (direction, label) in zip(directions, ('Exterior', 'Opposite side')):
        source = photos / (key + '-' + direction + '.webp')
        receipt = json.loads((photos / (key + '.json')).read_text())
        assert hashlib.sha256(source.read_bytes()).hexdigest() == receipt[direction]
        image = Image.open(source).convert('RGB')
        with Image.new('RGB', (image.width, image.height + 153), 'white') as sheet:
            sheet.paste(image, (0, 0))
            draw = ImageDraw.Draw(sheet)
            y = image.height
            draw.line((36, y + 4, image.width - 36, y + 4), fill='#D6D9D6', width=1)
            draw.text((36, y + 20), f'{title} · {label}', font=heading, fill='#242627')
            draw.text((36, y + 65), 'Render by Daniel Sultan · Future Mississauga', font=body, fill='#494D4F')
            lines = ['']
            for word in references.split():
                candidate = (lines[-1] + ' ' + word).strip()
                if draw.textlength(candidate, font=body) > image.width - 72:
                    lines.append(word)
                else:
                    lines[-1] = candidate
            assert len(lines) <= 2, (key, references)
            for (index, line) in enumerate(lines):
                draw.text((36, y + 94 + index * 22), line, font=body, fill='#494D4F')
            png = edition / (source.stem + '.png')
            meta = PngImagePlugin.PngInfo()
            meta.add_text('Author', 'Daniel Sultan')
            meta.add_text('Description', references + '  See the project booklet for full sources and model limitations.')
            sheet.save(public / png, pnginfo=meta, compress_level=5)
        preview = edition / source.name
        shutil.copyfile(source, public / preview)
        thumb = edition / (source.stem + '-640.webp')
        image.thumbnail((640, 480), Image.Resampling.LANCZOS)
        image.save(public / thumb, 'WEBP', quality=86, method=5)
        a = f'<a href="{preview}" data-edition-plate="{escape(key)}-{direction}" data-preview-title="{label}" data-preview-width="1440" data-preview-height="1080" data-preview-download="{png}">'
        figures.append(f'<figure>{a}<img src="{thumb}" srcset="{thumb} 640w, {preview} 1440w" sizes="(max-width:700px) 90vw, 42vw" width="1440" height="1080" loading="lazy" decoding="async" alt="{escape(title)}, {label.lower()} view"></a><figcaption>{label} <a class="file-download" data-download href="{png}" download aria-label="Download {escape(title)}, {label.lower()} view as PNG">PNG ↓</a></figcaption></figure>')
    pair = f'<div class="render-pair" data-picture-area="{escape(title)}" data-picture-map="{mapURL}">' + ''.join(figures) + '</div>'
    (section, replacements) = re.subn('<div class="render-pair"[^>]*>.*?</figure></div>', lambda _: pair, section, count=1, flags=re.S)
    assert replacements
    pdf = record['url']
    actions = f'<div class="render-actions"><a href="{pdf}" data-document-preview>Read study PDF →</a><a href="{pdf}" data-download download>Download PDF ↓</a><a href="{escape(oldPictures[key])}">Original neighbourhood view</a></div>'
    (section, replacements) = re.subn('<div class="render-actions">.*?</div>', lambda _: actions, section, count=1, flags=re.S)
    assert replacements
    seen.add(key)
    return section
page = public / 'review-renders.html'
updated = re.sub('<section class="render-project"[^>]*>.*?</section>', convert, page.read_text(), flags=re.S)
assert len(seen) == 11
page.write_text(updated)
print('Rebuilt and bound', len(seen) * 2, 'current exterior views, full-resolution PNG downloads and responsive thumbnails.')
