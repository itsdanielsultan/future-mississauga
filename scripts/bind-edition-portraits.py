"""Match the portrait page's plain HTML to the files in the published render edition."""
import json
import re
from html import escape, unescape
from pathlib import Path

public = Path(__file__).resolve().parents[1] / "public"
plates = {p["id"]: p for p in json.loads((public / "data/city-plates-20261120.json").read_text())["plates"]}
page = public / "social.html"

def bind(card):
    markup = card.group()
    plate = plates[re.search(r'data-plate="([^"]+)"', markup)[1]]
    if "displayMaster" not in plate or "download" not in plate:
        raise ValueError("Missing portrait originals for " + plate["id"])
    master, download = plate["displayMaster"], plate["download"]
    for path in (plate["thumbnail"], plate["webImage"], master["url"], download["url"]):
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
    scenario = unescape(re.search(r'class="media-caption__scenario">([^<]+)', markup)[1])
    title = " ".join((area, view, scenario))
    markup = re.sub(r'aria-label="Preview [^"]+"', 'aria-label="' + escape("Preview " + title) + '"', markup, count=1)
    markup = re.sub(r'aria-label="Download [^"]+"', 'aria-label="' + escape("Download " + title + " PNG") + '"', markup, count=1)
    markup = markup.replace('href="https://futuremississauga.com/sources.html"', 'href="sources.html"')

    def picture(tag):
        image = tag.group()
        for attr in ("src", "srcset", "sizes", "width", "height"):
            image = re.sub(r' ' + attr + r'="[^"]*"', '', image)
        sizes = "(max-width: 560px) calc(100vw - 32px), (max-width: 900px) 46vw, (max-width: 1440px) 30vw, 430px"
        sources = f'{plate["thumbnail"]} 512w, {plate["webImage"]} {plate["width"]}w'
        attributes = {"src":plate["thumbnail"], "width":plate["width"], "height":plate["height"], "srcset":sources, "sizes":sizes}
        return image.replace("<img", "<img" + "".join(' ' + key + '="' + escape(str(value)) + '"' for key,value in attributes.items()), 1)
    markup = re.sub(r'<img\b[^>]+>', picture, markup, count=1)
    return markup

result, count = re.subn(r'<article\b[^>]* data-plate="portraits/[^"]+".*?</article>', bind, page.read_text(), flags=re.S)
if count != sum(key.startswith("portraits/") for key in plates):
    raise ValueError(f"Matched {count} portrait cards")
page.write_text(result)
print(f"Bound {count} portrait thumbnails, full scenes and credited downloads")
