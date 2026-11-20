"""Make the two Downtown cover prints from the matching native Blender renders."""
import argparse
import hashlib
import json
import math
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas


SCENARIOS = {"existing": "Existing buildings", "future": "With proposed projects"}
LEGEND = (
    ("Existing", "#b5b6b2"),
    ("Under construction", "#82afb8"),
    ("Proposed / approved", "#d6bab0"),
    ("Uncertain", "#b498ba"),
)
PAPER = "#fcfcfb"
INK = "#252624"
MUTED = "#5b5d59"


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_scene(native, state):
    identity = f"home/downtown-{state}.png"
    matches = []
    for proof_path in native.glob(f"home-downtown-{state}*/render-proof.json"):
        record = json.loads(proof_path.read_text())
        if record.get("state") != "RENDERED_VISUAL_REVIEW_REQUIRED":
            continue
        for frame in record["images"]:
            if frame["identity"] == identity:
                matches.append((record, frame))
    if len(matches) != 1:
        raise ValueError(f"Expected one finished native render for {identity}, found {len(matches)}")
    record, frame = matches[0]
    raw = Path(frame["image"]["path"])
    if sha256(raw) != frame["image"]["sha256"]:
        raise ValueError(f"The native image differs from its render receipt: {identity}")
    return record, frame, raw


def draw_footer(image, bearing, font_dir, credit):
    unit = image.width / 2048
    def px(value):
        return round(value * unit)
    def rect(box):
        return tuple(px(number) for number in box)
    def font(name, size):
        return ImageFont.truetype(str(font_dir / name), px(size))
    regular = "Inter-Regular.ttf"
    semibold = "Inter-SemiBold.ttf"
    title = font(semibold, 34)
    small = font(regular, 16)
    fine = font(regular, 15)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(rect((32, 1082, 2016, 1248)), radius=px(4), fill=PAPER)
    draw.text(rect((69, 1108)), "Downtown", fill=INK, font=title)
    draw.text(rect((69, 1151)), "by Daniel Sultan", fill=MUTED, font=small)
    # Keep the legend optically centered in the space between the signature and north.
    widths = [20 + 12 + draw.textlength(label, font=small) / unit for label, _ in LEGEND]
    gap = 34
    left = 1210 - (sum(widths) + gap * (len(widths) - 1)) / 2
    for (label, tint), width in zip(LEGEND, widths):
        draw.rounded_rectangle(rect((left, 1137, left + 19, 1153)), radius=px(3), fill=tint)
        draw.text(rect((left + 32, 1145)), label, font=small, fill=INK, anchor="lm")
        left += width + gap
    x, y = 1953, 1140
    angle = math.radians(bearing)
    dx, dy = math.sin(angle), -math.cos(angle)
    sx, sy = -dy * 5.8, dx * 5.8
    tip = (x + 25 * dx, y + 25 * dy)
    tail = (x - 25 * dx, y - 25 * dy)
    outline = [tip, (x + sx, y + sy), tail, (x - sx, y - sy)]
    draw.polygon([rect(point) for point in outline], fill=PAPER)
    draw.polygon([rect(point) for point in (tip, (x + sx, y + sy), tail)], fill=INK)
    draw.line([rect(point) for point in outline + [tip]], fill=INK, width=max(1, px(1)))
    draw.text(rect((x + 41 * dx, y + 41 * dy)), "N", fill=INK, font=fine, anchor="mm")
    draw.line([rect((69, 1189)), rect((1979, 1189))], fill="#d6d7d4", width=px(1))
    draw.text(rect((69, 1218)), credit, fill=MUTED, font=fine, anchor="lm")
    draw.text(rect((1979, 1218)), "futuremississauga.com/sources.html", fill=MUTED, font=fine, anchor="rm")


def publish(state, scene, caption, font_dir, temporary):
    proof, frame, raw = scene
    bearing = float(frame["north"]["bearingClockwiseFromScreenUpDegrees"])
    with Image.open(raw) as source:
        if source.size != (6144, 3840):
            raise ValueError(f"Unexpected camera frame for {state}: {source.size}")
        background = proof["background"]
        if isinstance(background, list):
            background = tuple(background)
        composite = Image.new("RGBA", source.size, background)
        composite.alpha_composite(source.convert("RGBA"))
        image = composite.convert("RGB")
    credit = caption.get("cityCredit") or "City of Mississauga"
    if caption.get("openStreetMap"):
        credit += " · © OpenStreetMap contributors"
    draw_footer(image, bearing, font_dir, credit)
    credits = list(dict.fromkeys(caption.get("fullCredits", []) + caption.get("requiredModelCredits", [])))
    stem = f"home-{state}"
    title = f"Downtown Mississauga · {SCENARIOS[state]}"
    metadata = PngImagePlugin.PngInfo()
    for key, value in {"Title": title, "Author": "Daniel Sultan", "Sources": "\n".join(credits),
                       "Native image SHA-256": frame["image"]["sha256"],
                       "Rendered": frame["renderCompletedUTC"]}.items():
        metadata.add_itxt(key, value)
    image.save(temporary / f"{stem}.png", pnginfo=metadata, compress_level=6)
    for width in (1200, 2560):
        preview = image.resize((width, width * 5 // 8), Image.Resampling.LANCZOS)
        preview.save(temporary / f"{stem}-{width}.webp", quality=93, method=5)
    jpeg = BytesIO()
    image.save(jpeg, "JPEG", quality=94, subsampling=0)
    jpeg.seek(0)
    pdf = Canvas(str(temporary / f"Downtown-{state}-print.pdf"), pagesize=(1152, 720))
    pdf.setTitle(title)
    pdf.setAuthor("Daniel Sultan")
    pdf.setSubject("\n".join(credits))
    pdf.drawImage(ImageReader(jpeg), 0, 0, 1152, 720)
    pdf.showPage()
    pdf.save()
    return {"scenario": state, "renderedUTC": frame["renderCompletedUTC"],
            "nativeSHA256": frame["image"]["sha256"], "north": bearing, "sourceCredits": credits}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native", type=Path, help="Folder containing the two cover-render receipts")
    parser.add_argument("selected", type=Path, help="Previously verified city view and attribution register")
    parser.add_argument("--public", type=Path, default=Path(__file__).resolve().parents[1] / "public")
    parser.add_argument("--fonts", type=Path, default=Path.home() / "Library/Fonts")
    args = parser.parse_args()
    scenes = {state: read_scene(args.native, state) for state in SCENARIOS}
    north = [float(frame["north"]["bearingClockwiseFromScreenUpDegrees"]) for _, frame, _ in scenes.values()]
    if abs((north[0] - north[1] + 180) % 360 - 180) > 0.01:
        raise ValueError("The two cover renders use different north bearings")
    captions = {row["id"]: row["caption"] for row in json.loads(args.selected.read_text())}
    gallery = args.public / "gallery/edition-20261120"
    downloads = args.public / "downloads/edition-20261120"
    gallery.mkdir(parents=True, exist_ok=True)
    downloads.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.public.parent) as tmp:
        temp = Path(tmp)
        frames = []
        for key, scene in scenes.items():
            frames.append(publish(key, scene, captions[f"wide/downtown-{key}.png"], args.fonts, temp))
        (temp / "downtown-cover.json").write_text(json.dumps(frames, ensure_ascii=False, indent=2) + "\n")
        for p in temp.iterdir():
            p.replace((downloads if p.suffix == ".pdf" else gallery) / p.name)


if __name__ == "__main__":
    main()
