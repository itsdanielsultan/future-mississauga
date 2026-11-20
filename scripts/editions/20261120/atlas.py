"""Rebuild the atlas and printer-ready plates from the verified, current scene masters."""
import sys, json, hashlib, math, os, re
from pathlib import Path
from io import BytesIO
from collections import defaultdict
from xml.sax.saxutils import escape
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.colors import HexColor
from pypdf import PdfReader
import argparse, os
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
work = parser.parse_args().workspace.resolve()
public = Path(__file__).resolve().parents[3] / 'public'
fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
out = public / 'downloads/edition-20261120'
images = public / 'gallery/edition-20261120'
out.mkdir(parents=True, exist_ok=True)
images.mkdir(parents=True, exist_ok=True)
for (family, filename) in [('Atlas', 'Inter-Regular.ttf'), ('AtlasMedium', 'Inter-SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(family, str(fonts / filename)))
records = json.loads((work / 'selected.json').read_text())
proofs = {}
for f in (work / 'native').glob('*/render-proof.json'):
    proof = json.loads(f.read_text())
    if proof.get('state') == 'RENDERED_VISUAL_REVIEW_REQUIRED':
        for native in proof['images']:
            proofs[native['identity']] = (native, proof)
for r in records:
    if r['id'] not in proofs:
        continue
    (native, proof) = proofs[r['id']]
    r['_native'] = native['image']['path']
    r['_background'] = proof['background']
    r['sourceSHA256'] = native['image']['sha256']
    r['caption']['renderTimestampUTC'] = native['renderCompletedUTC']
    r['north'] = native['north']['bearingClockwiseFromScreenUpDegrees']
assert len(proofs.keys() & {r['id'] for r in records}) == 69, 'Missing verified native edition render'
districts = json.loads((public / 'data/districts.json').read_text())

def label(r):
    key = r['id']
    if key.startswith('neighbourhood/'):
        return 'Earlier model' if key.endswith('/before') else 'Revised model'
    stage = {'future': 'With proposed projects', 'existing': 'Existing buildings', 'construction': 'Construction snapshot'}.get(r['caption']['scenario'], r['caption']['scenario'])
    if 'skyline' in key:
        return 'Skyline · ' + stage
    if 'junction' in key:
        return 'Street junction · ' + stage
    if 'landmark' in key:
        return 'Landmark view · ' + stage
    return stage

def filename(r):
    return re.sub('[^a-z0-9]+', '-', r['id'].removesuffix('.png')).strip('-')

def area(r):
    return str(r['caption']['area'] or r['title'])

def drawtext(c, t, x, y, size=12, font='Atlas', col='#36383b'):
    c.setFont(font, size)
    c.setFillColor(HexColor(col))
    c.drawString(x, y, t)

def line(c, x, y, xx, yy):
    c.setStrokeColor(HexColor('#d5d7d7'))
    c.setLineWidth(0.6)
    c.line(x, y, xx, yy)

def block(c, t, x, top, w, size=11, leading=16):
    text = escape(t)
    p = Paragraph(text, ParagraphStyle('t', fontName='Atlas', fontSize=size, leading=leading, textColor=HexColor('#414346'), splitLongWords=True))
    (_, h) = p.wrap(w, 10000)
    p.drawOn(c, x, top - h)
    return h

def footer(c, n, W=1008):
    line(c, 32, 35, W - 32, 35)
    drawtext(c, 'Future Mississauga   /   Daniel Sultan', 32, 18, 9)
    c.setFont('Atlas', 9)
    c.drawRightString(W - 32, 18, str(n))

def imagebox(c, p, x, y, w, h):
    with Image.open(p) as im:
        (iw, ih) = im.size
        ratio = min(w / iw, h / ih)
        dw = iw * ratio
        dh = ih * ratio
        c.drawImage(ImageReader(str(p)), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)

def add_attribution(r):
    return list(dict.fromkeys([*r['caption'].get('fullCredits', []), *r['caption'].get('requiredModelCredits', [])]))

def draw_compass(c, degrees, x, y):
    if degrees is None:
        return
    theta = math.radians(float(degrees))
    (dx, dy) = (math.sin(theta), math.cos(theta))
    (sx, sy) = (dy * 3, -dx * 3)
    p = c.beginPath()
    p.moveTo(x + dx * 9, y + dy * 9)
    p.lineTo(x + sx, y + sy)
    p.lineTo(x - dx * 9, y - dy * 9)
    p.lineTo(x - sx, y - sy)
    p.close()
    c.setStrokeColor(HexColor('#373a3d'))
    c.setFillColor(HexColor('#373a3d'))
    c.drawPath(p, fill=1)
    drawtext(c, 'N', x + dx * 13 - 2, y + dy * 13 - 2, 7)

def title(r):
    return r['caption']['title'] if r['caption'].get('title') else r['title']

def folder_label(r):
    i = r['id']
    f = r['file'].split('/')[0]
    if 'fairview' in i:
        return 'Fairview'
    for a in sorted(districts, key=lambda x: -len(x['id'])):
        if f.startswith(a['id'] + '-'):
            return a['name']
    return area(r)

def sortkey(r):
    order = ['citywide', 'downtown', 'cooksville', 'port-credit', 'lakeview', 'fairview', 'clarkson', 'lorne-park', 'erindale', 'erin-mills', 'streetsville', 'meadowvale-village', 'meadowvale', 'lisgar', 'churchill-meadows', 'east-credit-creditview', 'uptown', 'heartland', 'dixie-applewood', 'malton', 'airport-corporate']
    area_id = next((v for v in order if '/' + v + '-' in r['id'] or '/' + v + '/' in r['id']), None)
    return (order.index(area_id) if area_id else 99, folder_label(r), r['kind'] == 'portraits', 'skyline' in r['id'], r['file'].replace('-future', '-2').replace('-existing', '-0').replace('-construction', '-1'))
records.sort(key=sortkey)
groups = []
for r in records:
    key = (folder_label(r), r['kind'])
    if r['kind'] == 'portraits' and groups and (groups[-1][0] == key) and (len(groups[-1][1]) == 1):
        groups[-1][1].append(r)
    else:
        groups.append((key, [r]))
(W, H) = (1008, 720)
c = canvas.Canvas(str(work / 'atlas-ready.pdf'), pagesize=(W, H), pageCompression=1)
c.setTitle('Future Mississauga · City and neighbourhood atlas')
c.setAuthor('Daniel Sultan')
c.setSubject('Print edition issued 20 November 2026. Source dates vary by image.')
credits = defaultdict(set)
rows = []
page = 0

def frame_copy(r):
    k = filename(r)
    src = Path(r['_native'])
    jpg = work / ('print-' + k + '.jpg')
    web = images / (k + '.webp')
    toned = work / 'toned' / (k + '.png')
    if toned.is_file():
        src = toned
    thumbs = images / 'thumbnails'
    thumb = thumbs / (k + '.webp')
    if jpg.is_file() and web.is_file() and thumb.is_file() and (min((file.stat().st_mtime_ns for file in (jpg, web, thumb))) >= src.stat().st_mtime_ns):
        return (jpg, web)
    with Image.open(src) as im:
        if r.get('_native'):
            bg = Image.new('RGBA', im.size, r['_background'])
            bg.alpha_composite(im.convert('RGBA'))
            im = bg
        im = im.convert('RGB')
        im.thumbnail((2450, 2450), Image.Resampling.LANCZOS)
        im.save(jpg, 'JPEG', quality=88, subsampling=2, optimize=True)
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        im.save(web, 'WEBP', quality=88, method=4)
        thumbs = images / 'thumbnails'
        thumbs.mkdir(exist_ok=True)
        im.thumbnail((640, 640), Image.Resampling.LANCZOS)
        im.save(thumbs / (k + '.webp'), 'WEBP', quality=76, method=4)
    return (jpg, web)
if '--previews-only' in sys.argv:
    for r in records:
        if 'downtown' in r['id']:
            (native, proof) = proofs[r['id']]
            if any((s.get('projectId') == 'voya' for s in proof.get('derivedDisplayMaterials', {}).get('changedSlots', []))):
                continue
            frame_copy(r)
    sys.exit(0)
for (_, grp) in groups:
    page += 1
    c.bookmarkPage('p' + str(page))
    head = folder_label(grp[0])
    c.addOutlineEntry(head + ' · ' + label(grp[0]), 'p' + str(page), 0, False)
    drawtext(c, head, 32, H - 53, 28, 'AtlasMedium', '#242628')
    widths = (W - 64 - (len(grp) - 1) * 24) / len(grp)
    for (i, r) in enumerate(grp):
        x = 32 + i * (widths + 24)
        (jpg, web) = frame_copy(r)
        imagebox(c, jpg, x, 87, widths, H - 160)
        sub = label(r)
        if len(grp) == 2 and sub == label(grp[1 - i]) and (title(r) != title(grp[1 - i])):
            sub = title(r) + ' · ' + sub
        drawtext(c, sub, x, 62, 12, 'AtlasMedium')
        draw_compass(c, r.get('north'), x + widths - 13, 62)
        for credit in add_attribution(r):
            credits[credit].add(page)
        rows.append({'id': r['id'], 'area': head, 'label': sub, 'sourceSHA256': r['sourceSHA256'], 'newNativeRender': bool(r.get('_native')), 'originalRender': r['caption'].get('renderTimestampUTC'), 'webImage': str(web.relative_to(public)), 'page': page, 'width': Image.open(web).width, 'height': Image.open(web).height})
    footer(c, page)
    c.showPage()
page += 1
c.bookmarkPage('guide')
c.addOutlineEntry('Reading the atlas', 'guide')
drawtext(c, 'Reading the atlas', 32, H - 56, 30, 'AtlasMedium')
y = H - 97
for (name, copy) in [('Existing buildings', 'Structures represented in the existing city model.'), ('Under construction', 'Construction reflects the evidence recorded for each project. A project can have several phases.'), ('Proposed or approved', 'These projects show how the city could change. An application or approval does not establish a completion date.'), ('Uncertain', 'Recorded designs or project status may change. Some sites have competing proposals.'), ('About this edition', 'Prepared on 20 November 2026 from 69 city views. The project evidence dates vary by building. The city model is an illustration, not a current aerial survey.'), ('Find the project', 'The local website lists the model, building team and source links. Visit futuremississauga.com/sources.html for project research and data licences.')]:
    drawtext(c, name, 32, y, 15, 'AtlasMedium')
    y -= 10
    y -= block(c, copy, 32, y, 690, 13, 18) + 31
footer(c, page)
c.showPage()
y = 0
for (text, used) in sorted(credits.items()):
    indicator = 'Pages ' + ', '.join(map(str, sorted(used)))
    p = Paragraph(escape(text), ParagraphStyle('a', fontName='Atlas', fontSize=10, leading=14, textColor=HexColor('#383a3b'), splitLongWords=True))
    (_, h) = p.wrap(W - 64, 5000)
    labels = Paragraph(escape(indicator), ParagraphStyle('pg', fontName='AtlasMedium', fontSize=9, leading=12))
    (_, lh) = labels.wrap(W - 64, 5000)
    if y - h - lh - 20 < 52:
        if y:
            footer(c, page)
            c.showPage()
        page += 1
        drawtext(c, 'Image credits', 32, H - 54, 28, 'AtlasMedium')
        y = H - 86
    labels.drawOn(c, 32, y - lh)
    p.drawOn(c, 32, y - lh - 4 - h)
    y -= lh + h + 18
if y:
    footer(c, page)
    c.showPage()
c.save()
assert len(PdfReader(work / 'atlas-ready.pdf').pages) == page
(work / 'atlas-ready.pdf').replace(out / 'Mississauga-Atlas.pdf')
(work / 'edition.json').write_text(json.dumps({'atlasPages': page, 'plates': rows}, indent=2))
print(page, 'atlas pages', len(rows), 'fresh web plates', len(credits), 'distinct credits', flush=True)
