"""Generate social thumbnails for the current section pages from their own artwork."""
import hashlib
import json
import re
from html import escape
from pathlib import Path

from PIL import Image

public = Path(__file__).resolve().parents[1] / 'public'
edition = Path('gallery/edition-20261120')
records = {}
subjects = {
    'index': (edition/'home-future-2560.webp', 'Square One and the proposed Downtown skyline'),
    'compare': (edition/'wide-downtown-skyline-future.webp', 'Downtown with proposed buildings'),
    'film': (edition/'Downtown-film-poster.webp', 'A frame from the Downtown skyline film'),
    'social': (edition/'portraits-downtown-landmark-future.webp', 'Absolute World in a vertical view of Downtown'),
    'gallery': (edition/'wide-port-credit-future.webp', 'A model view of the Port Credit waterfront'),
    'explore': (edition/'wide-citywide-future.webp', 'Mississauga in the interactive city model'),
    'downloads': (Path('document-previews/edition-20261120/atlas-03.avif'), 'An interior page of the Mississauga atlas'),
    'updates': (edition/'wide-downtown-junction-future.webp', 'The City Centre area of the Downtown model'),
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
    url = 'https://futuremississauga.com/' + relative
    tags = (f'<meta property="og:image" content="{url}"><meta property="og:image:alt" content="{escape(description)}">'
            f'<meta property="og:image:width" content="{width}"><meta property="og:image:height" content="{height}">'
            f'<meta property="og:image:type" content="image/jpeg"><meta name="twitter:image" content="{url}">'
            f'<meta name="twitter:image:alt" content="{escape(description)}">')
    file.write_text(html.replace('</head>', tags+'</head>', 1))
(public/'data/edition-shares.json').write_text(json.dumps(records, indent=2)+'\n')
