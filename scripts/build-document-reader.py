"""Update each current browser-readable document from its corresponding print PDF."""
import argparse
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

import fitz
from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / "public"


def write_atomic(path, content):
    temp = path.with_suffix(".tmp")
    temp.write_bytes(content)
    temp.replace(path)


def preview_page(page, destination, width, quality):
    scale = width / page.rect.width
    pixels = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = Image.frombytes("RGB", (pixels.width, pixels.height), pixels.samples)
    temp = destination.with_suffix(".tmp")
    image.save(temp, "AVIF", quality=quality, speed=9, max_threads=2)
    temp.replace(destination)


def rebuild(document, force):
    source = PUBLIC / document["url"]
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    checksum = digest.hexdigest()
    output = PUBLIC / document["base"]
    output.mkdir(parents=True, exist_ok=True)
    detail = output / 'zoom'
    detail.mkdir(exist_ok=True)
    rebuild_all = force or document.get("sourceSHA256") != checksum
    texts = []
    first_dimensions = None
    page_links = {}
    with fitz.open(source) as pdf:
        for index, page in enumerate(pdf):
            destination = output / f'{document["prefix"]}{index + 1:02}.avif'
            if rebuild_all or not destination.is_file():
                preview_page(page, destination, 1200, 74)
            zoom_page = detail / destination.name
            if rebuild_all or not zoom_page.is_file():
                preview_page(page, zoom_page, 2880, 84)
            with Image.open(destination) as preview:
                dimensions = preview.size
                if first_dimensions is not None and dimensions != first_dimensions:
                    raise ValueError(f'Mixed page sizes in {source.name}')
                first_dimensions = dimensions
            text = page.get_text().strip()
            if not text:
                raise ValueError(f'Missing accessible text on page {index + 1} of {source.name}')
            texts.append(text)
            links = []
            for link in page.get_links():
                rect = link['from'] & page.rect
                if rect.is_empty:
                    continue
                if link['kind'] == fitz.LINK_GOTO and 0 <= link.get('page', -1) < len(pdf):
                    target = {'page': link['page'] + 1}
                elif link['kind'] == fitz.LINK_NAMED and str(link.get('page', '')).isdigit() and 1 <= int(link['page']) <= len(pdf):
                    # ReportLab's Fit destination is a named action with a one-based page.
                    target = {'page': int(link['page'])}
                elif link['kind'] == fitz.LINK_URI and link.get('uri', '').startswith(('https://', 'http://')):
                    label = ' '.join(page.get_textbox(rect).split()) or 'Open the accompanying study'
                    target = {'url': link['uri'], 'label': label[:120]}
                else:
                    continue
                target['bounds'] = [round(v, 6) for v in (
                    rect.x0/page.rect.width, rect.y0/page.rect.height,
                    rect.width/page.rect.width, rect.height/page.rect.height)]
                links.append(target)
            if links:
                page_links[str(index + 1)] = links
    if first_dimensions is None:
        raise ValueError(f"No pages in {source.name}")
    document.update(sourceSHA256=checksum, pages=len(texts), width=first_dimensions[0], height=first_dimensions[1],
                    zoomBase=document["base"].rstrip("/") + "/zoom/", zoomWidth=2880, pageLinks=page_links)
    if document["prefix"] == "atlas-":
        sections = []
        for number, text in enumerate(texts, 1):
            heading = text.splitlines()[0].strip()
            if not sections or sections[-1]["label"] != heading:
                sections.append({"page": number, "label": heading})
        document["pageSections"] = sections
    return texts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("titles", nargs="*", help="Optional document IDs such as atlas or merner-41-bay")
    parser.add_argument("--edition", default="20261120")
    parser.add_argument("--previous-edition", help="Carry forward the earlier catalogue, including its PDF links and page text")
    parser.add_argument("--force", action="store_true", help="Regenerate previews even if the source hash matches")
    args = parser.parse_args()
    target_catalogue = PUBLIC / f"data/document-previews-{args.edition}.json"
    target_text = PUBLIC / f"document-page-text-{args.edition}.txt"
    source_edition = args.previous_edition if not target_catalogue.exists() else args.edition
    if not source_edition:
        parser.error("Supply --previous-edition when building a successor reader for the first time")
    source_catalogue = PUBLIC / f"data/document-previews-{source_edition}.json"
    source_text = PUBLIC / f"document-page-text-{source_edition}.txt"
    catalogue = json.loads(source_catalogue.read_text())
    texts = json.loads(gzip.decompress(base64.b64decode(source_text.read_bytes())))
    if len(texts) != len(catalogue["documents"]):
        raise ValueError("The prior reader catalogue and accessible page text have different lengths")
    edition_base = f"document-previews/edition-{args.edition}/"
    if source_edition != args.edition:
        if args.titles:
            parser.error("The first build of a successor reader must include every current document")
        earlier = [doc for doc in catalogue["documents"] if doc.get("base") == f"document-previews/edition-{source_edition}/"]
        if not earlier:
            raise ValueError("The earlier edition has no registered current documents")
        for prior in earlier:
            catalogue["documents"].append(dict(title=prior["title"], prefix=prior["prefix"], base=edition_base,
                                               url=f'downloads/edition-{args.edition}/' + Path(prior["url"]).name))
            texts.append([])
    selected = set(args.titles)
    current = {doc["prefix"].rstrip("-"): index for index, doc in enumerate(catalogue["documents"])
               if doc.get("base") == edition_base}
    if selected - current.keys():
        parser.error("Unknown document ID: " + ", ".join(sorted(selected - current.keys())))
    for name, index in current.items():
        if not selected or name in selected:
            texts[index] = rebuild(catalogue["documents"][index], args.force)
            print(f'{name}: {len(texts[index])} pages', flush=True)
    write_atomic(target_catalogue, (json.dumps(catalogue, indent=2) + "\n").encode())
    write_atomic(target_text, base64.b64encode(gzip.compress(json.dumps(texts, ensure_ascii=False).encode(), mtime=0)))
    if 'atlas' in current and (not selected or 'atlas' in selected):
        atlas = catalogue['documents'][current['atlas']]
        sources = PUBLIC / 'sources.html'
        updated, count = re.subn(r'(<h3>Picture atlas</h3>\s*<p>)\d+( pages · PDF</p>)',
                                 lambda match: match[1] + str(atlas['pages']) + match[2], sources.read_text())
        if count == 1:
            write_atomic(sources, updated.encode())


if __name__ == "__main__":
    main()
