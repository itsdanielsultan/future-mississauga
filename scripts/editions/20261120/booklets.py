"""Build public study booklets from published model derivatives and the current atlas plates."""
from pathlib import Path
from io import BytesIO
from xml.sax.saxutils import escape
import hashlib, json, math, re
import fitz
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
import argparse, os
import fcntl
from datetime import datetime
here = Path(__file__).resolve().parent
public = here.parents[2] / 'public'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
parser.add_argument('--originals', type=Path, required=True, help='Folder containing the 11 originally published review PDFs')
parser.add_argument('--receipts', type=Path, help='Use the freshly rendered city-image receipts before the city catalogue is published')
parser.add_argument('--edition', default='20261120')
parser.add_argument('--force', action='store_true', help='Rebuild even when the verified inputs and PDF match this edition')
parser.add_argument('--only', nargs='+', default=[])
args = parser.parse_args()
work = args.workspace.resolve()
edition_date = datetime.strptime(args.edition, '%Y%m%d').strftime('%d %B %Y')
output_directory = public / 'downloads' / ('edition-' + args.edition)
output_directory.mkdir(parents=True, exist_ok=True)
fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
base = 'https://futuremississauga.com/'

def load(path):
    return json.loads(path.read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
for (family, face) in [('Atlas', 'Inter-Regular.ttf'), ('Atlas Medium', 'Inter-SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(family, str(fonts / face)))
font_inputs={name:sha(fonts/name) for name in ['Inter-Regular.ttf','Inter-SemiBold.ttf']}
projects = {r['id']: r for r in load(public / 'data/projects.json')}
records = load(here / 'study-booklets.json')
model_studies = {r['url']: r for r in load(public / 'data/building-study-media.json') if r['kind'] == 'review'}
plates = {r['id']: r for r in load(public / 'data/city-plates-20261120.json')['plates']}
captions = {r['id']: r['caption'] for r in load(here / 'selected.json')}
booklets = {'aldo-1422-study': ('lorne-park', 'Lorne Park', 'A historical house design shown in the 2020 renderings. The entrance faces Aldo Drive.'), 'burnhamthorpe-community-centre': ('dixie-applewood', 'Dixie and Applewood', 'City design boards and photographs of the completed building establish the roof decks and the shape of the exterior.'), 'glen-erin-6719': ('meadowvale', 'Meadowvale', 'The March 2026 plan shows a stepped, 16-storey apartment building beside 28 townhomes and the existing apartment tower.'), 'hazelhurst-business-park': ('clarkson', 'Clarkson', 'The study reconstructs the building shells from the developer’s leasing brochure and the municipal building footprints.'), 'lakeview-deco-opus': ('lakeview', 'Lakeview', 'The marketing plan shows 17 numbered townhome blocks. The roofs, façades and heights are estimates.'), 'merner-41-bay': ('port-credit', 'Port Credit', 'A low cross-gable meets the neighbouring ridges at right angles. The study uses four elevations and completed exterior photographs supplied by Merner Row Design.'), 'merner-42-john': ('port-credit', 'Port Credit', 'The March 2025 drawings show a proposed addition. The model follows the four elevations and the existing street frontage.'), 'merner-42-peter': ('port-credit', 'Port Credit', 'Exterior photographs guide the dormers, front elevation and porch roof. The main house follows its mapped footprint.'), 'south-common-community-centre': ('erin-mills', 'Erin Mills', 'The study shows the intended finished exterior, including the library, connecting spine and pool wing.'), 'square-one-block22': ('downtown', 'Downtown', 'A dated 2021 roof plan gives the towers and podium their shape. The present project is on hold while revisions are considered.'), 'st-hilarys-anglican-church': ('cooksville', 'Cooksville', 'Two exterior photographs establish the steep A-frame nave and its triangular glazed front. The lower wings follow the City model.')}
(W, H, M) = (842, 595, 34)
(ink, secondary, rule) = ('#252829', '#55595A', '#D6D9D6')

def write(c, text, x, y, size=12, face='Atlas', color=ink, right=False):
    c.setFont(face, size)
    c.setFillColor(HexColor(color))
    (c.drawRightString if right else c.drawString)(x, y, text)

def paragraph(c, content, x, top, width, size=15, leading=20, color=ink, face='Atlas'):
    element = Paragraph(escape(content), ParagraphStyle('p', fontName=face, fontSize=size, leading=leading, textColor=HexColor(color)))
    (_, height) = element.wrap(width, H)
    element.drawOn(c, x, top - height)
    return top - height

def line(c, x1, y, x2):
    c.setStrokeColor(HexColor(rule))
    c.setLineWidth(0.65)
    c.line(x1, y, x2, y)

def link(c, label, url, x, y):
    write(c, label, x, y, 12, 'Atlas Medium')
    length = pdfmetrics.stringWidth(label, 'Atlas Medium', 12)
    c.linkURL(url, (x - 2, y - 6, x + length + 2, y + 15), relative=0, thickness=0)
    return length

def frame(c, page, name, section):
    c.bookmarkPage(str(page))
    c.addOutlineEntry(section, str(page))
    write(c, name, M, H - 49, 24, 'Atlas Medium')
    write(c, section, W - M, H - 47, 12, right=True, color=secondary)
    line(c, M, H - 65, W - M)
    line(c, M, 37, W - M)
    write(c, 'Future Mississauga  ·  Daniel Sultan', M, 19, 9.5, color=secondary)
    write(c, f'{edition_date}     /     {page}', W - M, 19, 9.5, right=True, color=secondary)

def image(c, source, scene=False):
    with Image.open(source) as image:
        original = image.convert('RGB')
        if not scene:
            c.setFillColor(HexColor('#%02x%02x%02x' % original.getpixel((0, 0))))
            c.rect(M, 73, W - M * 2, H - 153, fill=1, stroke=0)
        placed_scale = min((W - 2*M) / original.width, (H - 153) / original.height)
        if 72 / placed_scale < 300:
            raise ValueError(f'{source}: below 300 pixels per printed inch')
        if 72 / placed_scale > 365:
            original.thumbnail((math.ceil(original.width * placed_scale * 365 / 72), math.ceil(original.height * placed_scale * 365 / 72)), Image.Resampling.LANCZOS)
        jpg = BytesIO()
        original.save(jpg, 'JPEG', quality=92, subsampling=0, optimize=True)
        jpg.seek(0)
        c.drawImage(ImageReader(jpg), M, 73, W - M * 2, H - 153, preserveAspectRatio=True, anchor='c')
receipts_file = work / 'booklet-assembly.json'
receipt_lock=(work/'booklet-assembly.lock').open('a')
fcntl.flock(receipt_lock,fcntl.LOCK_EX)
receipts = load(receipts_file) if receipts_file.is_file() else {}
for row in records:
    (key, name) = (row['id'], row['title'])
    if args.only and key not in args.only:
        continue
    m = work / 'booklet-models'
    proof = load(m / (key + '.json'))
    assert proof['project'] == key and proof['triangles'] > 0 and len(proof['sources'])
    project = projects[key]
    (area_id, area_name, summary) = booklets[key]
    context_key = f'wide/{area_id}-future.png'
    plate = plates[context_key]
    receipt = load(args.receipts / (context_key.replace('/', '-').removesuffix('.png') + '.json')) if args.receipts else plate
    master = receipt['displayMaster']
    context = public / master['url']
    if sha(context) != master['sha256']:
        raise ValueError(f'{key}: source image differs from its render receipt')
    credits = captions[context_key]
    old = args.originals / row['original'].rsplit('/', 1)[1]
    assert sha(old) == model_studies[row['original']]['sha256']
    path = output_directory / Path(row['url']).name
    inputs = dict(edition=args.edition, recipe=sha(Path(__file__)), fonts=font_inputs, studio=proof, project=project,
                  book=row, neighbourhood=master['sha256'], summary=summary, caption=credits, referencePDF=sha(old))
    fingerprint = hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest()
    previous=receipts.get(key,{})
    if not args.force and previous.get('inputSHA256')==fingerprint and path.is_file() and sha(path)==previous.get('pdf'):
        print('Verified',key,flush=True)
        continue
    with fitz.open(old) as original:
        blocks = [b[4].strip().split('\n') for b in original[-1].get_text('blocks') if b[6] == 0]
        caveat = ' '.join(blocks[-2]).removeprefix('Approximate geographic placement in municipal building context. ')
        acknowledgement = ' '.join((x for x in blocks[-1] if not x.isnumeric())).strip().rstrip('.') + '.'
    if key == 'aldo-1422-study':
        caveat = 'The upper flat roof has a plain black finish. The slopes below it are shingled. The position of the house is approximate.'
    if key == 'merner-41-bay':
        caveat = 'The ridge-to-porch dimension is 24 ft 6 in. Smaller openings, hidden details and the grade around the house remain approximate.'
    output = BytesIO()
    c = canvas.Canvas(output, pagesize=(W, H), pageCompression=1, invariant=1)
    c.setTitle(name + ' | Future Mississauga')
    c.setAuthor('Daniel Sultan')
    c.setSubject('Building study, ' + edition_date)
    angles = ['reverse', 'front'] if key in {'merner-42-john', 'south-common-community-centre'} else ['front', 'reverse']
    for (page, (angle, label)) in enumerate(zip(angles, ['Exterior study', 'Opposite view']), 1):
        frame(c, page, name, label)
        picture = m / f'{key}-{angle}.webp'
        assert sha(picture) == proof[angle]
        image(c, picture)
        write(c, 'Independent exterior model' if page == 1 else 'The same model from the opposite side', M, 51, 12, 'Atlas Medium')
        write(c, area_name, W - M, 51, 12, color=secondary, right=True)
        c.showPage()
    frame(c, 3, name, 'Neighbourhood')
    image(c, context, scene=True)
    context_label = area_name + (' neighbourhood' if key=='aldo-1422-study' and args.edition!='20261120' else ' with proposed projects')
    write(c, context_label, M, 51, 12, 'Atlas Medium')
    write(c, 'Area overview  ·  City of Mississauga' + ('  ·  © OpenStreetMap' if credits.get('openStreetMap') else ''), W - M, 51, 9.5, right=True, color=secondary)
    c.showPage()
    frame(c, 4, name, 'About this study')
    (left, right) = (M, 450)
    for (x, heading) in [(left, 'What the model shows'), (right, 'References and credits')]:
        write(c, heading, x, 481, 19, 'Atlas Medium')
    y = paragraph(c, summary, left, 453, 365)
    y = paragraph(c, caveat, left, y - 20, 365, 13, 19, secondary)
    line(c, left, y - 22, left + 365)
    street = project['address'] or name
    y = paragraph(c, street + ', ' + area_name, left, y - 39, 365, 12, 17)
    link(c, 'View in Google Maps', f"https://www.google.com/maps/search/?api=1&query={project['lat']:.6f},{project['lon']:.6f}", left, y - 23)
    y = paragraph(c, '. '.join((part[:1].upper() + part[1:] for part in acknowledgement.split('; '))), right, 453, 358, 13, 19)
    required = [x for x in credits.get('requiredModelCredits', []) if not x.startswith('Contains information licensed')]
    mandatory = ['Neighbourhood mapping by the City of Mississauga. Contains information licensed under the Open Government Licence – Ontario.']
    if credits.get('openStreetMap'):
        mandatory.append('© OpenStreetMap contributors, ODbL 1.0.')
    mandatory.extend(required)
    y = paragraph(c, ' '.join(mandatory), right, y - 20, 358, 11, 16, secondary)
    y = paragraph(c, 'The attached text file contains all credits for the neighbourhood image.', right, y - 14, 358, 11, 16, secondary)
    assert y > 105, (key, y)
    link(c, 'Read the model notes', base + 'study-notes.html#note-' + key, right, y - 24)
    c.showPage()
    c.save()
    credit_text = '\n'.join(dict.fromkeys([name, acknowledgement, 'Neighbourhood: ' + area_name, *credits['fullCredits'], *credits.get('requiredModelCredits', [])])) + '\n'
    with fitz.open(stream=output.getvalue(), filetype='pdf') as pdf:
        pdf.embfile_add('Study and neighbourhood credits.txt', credit_text.encode('utf8'), desc='Study and neighbourhood credits')
        target = path.with_suffix('.tmp')
        pdf.save(target, garbage=4, deflate=True, no_new_id=True)
    target.replace(path)
    receipts[key] = {'pdf': sha(path), 'inputSHA256':fingerprint, 'context': str(context.relative_to(public)), 'contextSHA256': sha(context), 'creditedStudy': sha(old), 'studio': {angle: proof[angle] for angle in angles}, 'firstView': angles[0], 'sources': proof['sources']}
    print(key, path.stat().st_size, flush=True)
temporary_receipts=receipts_file.with_suffix('.partial')
temporary_receipts.write_text(json.dumps(receipts, indent=2) + '\n')
temporary_receipts.replace(receipts_file)
receipt_lock.close()
