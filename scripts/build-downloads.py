"""Build the download directory from files and metadata in the active reader edition."""
import json
import re
from html import escape
from pathlib import Path

PUBLIC = Path(__file__).resolve().parents[1] / "public"
catalogue = json.loads((PUBLIC / "data/document-previews-20261120.json").read_text())
atlas = next(doc for doc in catalogue["documents"] if doc["url"].endswith("/Mississauga-Atlas.pdf"))
directory = Path(atlas["url"]).parent
studies = [doc for doc in catalogue["documents"] if Path(doc["url"]).parent == directory and doc != atlas]
subjects = {
    "aldo-1422-study": ("Lorne Park", "The house and roof in the 2020 design"),
    "burnhamthorpe-community-centre": ("Dixie and Applewood", "The stepped roof and recreation centre"),
    "glen-erin-6719": ("Meadowvale", "A proposed apartment building and townhomes"),
    "hazelhurst-business-park": ("Clarkson", "Industrial buildings along Hazelhurst Road"),
    "lakeview-deco-opus": ("Lakeview", "Seventeen planned townhome blocks"),
    "merner-41-bay": ("Port Credit", "The roof that joins the two wings"),
    "merner-42-john": ("Port Credit", "The proposed addition in the 2025 drawings"),
    "merner-42-peter": ("Port Credit", "The front porch, roof and dormers"),
    "south-common-community-centre": ("Erin Mills", "The library and pool wing"),
    "square-one-block22": ("Downtown", "The towers and podium in the 2021 plan"),
    "st-hilarys-anglican-church": ("Cooksville", "The A-frame roof and triangular front window"),
}


def file_size(url):
    byte_count = (PUBLIC / url).stat().st_size
    if byte_count < 1_000_000:
        return f"{max(1,round(byte_count / 1_000)):,} KB"
    return f"{byte_count / 1_000_000:.1f} MB"


def action(url, text, *, name, download=False, preview=False):
    attrs = ' download data-download' if download else ' data-document-preview aria-haspopup="dialog"' if preview else ''
    arrow = '↓' if download else '→'
    return (f'<a class="download-action" href="{escape(str(url))}"{attrs} aria-label="{escape(name)}">'
            f'{escape(text)}<span aria-hidden="true">{arrow}</span></a>')


def listing(title, detail, actions):
    return (f'<li class="download-row"><div class="download-name"><h3>{escape(title)}</h3>'
            f'<p>{escape(detail)}</p></div><div class="download-actions">{actions}</div></li>')


cover = atlas["base"] + atlas["prefix"] + "01.avif"
parts = [
    '<main id="main" class="downloads-main"><header><h1>Downloads</h1></header>',
    '<article class="download-atlas">',
    f'<a class="download-cover" href="{atlas["url"]}" data-document-preview aria-label="Preview the complete atlas">'
    f'<img src="{cover}" width="{atlas["width"]}" height="{atlas["height"]}" alt="Cover of the Mississauga atlas"></a>',
    '<div class="download-lead"><h2>Mississauga atlas</h2><p>See the whole city, then explore it neighbourhood by neighbourhood.</p>',
    f'<p class="file-meta">{atlas["pages"]} pages · PDF · {file_size(atlas["url"])}</p><div class="download-actions">',
    action(atlas["url"], "Read atlas", name="Preview the complete atlas", preview=True),
    action(atlas["url"], "Download PDF", name="Download the complete atlas PDF", download=True),
    '</div></div></article>',
    '<section id="downtown" aria-labelledby="downtown-title"><h2 id="downtown-title">Downtown prints and film</h2><ul>',
]
for scenario, title in [('existing', 'Downtown today'), ('future', 'Downtown with proposals')]:
    image = f'gallery/{directory.name}/originals/home-downtown-{scenario}-print.png'
    pdf = f'{directory}/Downtown-{scenario}-print.pdf'
    parts.append(listing(title, 'Signed print of Square One and the city centre',
        action(image, "PNG · "+file_size(image), name=f"Download {title} as PNG", download=True)
        + action(pdf, "PDF · "+file_size(pdf), name=f"Download {title} as a print PDF", download=True)))
film_info = json.loads((PUBLIC / 'data/downtown-film-20261120.json').read_text())
film = film_info["film"]["url"]
parts += [
    listing("Skyline film", f'Three stages of development · {film_info["durationSeconds"]} seconds',
            action("film.html", "Watch", name="Watch the skyline film")
            + action(film, "MP4 · "+file_size(film), name="Download the skyline film as MP4", download=True)),
    '</ul></section><section id="building-studies" aria-labelledby="studies-title"><h2 id="studies-title">Building studies</h2><div class="download-groups">',
]
groups = {}
for doc in studies:
    area, subject = subjects[doc["prefix"].rstrip("-")]
    groups.setdefault(area, []).append((doc, subject))
for area, items in sorted(groups.items()):
    parts.append(f'<div class="download-group"><h3 class="area-label">{escape(area)}</h3><ul>')
    for doc, subject in items:
        detail = f'{subject} · PDF · {file_size(doc["url"])}'
        item = listing(doc["title"], detail,
                       action(doc["url"], "Preview", name="Preview " + doc["title"], preview=True)
                       + action(doc["url"], "Download", name="Download " + doc["title"] + " PDF", download=True))
        parts.append(item.replace("<h3>", "<h4>").replace("</h3>", "</h4>"))
    parts.append('</ul></div>')
parts.append('</div></section></main>')
page = PUBLIC / "downloads.html"
updated, count = re.subn(r'<main\b[^>]*>.*?</main>', lambda _: '\n'.join(parts),page.read_text(),count=1,flags=re.S)
if count != 1:
    raise ValueError("Missing downloads page content")
page.write_text(updated)
