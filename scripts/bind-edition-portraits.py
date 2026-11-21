"""Match the portrait page's plain HTML to the files in the published render edition."""
import json
import re
from html import escape, unescape
from pathlib import Path

public = Path(__file__).resolve().parents[1] / "public"
plates = {p["id"]: p for p in json.loads((public / "data/city-plates-20261121.json").read_text())["plates"]}
page = public / "social.html"

def bind(card):
    markup = card.group()
    plate = plates[re.search(r'data-plate="([^"]+)"', markup)[1]]
    named = {"portraits/downtown-landmark-future.png":"Absolute World towers","portraits/downtown-junction-future.png":"Hurontario Street at Highway 403"}
    if plate["id"] in named:
        markup = re.sub(r'data-view-title="[^"]+"','data-view-title="'+named[plate["id"]]+'"',markup)
    if "displayMaster" not in plate or "download" not in plate:
        raise ValueError("Missing portrait originals for " + plate["id"])
    master, download = plate.get("signedMaster",plate["displayMaster"]), plate["download"]
    small=plate.get("signedThumbnail",{"url":plate["thumbnail"],"width":512})
    large=plate.get("signedPreview",{"url":plate["webImage"],"width":plate["width"],"height":plate["height"]})
    for path in (small["url"], large["url"], master["url"], download["url"]):
        if not (public / path).is_file():
            raise FileNotFoundError(path)
    # The earlier metadata entry contains the model-specific rights and source credits.
    if ' data-original-thumb="' not in markup:
        original = re.search(r'<img\b[^>]*? src="([^"]+)"', markup)[1]
        markup = markup.replace("<article ", '<article data-original-thumb="' + original + '" ', 1)
    for key, value in (("url", master["url"]), ("width", master["width"]), ("height", master["height"])):
        markup = re.sub(r'data-display-' + key + r'="[^"]+"', 'data-display-' + key + '="' + escape(str(value)) + '"', markup, count=1)
    markup = re.sub(r'(<a class="image-link" href=")[^"]+', lambda m: m[1] + escape(master["url"]), markup, count=1)
    markup = re.sub(r'(<a class="save ui-button" href=")[^"]+', lambda m: m[1] + escape(download["url"]), markup, count=1)
    area = unescape(re.search(r'data-area-title="([^"]+)"', markup)[1])
    view = unescape(re.search(r'data-view-title="([^"]+)"', markup)[1])
    scenario = "Under construction" if "-construction" in plate["id"] else "Existing buildings" if "-existing" in plate["id"] else "With proposals"
    primary = area if view.lower() in ("neighbourhood perspective","wide aerial","closer view","skyline","existing skyline","dated construction skyline","construction snapshot") else view
    detail = scenario if primary == area else area + " · " + scenario
    title = " · ".join((area, view, scenario))
    summary = '<div class="card-copy media-caption"><h3>' + escape(primary) + '</h3><span class="media-caption__scenario">' + escape(detail) + '</span></div>'
    markup = re.sub(r'<div class="card-copy[^"]*">.*?</div>',lambda _: summary,markup,count=1)
    markup = re.sub(r'aria-label="Preview [^"]+"', 'aria-label="' + escape("Preview " + title) + '"', markup, count=1)
    markup = re.sub(r'aria-label="Download [^"]+"', 'aria-label="' + escape("Download " + title + " PNG") + '"', markup, count=1)
    edge = max(download["width"], download["height"])
    # Match the gallery's half-K display. The tooltip always gives exact pixels.
    size = f"{int(edge / 512 + .5) / 2:g}K" if edge >= 1024 else f"{edge} px"
    markup = re.sub(r' data-resolution="[^"]*"', '', markup, count=1)
    markup = re.sub(r'title="Download [^"]+"', f'data-resolution="{size}" title="Download signed PNG ({download["width"]} × {download["height"]})"', markup, count=1)
    markup = markup.replace('href="https://futuremississauga.com/sources.html"', 'href="sources.html"')

    def picture(tag):
        image = tag.group()
        for attr in ("src", "srcset", "sizes", "width", "height"):
            image = re.sub(r' ' + attr + r'="[^"]*"', '', image)
        sizes = "(max-width: 560px) calc(100vw - 32px), (max-width: 900px) 46vw, (max-width: 1440px) 30vw, 430px"
        sources = f'{small["url"]} {small["width"]}w, {large["url"]} {large["width"]}w'
        attributes = {"src":small["url"], "width":large["width"], "height":large["height"], "srcset":sources, "sizes":sizes}
        return image.replace("<img", "<img" + "".join(' ' + key + '="' + escape(str(value)) + '"' for key,value in attributes.items()), 1)
    markup = re.sub(r'<img\b[^>]+>', picture, markup, count=1)
    return markup

result, count = re.subn(r'<article\b[^>]* data-plate="portraits/[^"]+".*?</article>', bind, page.read_text(), flags=re.S)
if count != sum(key.startswith("portraits/") for key in plates):
    raise ValueError(f"Matched {count} portrait cards")
if '<div class="portrait-results">' not in result:
    result = result.replace('<section class="portrait-collection">','<div class="portrait-results"><section class="portrait-collection">',1)
    result = result.replace('<section class="social-context"', '</div><section class="social-context"',1)
# The signed originals carry the notices, and the site footer links the map credit.
result = re.sub(r'<section class="social-context"[^>]*>.*?</section>', '', result, count=1, flags=re.S)
page.write_text(result)
print(f"Bound {count} portrait thumbnails, full scenes and credited downloads")
