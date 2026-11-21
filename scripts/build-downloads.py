"""Build the downloads directory from the active reader edition and its signed prints."""
from datetime import datetime
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

PUBLIC = Path(__file__).resolve().parents[1] / "public"
catalogue = json.loads((PUBLIC / "data/document-previews-20261120.json").read_text())
documents = catalogue["documents"]
atlas = next(doc for doc in documents if doc["url"].endswith("/Mississauga-Atlas.pdf"))
directory = Path(atlas["url"]).parent
edition = directory.name
published = datetime.strptime(edition, "edition-%Y%m%d")
study_areas = {
    "aldo-1422-study": "Lorne Park",
    "burnhamthorpe-community-centre": "Dixie and Applewood",
    "glen-erin-6719": "Meadowvale",
    "hazelhurst-business-park": "Clarkson",
    "lakeview-deco-opus": "Lakeview",
    "merner-41-bay": "Port Credit",
    "merner-42-john": "Port Credit",
    "merner-42-peter": "Port Credit",
    "south-common-community-centre": "Erin Mills",
    "square-one-block22": "Downtown",
    "st-hilarys-anglican-church": "Cooksville",
}
archive_notes = {
    "2026-11-09": "Downtown skyline studies",
    "2026-11-01": "Revised citywide cover",
    "2026-10-28": "Citywide cover study",
    "2026-10-04": "Waterfront and neighbourhood studies",
}
sections = [("city-atlas", "City atlas"), ("downtown", "Prints & film"),
            ("building-studies", "Building booklets"), ("earlier-atlases", "Earlier atlases")]


def local_file(url):
    path = PUBLIC / urlsplit(str(url)).path
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def file_size(url):
    count = local_file(url).stat().st_size
    if count < 1_000_000:
        return f"{max(1, round(count / 1_000)):,} KB"
    return f"{count / 1_000_000:.1f} MB"


def action(url, label, name, *, kind, primary=False):
    attrs = {"download": " download data-download", "preview": ' data-document-preview aria-haspopup="dialog"', "link": ""}[kind]
    arrow = "↓" if kind == "download" else "→"
    css = "dl-action dl-primary" if primary else "dl-action"
    return (f'<a class="{css}" href="{escape(str(url))}"{attrs} aria-label="{escape(name)}">'
            f'{escape(label)}<span aria-hidden="true">{arrow}</span></a>')


def image(url, width, height, *, eager=False, alt=""):
    local_file(url)
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="{escape(str(url))}" width="{width}" height="{height}" alt="{escape(alt)}" {load} decoding="async">'


def rail():
    links = "".join(f'<a href="#{key}">{escape(title)}</a>' for key, title in sections)
    return ('<nav data-reading-rail data-rail-label="Category" aria-label="Download categories">'
            f'<div data-rail-viewport><div data-rail-track>{links}</div></div></nav>')


def atlas_card():
    url = atlas["url"]
    cover = atlas["base"] + atlas["prefix"] + "01.avif"
    return (f'<section id="city-atlas" class="dl-feature" aria-labelledby="atlas-title">'
            f'<a class="dl-cover" href="{url}" data-document-preview aria-haspopup="dialog" aria-label="Open the atlas cover">'
            f'{image(cover, atlas["width"], atlas["height"], eager=True)}</a>'
            '<div class="dl-feature-copy">'
            f'<p class="dl-meta"><time datetime="{published.date()}">{published.strftime("%B %Y")}</time> · {atlas["pages"]} pages</p>'
            '<h2 id="atlas-title">Mississauga atlas</h2>'
            '<p class="dl-description">Explore the skyline, waterfront and neighbourhoods in one illustrated guide.</p>'
            '<div class="dl-actions">'
            + action(url, "Read atlas", "Read the Mississauga atlas", kind="preview", primary=True)
            + action(url, f'PDF · {file_size(url)}', "Download the complete atlas PDF", kind="download")
            + '</div></div></section>')


def print_card(scenario, title):
    stem = f"gallery/{edition}/signed/home-downtown-{scenario}"
    original = f"gallery/{edition}/originals/home-downtown-{scenario}-print.png"
    print_pdf = f"{directory}/Downtown-{scenario}-print.pdf"
    preview = f"{stem}.webp"
    local_file(preview)
    return (f'<li class="dl-media-card"><a class="dl-art" href="{preview}" data-preview-title="{escape(title)}" '
            f'data-preview-download="{original}" aria-label="Enlarge {escape(title)}" aria-haspopup="dialog">'
            f'{image(stem+"-thumb.webp", 640, 400, alt=title)}</a><div class="dl-media-copy">'
            f'<h3>{escape(title)}</h3><p>Signed print</p><div class="dl-actions">'
            + action(print_pdf, "Print PDF", f"Download {title} print PDF ({file_size(print_pdf)})", kind="download")
            + action(original, "PNG", f"Download {title} as PNG ({file_size(original)})", kind="download")
            + '</div></div></li>')


def film_card():
    info = json.loads((PUBLIC / "data/downtown-film-20261120.json").read_text())
    url = info["film"]["url"]
    return ('<li class="dl-media-card"><a class="dl-art" href="film.html" aria-label="Watch the skyline film">'
            + image(info["poster"]["url"], *info["dimensions"])
            + '<span class="dl-play" aria-hidden="true">▶</span></a><div class="dl-media-copy">'
            + f'<h3>Skyline film</h3><p>{info["durationSeconds"]}-second film</p><div class="dl-actions">'
            + action("film.html", "Watch film", "Watch the skyline film", kind="link")
            + action(url, "MP4", f"Download the skyline film as MP4 ({file_size(url)})", kind="download")
            + '</div></div></li>')


def booklet_card(doc):
    key = doc["prefix"].rstrip("-")
    thumb = f"gallery/{edition}/exteriors/{key}-front-640.webp"
    title = escape(doc["title"])
    url = escape(doc["url"])
    return (f'<li class="dl-booklet"><a class="dl-booklet-preview" href="{url}" data-document-preview '
            f'aria-haspopup="dialog" aria-label="Preview {title}">'
            f'<span class="dl-booklet-art">{image(thumb, 640, 426)}</span>'
            f'<div class="dl-booklet-copy"><span class="dl-locale">{escape(study_areas[key])}</span>'
            f'<h3 class="dl-booklet-title">{title}</h3><span class="dl-read-cue">Read booklet <span aria-hidden="true">→</span></span></div></a>'
            '<div class="dl-booklet-file">'
            + action(doc["url"], "PDF", f'Download {doc["title"]} PDF ({file_size(doc["url"])})', kind="download")
            + '</div></li>')


def earlier_editions():
    entries = []
    for doc in documents:
        url = doc["url"]
        if not url.startswith("downloads/Future-Mississauga-Atlas"):
            continue
        dated = re.search(r"Atlas-(\d{8})-[0-9a-f]+\.pdf$", url)
        if dated:
            stamp = datetime.strptime(dated[1], "%Y%m%d").date()
        elif url == "downloads/Future-Mississauga-Atlas.pdf?edition=c9f219e7094e834a":
            # This query selects the original PDF. The undated path redirects to the current edition.
            stamp = datetime.fromisoformat("2026-10-04").date()
        else:
            raise ValueError(f"Unknown archived atlas edition: {url}")
        entries.append((stamp, doc))
    rows = []
    for stamp, doc in sorted(entries, key=lambda entry: entry[0], reverse=True):
        label = f"{stamp.day} {stamp.strftime('%B %Y')}"
        note = archive_notes.get(stamp.isoformat(), "Mississauga atlas")
        url = doc["url"]
        rows.append(f'<li class="dl-edition"><div><h3><time datetime="{stamp}">{label}</time></h3>'
                    f'<p>{escape(note)}</p></div><div class="dl-actions">'
                    + action(url, "Read", f"Read the atlas from {label}", kind="preview")
                    + action(url, f'PDF · {file_size(url)}', f"Download the atlas from {label}", kind="download")
                    + '</div></li>')
    return "".join(rows)


studies = [doc for doc in documents if Path(doc["url"]).parent == directory and doc != atlas]
studies.sort(key=lambda doc: (study_areas[doc["prefix"].rstrip("-")], doc["title"]))
main = [
    '<main id="main" class="downloads-main"><header class="dl-heading"><h1>Downloads</h1></header>',
    '<div class="dl-layout">', rail(), '<div class="dl-content">', atlas_card(),
    '<section id="downtown" class="dl-section" aria-labelledby="downtown-title"><h2 id="downtown-title">Downtown prints and film</h2>',
    '<ul class="dl-media-grid">', print_card("existing", "Downtown today"),
    print_card("future", "Downtown with proposals"), film_card(), '</ul></section>',
    '<section id="building-studies" class="dl-section" aria-labelledby="studies-title"><div class="dl-section-heading">'
    '<h2 id="studies-title">Building booklets</h2><p>Two exterior views, a neighbourhood map and the sources behind each model.</p></div>',
    '<ul class="dl-booklets">', *(booklet_card(doc) for doc in studies), '</ul></section>',
    '<section id="earlier-atlases" class="dl-section" aria-labelledby="archive-title"><h2 id="archive-title">Earlier atlases</h2>',
    '<ul class="dl-editions">', earlier_editions(), '</ul></section></div></div></main>'
]
page = PUBLIC / "downloads.html"
html, count = re.subn(r'<main\b[^>]*>.*?</main>', lambda _: "\n".join(main), page.read_text(), count=1, flags=re.S)
if count != 1:
    raise ValueError("Missing downloads page content")
page.write_text(html)
