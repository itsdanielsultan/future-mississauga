"""Update each current browser-readable document from its corresponding print PDF."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import fitz
from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / "public"
CATALOGUE = PUBLIC / "data/document-previews-20261120.json"
PAGE_TEXT = PUBLIC / "document-page-text-20261120.txt"


def write_atomic(path, content):
    temp = path.with_suffix(".tmp")
    temp.write_bytes(content)
    temp.replace(path)


def rebuild(document, force):
    source = PUBLIC / document["url"]
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    checksum = digest.hexdigest()
    output = PUBLIC / document["base"]
    output.mkdir(parents=True, exist_ok=True)
    rebuild_all = force or document.get("sourceSHA256") != checksum
    texts = []
    first_dimensions = None
    with fitz.open(source) as pdf:
        for index, page in enumerate(pdf):
            destination = output / f'{document["prefix"]}{index + 1:02}.avif'
            if rebuild_all or not destination.is_file():
                scale = 1200 / page.rect.width
                pixels = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                image = Image.frombytes("RGB", (pixels.width, pixels.height), pixels.samples)
                temp = destination.with_suffix(".tmp")
                image.save(temp, "AVIF", quality=72, speed=8, max_threads=2)
                temp.replace(destination)
            with Image.open(destination) as preview:
                dimensions = preview.size
                if first_dimensions is not None and dimensions != first_dimensions:
                    raise ValueError(f'Mixed page sizes in {source.name}')
                first_dimensions = dimensions
            text = page.get_text().strip()
            if not text:
                raise ValueError(f'Missing accessible text on page {index + 1} of {source.name}')
            texts.append(text)
    if first_dimensions is None:
        raise ValueError(f"No pages in {source.name}")
    document.update(sourceSHA256=checksum, pages=len(texts), width=first_dimensions[0], height=first_dimensions[1])
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
    parser.add_argument("--force", action="store_true", help="Regenerate previews even if the source hash matches")
    args = parser.parse_args()
    catalogue = json.loads(CATALOGUE.read_text())
    texts = json.loads(gzip.decompress(base64.b64decode(PAGE_TEXT.read_bytes())))
    selected = set(args.titles)
    current = {doc["prefix"].rstrip("-"): index for index, doc in enumerate(catalogue["documents"])
               if doc.get("base") == "document-previews/edition-20261120/"}
    if selected - current.keys():
        parser.error("Unknown document ID: " + ", ".join(sorted(selected - current.keys())))
    for name, index in current.items():
        if not selected or name in selected:
            texts[index] = rebuild(catalogue["documents"][index], args.force)
            print(f'{name}: {len(texts[index])} pages', flush=True)
    write_atomic(CATALOGUE, (json.dumps(catalogue, indent=2) + "\n").encode())
    write_atomic(PAGE_TEXT, base64.b64encode(gzip.compress(json.dumps(texts, ensure_ascii=False).encode(), mtime=0)))


if __name__ == "__main__":
    main()
