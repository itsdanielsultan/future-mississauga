"""Generate social thumbnails for the current section pages from their own artwork."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from html import escape, unescape
from io import BytesIO
from pathlib import Path

from PIL import Image

public = Path(__file__).resolve().parents[1] / 'public'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--edition', help='Publication date, YYYYMMDD; defaults to the current share edition')
parser.add_argument('--page', action='append', help='Refresh only the named share images')
parser.add_argument('--images-only', action='store_true', help='Stage image bytes without switching the current pages')
args = parser.parse_args()
active_manifest = public/'data/edition-shares.json'
if not args.edition:
    current = json.loads(active_manifest.read_text())['index']['url']
    args.edition = re.fullmatch(r'gallery/edition-(\d{8})/share/index\.jpg', current)[1]
datetime.strptime(args.edition, '%Y%m%d')
edition = Path('gallery') / ('edition-' + args.edition)
preview = Path('document-previews') / edition.name
signed = edition / 'signed'
records = {}
subjects = {
    'index': (signed/'home-downtown-future.webp', 'Square One and the proposed Downtown skyline'),
    'compare': (signed/'wide-downtown-skyline-future.webp', 'Downtown with proposed buildings'),
    'film': (edition/'Downtown-film-poster.webp', 'A frame from the Downtown skyline film'),
    'social': (signed/'portraits-downtown-landmark-future.webp', 'Absolute World in a vertical view of Downtown'),
    'gallery': (signed/'wide-port-credit-future.webp', 'A model view of the Port Credit waterfront'),
    'explore': (signed/'wide-citywide-future.webp', 'Mississauga in the interactive city model'),
    'downloads': (preview/'atlas-01.avif', 'The cover of the Mississauga atlas'),
    'updates': (signed/'wide-downtown-junction-future.webp', 'The City Centre area of the Downtown model'),
    'model': (edition/'buildings/mcity-pair.webp', 'Daniel Sultan’s detailed model of the M City towers'),
    'review-renders': (edition/'exteriors/aldo-1422-study-front.webp', 'The front elevation of 1422 Aldo Drive'),
    'reference-updates': (edition/'building-revisions/benares-visitor-centre.webp', 'The Benares Visitor Centre model revision'),
    'neighbourhoods': (signed/'wide-port-credit-future.webp', 'Port Credit and the river in the neighbourhood atlas'),
    'contact': (signed/'home-downtown-existing.webp', 'Square One in Daniel Sultan’s existing-city model'),
    'about': (signed/'home-downtown-future.webp', 'Daniel Sultan’s Downtown Mississauga print'),
    'suggestions': (signed/'wide-lakeview-future.webp', 'Lakeview and the waterfront in the city model'),
    'sources': (preview/'atlas-01.avif', 'The cover of the documented Mississauga atlas'),
    'accuracy-review': (signed/'wide-downtown-skyline-construction.webp', 'The dated construction stage in the Downtown comparison'),
    'study-notes': (signed/'wide-downtown-landmark-future.webp', 'A closer model study of Absolute World'),
}
if args.edition != '20261120':
    subjects.update({
        'about': (signed/'wide-downtown-portrait-future.webp', 'Daniel Sultan’s model of the Exchange District'),
        'neighbourhoods': (signed/'wide-cooksville-future.webp', 'An aerial view of Cooksville in the neighbourhood atlas'),
        'sources': (preview/'atlas-03.avif', 'The atlas guide to map colours and project stages'),
    })
chosen = args.page or list(subjects)
for page in chosen:
    if page not in subjects:
        parser.error('Unknown page: ' + page)
    source = public / subjects[page][0]
    if not source.is_file():
        parser.error('Share image source is missing: ' + str(source))
before = active_manifest.read_text()
old = json.loads(before)
previous = re.fullmatch(r'gallery/edition-(\d{8})/share/index\.jpg', old['index']['url'])[1]
if args.page and not args.images_only and previous != args.edition:
    parser.error('Updating individual published cards requires the active edition. Use --images-only to stage images.')
if previous != args.edition and not args.page and not args.images_only:
    dated = active_manifest.with_name(f'edition-shares-{previous}.json')
    if not dated.exists():
        dated.write_text(before)
output = public/edition/'share'
output.mkdir(parents=True, exist_ok=True)
if args.page:
    records=json.loads(active_manifest.read_text())
for page, (source, description) in subjects.items():
    if args.page and page not in args.page:
        continue
    file = public / (page + '.html')
    original = public/source
    source_bytes = original.read_bytes()
    with Image.open(BytesIO(source_bytes)) as picture:
        picture = picture.convert('RGB')
        if args.edition == '20261120':
            picture.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        else:
            # Preserve the complete print and signature in wide social link cards.
            picture.thumbnail((1200, 630), Image.Resampling.LANCZOS)
            card = Image.new('RGB', (1200, 630), '#eeefec')
            card.paste(picture, ((card.width-picture.width)//2,(card.height-picture.height)//2))
            picture = card
        target = output/(page+'.jpg')
        pending = target.with_suffix('.jpg.partial')
        picture.save(pending, format='JPEG', quality=88, optimize=True)
        pending.replace(target)
        width, height = picture.size
    relative = target.relative_to(public).as_posix()
    records[page] = dict(source=source.as_posix(), sourceSHA256=hashlib.sha256(source_bytes).hexdigest(),
                         url=relative, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                         width=width, height=height)
    if args.images_only:
        continue
    html = file.read_text()
    html = re.sub(r'<meta (?:name="twitter:image(?::alt)?"|property="og:image(?::(?:alt|height|width|type))?")[^>]*>', '', html)
    title = escape(unescape(re.search(r'<title>(.*?)</title>',html,re.S)[1]))
    html = re.sub(r'<meta (?:name="twitter:title"|property="og:(?:url|title)")[^>]*>', '', html)
    page_url = 'https://futuremississauga.com/' + ('' if page=='index' else page+'.html')
    url = 'https://futuremississauga.com/' + relative
    tags = (f'<meta property="og:image" content="{url}"><meta property="og:image:alt" content="{escape(description)}">'
            f'<meta property="og:image:width" content="{width}"><meta property="og:image:height" content="{height}">'
            f'<meta property="og:image:type" content="image/jpeg"><meta name="twitter:image" content="{url}">'
            f'<meta name="twitter:image:alt" content="{escape(description)}">')
    title_tags = (f'<meta property="og:title" content="{title}"><meta property="og:url" content="{page_url}">'
                  f'<meta name="twitter:title" content="{title}">')
    refreshed = html.replace('</head>', title_tags+tags+'</head>', 1)
    if refreshed != file.read_text():
        file.write_text(refreshed)
for page in chosen:
    original = public / records[page]['source']
    if hashlib.sha256(original.read_bytes()).hexdigest() != records[page]['sourceSHA256']:
        raise RuntimeError('Artwork changed while building the share preview: ' + page)
if args.images_only:
    print(f'{len(chosen)} share images staged for {args.edition}')
    raise SystemExit(0)
result = active_manifest.with_suffix('.partial')
result.write_text(json.dumps(records, indent=2)+'\n')
dated = active_manifest.with_name(f'edition-shares-{args.edition}.json')
dated_result = dated.with_suffix('.partial')
dated_result.write_bytes(result.read_bytes())
dated_result.replace(dated)
result.replace(active_manifest)
print(f'{len(chosen)} share previews verified for {args.edition}')
