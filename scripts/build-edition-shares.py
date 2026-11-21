"""Generate social thumbnails for the current section pages from their own artwork."""
import hashlib
import json
import re
from html import escape, unescape
from pathlib import Path

from PIL import Image

public = Path(__file__).resolve().parents[1] / 'public'
edition = Path('gallery/edition-20261120')
signed = edition / 'signed'
records = {}
subjects = {
    'index': (signed/'home-downtown-future.webp', 'Square One and the proposed Downtown skyline'),
    'compare': (signed/'wide-downtown-skyline-future.webp', 'Downtown with proposed buildings'),
    'film': (edition/'Downtown-film-poster.webp', 'A frame from the Downtown skyline film'),
    'social': (signed/'portraits-downtown-landmark-future.webp', 'Absolute World in a vertical view of Downtown'),
    'gallery': (signed/'wide-port-credit-future.webp', 'A model view of the Port Credit waterfront'),
    'explore': (signed/'wide-citywide-future.webp', 'Mississauga in the interactive city model'),
    'downloads': (Path('document-previews/edition-20261120/atlas-01.avif'), 'The cover of the Mississauga atlas'),
    'updates': (signed/'wide-downtown-junction-future.webp', 'The City Centre area of the Downtown model'),
    'model': (edition/'buildings/mcity-pair.webp', 'Daniel Sultan’s detailed model of the M City towers'),
    'review-renders': (edition/'exteriors/aldo-1422-study-front.webp', 'The front elevation of 1422 Aldo Drive'),
    'reference-updates': (edition/'building-revisions/benares-visitor-centre.webp', 'The Benares Visitor Centre model revision'),
    'neighbourhoods': (signed/'wide-port-credit-future.webp', 'Port Credit and the river in the neighbourhood atlas'),
    'contact': (signed/'home-downtown-existing.webp', 'Square One in Daniel Sultan’s existing-city model'),
    'about': (signed/'home-downtown-future.webp', 'Daniel Sultan’s Downtown Mississauga print'),
    'suggestions': (signed/'wide-lakeview-future.webp', 'Lakeview and the waterfront in the city model'),
    'sources': (Path('document-previews/edition-20261120/atlas-01.avif'), 'The cover of the documented Mississauga atlas'),
    'accuracy-review': (signed/'wide-downtown-skyline-construction.webp', 'The dated construction stage in the Downtown comparison'),
    'study-notes': (signed/'wide-downtown-landmark-future.webp', 'A closer model study of Absolute World'),
}
output = public/edition/'share'
output.mkdir(parents=True, exist_ok=True)
for page, (source, description) in subjects.items():
    file = public / (page + '.html')
    original = public/source
    with Image.open(original) as picture:
        picture = picture.convert('RGB')
        picture.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        target = output/(page+'.jpg')
        picture.save(target, quality=88, optimize=True)
        width, height = picture.size
    relative = target.relative_to(public).as_posix()
    records[page] = dict(source=source.as_posix(), sourceSHA256=hashlib.sha256(original.read_bytes()).hexdigest(),
                         url=relative, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                         width=width, height=height)
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
    file.write_text(html.replace('</head>', title_tags+tags+'</head>', 1))
(public/'data/edition-shares.json').write_text(json.dumps(records, indent=2)+'\n')
