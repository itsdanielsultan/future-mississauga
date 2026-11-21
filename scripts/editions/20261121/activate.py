"""Point the website's current views at the verified 21 November edition.

Run after the native media, documents and section pictures are generated. Dated
catalogues, immutable objects, previously issued PDFs and their page images stay
at their original addresses. The downloads generator adds the last atlas to the archive.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "public"
PREVIOUS = "20261120"
CURRENT = "20261121"

# These are active consumers, distinct from dated receipts in scripts/editions.
BUILDERS = (
    "build-area-pages.py", "build-building-pages.py", "bind-edition-portraits.py",
    "build_study_directories.py", "build-downloads.py", "build-edition-shares.py",
    "build-update-pages.py", "validate-picture-media.mjs",
)
LIVE_DATA = ("building-features.json", "building-catalogue.json", "directory-pictures.json")

def change_edition(text: str) -> str:
    for prefix in ("edition-", "city-plates-", "document-previews-", "document-page-text-", "downtown-film-"):
        text = text.replace(prefix + PREVIOUS, prefix + CURRENT)
    return text

def files_to_update():
    for path in sorted(PUBLIC.glob("*.html")):
        # The dated journal ledger retains links to original print editions.
        if not re.fullmatch(r"update-\d{4}-\d{2}-\d{2}\.html", path.name):
            yield path
    yield from sorted(PUBLIC.glob("*.js"))
    yield from (PUBLIC / "data" / name for name in LIVE_DATA)
    yield from (ROOT / "scripts" / name for name in BUILDERS)
    yield ROOT / "scripts/editions/updates/days.json"

def patch(path: Path, text: str) -> str:
    if path.name == "downloads.html":
        # The archive list may already contain the previous edition.
        before, marker, archive = text.partition('<section id="earlier-atlases"')
        if marker:
            archived, end, footer = archive.partition("</main>")
            return change_edition(before) + marker + archived + end + change_edition(footer)
    changed = change_edition(text)
    if path.name == "days.json":
        days = json.loads(changed)
        previous_day = next(day for day in days if day["date"] == "2026-11-20")
        old_print = f"downloads/edition-{PREVIOUS}/Mississauga-Atlas.pdf"
        previous_day["links"] = [
            {"label":"Read the 20 November atlas", "url":old_print, "preview":True}
            if link["url"] == "downloads.html" or link["label"] == "Read the 20 November atlas"
            else link for link in previous_day["links"]
        ]
        for record in previous_day.get("records", []):
            if "wide-downtown-skyline-construction" in record.get("thumbnail", ""):
                record["caption"] = "Current rendering of construction near Square One, by Daniel Sultan."
                historical = f"gallery/edition-{PREVIOUS}/originals/wide-downtown-skyline-construction-print.png"
                record["links"] = [link for link in record.get("links", []) if link["label"] != "Original 20 November image"]
                record["links"].append({"label": "Original 20 November image", "url": historical})
        changed = json.dumps(days, ensure_ascii=False, indent=2) + "\n"
    if path.name == "build-downloads.py":
        changed = changed.replace(f'default="{PREVIOUS}"', f'default="{CURRENT}"')
    return changed

def bind_profiles(text):
    profiles = json.loads(text)
    for key, profile in profiles.items():
        for field in ("displayImage", "cardImage"):
            asset = profile[field]
            path = PUBLIC / asset["url"]
            if f"/edition-{CURRENT}/" not in asset["url"] or not path.is_file():
                raise ValueError(f"{key} is missing its new {field} at {asset['url']}")
            asset["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    return json.dumps(profiles, ensure_ascii=False, indent=2) + "\n"

def bind_catalogue(text, pictures):
    catalogue = json.loads(text)
    profiles = json.loads(change_edition((PUBLIC/'data/building-features.json').read_text()))
    current = {row['id']: row for row in pictures['entries']}
    for entry in catalogue['entries']:
        key = entry['id']
        if key in profiles:
            card = dict(profiles[key]['cardImage'])
            card['sha256'] = hashlib.sha256((PUBLIC/card['url']).read_bytes()).hexdigest()
            entry.update(image=card, imageKind='study', imageLabel='Detailed building model')
        elif key in current:
            picture = current[key]
            entry.update(image=picture['image'], imageKind=picture['kind'], imageLabel=picture['label'])
    return json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n"

def bind_sources(text, city, atlas):
    """Use measured dimensions and credit-bearing imagery even before JS loads."""
    by_id = {plate["id"]: plate for plate in city["plates"]}

    def bind_card(match):
        card = match.group()
        identity = re.search(r'data-edition-plate="([^"]+)"', card).group(1)
        plate = by_id[identity]
        thumb, preview = plate["signedThumbnail"], plate["signedPreview"]
        card = re.sub(r'(<a class="source-card-image" href=")[^"]+', lambda m: m[1] + plate["signedMaster"]["url"], card, count=1)
        image = re.search(r"<img\b[^>]+>", card).group()
        attrs = {
            "src": thumb["url"],
            "srcset": f'{thumb["url"]} {thumb["width"]}w, {preview["url"]} {preview["width"]}w',
            "width": str(preview["width"]),
            "height": str(preview["height"]),
        }
        bound = image
        for key, value in attrs.items():
            bound = re.sub(rf' {key}="[^"]*"', lambda _: f' {key}="{value}"', bound)
        return card.replace(image, bound, 1)

    text, cards = re.subn(r'<article class="source-card update-story"[^>]*>[\s\S]*?</article>', bind_card, text)
    if cards != 2:
        raise ValueError("Check the number of signed picture cards on Sources.")
    text = re.sub(r'(<strong>Downtown aerial</strong> · )\d+ November 2026', r'\g<1>21 November 2026', text)
    return re.sub(r'(<img src="[^"]*/atlas-01\.avif" )width="\d+" height="\d+"',
                  lambda m: m[1] + f'width="{atlas["width"]}" height="{atlas["height"]}"', text)

def check_ready():
    city = json.loads((PUBLIC / f"data/city-plates-{CURRENT}.json").read_text())
    for plate in city["plates"]:
        for asset in ("download", "displayMaster", "signedPreview", "signedThumbnail"):
            record = plate.get(asset)
            if record:
                full = PUBLIC / urlsplit(record["url"]).path
                if f"edition-{CURRENT}/" not in record["url"] or not full.is_file():
                    raise ValueError(f"{plate['id']} has no current {asset}: {full}")
    docs = json.loads((PUBLIC / f"data/document-previews-{CURRENT}.json").read_text())["documents"]
    for edition in [PREVIOUS, CURRENT]:
        base = f"downloads/edition-{edition}/"
        titles = [d for d in docs if d["url"].startswith(base)]
        if len([d for d in titles if d["url"].endswith("-review.pdf")]) != 11:
            raise ValueError(f"Expected eleven building booklets for {edition}")
        for doc in titles:
            if not (PUBLIC / urlsplit(doc["url"]).path).is_file():
                raise ValueError(f"Missing PDF {doc['url']}")
        if not any(d["url"] == base + "Mississauga-Atlas.pdf" and d["pages"] == 56 for d in titles):
            raise ValueError(f"Missing 56-page atlas for {edition}")
    for stage in ("existing","construction","future"):
        for rel in [f"downloads/edition-{CURRENT}/Downtown-{stage}-print.pdf",
                    f"gallery/edition-{CURRENT}/originals/home-downtown-{stage}-print.png"]:
            if not (PUBLIC / rel).is_file():
                raise ValueError(f"Missing signed stage file {rel}")
    film = json.loads((PUBLIC / f"data/downtown-film-{CURRENT}.json").read_text())
    for key in ("film","poster"):
        if f"edition-{CURRENT}/" not in film[key]["url"] or not (PUBLIC / film[key]["url"]).is_file():
            raise ValueError(f"Missing new skyline {key}")

def refresh_cover_aliases():
    """Keep saved, undated Downtown PNG, WebP and poster PDF links current."""
    gallery = PUBLIC / f"gallery/edition-{CURRENT}"
    downloads = PUBLIC / "downloads"
    pairs = []
    for stage in ("existing", "construction", "future"):
        base = PUBLIC / "gallery/city-plates" / f"downtown-{stage}"
        pairs.append((gallery / f"originals/home-downtown-{stage}-print.png", base.with_suffix(".png")))
        for width in (1200, 2560):
            pairs.append((gallery / f"home-{stage}-{width}.webp", base.with_name(f"{base.name}-{width}.webp")))
        suffix = "" if stage == "future" else f"-{stage}"
        pairs.append((downloads / f"edition-{CURRENT}/Downtown-{stage}-print.pdf",
                      downloads / f"Downtown-Mississauga{suffix}-print.pdf"))
    for source, _ in pairs:
        if not source.is_file():
            raise FileNotFoundError(source)
    for source, target in pairs:
        if target.exists() and source.samefile(target):
            continue
        temporary = target.with_name(target.name + ".edition.tmp")
        temporary.unlink(missing_ok=True)
        os.link(source, temporary)
        temporary.replace(target)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.apply:
        check_ready()
        pictures = json.loads((PUBLIC/f'data/directory-pictures-{CURRENT}.json').read_text())
        for row in pictures['entries']:
            asset = row['image']
            if hashlib.sha256((PUBLIC/asset['url']).read_bytes()).hexdigest() != asset['sha256']:
                raise ValueError('Research thumbnail has changed for ' + row['id'])
    changes = []
    for path in files_to_update():
        source = path.read_text()
        result = patch(path, source)
        if args.apply and path.name == "building-features.json":
            result = bind_profiles(result)
        elif args.apply and path.name == "building-catalogue.json":
            result = bind_catalogue(result, pictures)
        elif args.apply and path.name == "directory-pictures.json":
            result = json.dumps(pictures, ensure_ascii=False, indent=2) + "\n"
        elif args.apply and path.name == "sources.html":
            city = json.loads((PUBLIC/f"data/city-plates-{CURRENT}.json").read_text())
            docs = json.loads((PUBLIC/f"data/document-previews-{CURRENT}.json").read_text())["documents"]
            atlas = next(doc for doc in docs if doc["url"] == f"downloads/edition-{CURRENT}/Mississauga-Atlas.pdf")
            result = bind_sources(result, city, atlas)
        if source != result:
            changes.append((path, result))
    if args.apply:
        refresh_cover_aliases()
        for path, result in changes:
            temp = path.with_name(path.name + ".edition.tmp")
            temp.write_text(result)
            temp.replace(path)
        subprocess.run(["node",str(ROOT / "scripts/build-gallery.mjs"),"--edition",CURRENT],check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts/build-update-pages.py")], check=True)
    print(f"{len(changes)} active site and builder files " + ("updated" if args.apply else "would change"))

if __name__ == "__main__":
    main()
