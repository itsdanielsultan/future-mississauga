"""Inset caption for Daniel's published architectural renders."""
from pathlib import Path
import os
from PIL import Image, ImageDraw, ImageFont


def signed_plate(image, title, byline='by Daniel Sultan', reference=''):
    width, height = image.size
    factor = width / 1800
    footer = round((156 if reference else 118) * factor)
    rail = round(25 * factor)
    padding = round(24 * factor)
    art_height = height - footer
    scene = image.copy()
    scene.thumbnail((width, art_height), Image.Resampling.LANCZOS)
    plate = Image.new('RGB', image.size, image.getpixel((0, 0)))
    plate.paste(scene, ((width - scene.width)//2, 0))
    draw = ImageDraw.Draw(plate)
    x, y = rail + padding, height - footer + padding // 2
    draw.rounded_rectangle((rail, height - footer, width - rail, height - rail), radius=round(9*factor), fill='#fdfdfc')
    fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home()/'Library/Fonts'))
    heading = ImageFont.truetype(str(fonts/'Inter-SemiBold.ttf'), round(31 * factor))
    body = ImageFont.truetype(str(fonts/'Inter-Regular.ttf'), round(22 * factor))
    draw.text((x, y), title, font=heading, fill='#242627')
    draw.text((x, y + round(42 * factor)), byline, font=body, fill='#4c5050')
    if reference:
        source_font = ImageFont.truetype(str(fonts/'Inter-Regular.ttf'), round(17 * factor))
        lines = ['']
        for word in reference.split():
            trial = (lines[-1]+' '+word).strip()
            if draw.textlength(trial, font=source_font) > (width - 2*x):
                lines.append(word)
            else:
                lines[-1] = trial
        if len(lines) > 2:
            raise ValueError('Study credit exceeds the inset footer: '+title)
        for i,line in enumerate(lines):
            draw.text((x, y + round((79 + 19*i)*factor)), line, font=source_font, fill='#535958')
    return plate
