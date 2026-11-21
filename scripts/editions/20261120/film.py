"""Build the 12-second, signed Downtown film from the three matched Blender views."""
import argparse
import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

STAGES = [('existing', 'Existing buildings'), ('construction', 'Under construction'),
          ('future', 'With proposed projects')]
SIZE = (1920, 1080)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace', type=Path)
    work = parser.parse_args().workspace.resolve()
    public = Path(__file__).resolve().parents[3] / 'public'
    target = public / 'gallery/edition-20261120'
    local = work / 'film'
    local.mkdir(exist_ok=True)
    fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
    face = ImageFont.truetype(str(fonts / 'Inter-SemiBold.ttf'), 23)

    inputs = []
    native_cameras = []
    credits = []
    for stage, label in STAGES:
        stem = 'wide-downtown-skyline-' + stage
        native = json.loads((work / 'native' / stem / 'render-proof.json').read_text())
        frame = native['images'][0]
        if frame['dimensions'][0] * SIZE[1] != frame['dimensions'][1] * SIZE[0]:
            raise ValueError('Film inputs must have the approved 16:9 camera frame.')
        native_cameras.append(frame['camera'])
        receipt = json.loads((work / 'original-receipts' / (stem + '.json')).read_text())
        if receipt['sourceSHA256'] != frame['image']['sha256']:
            raise ValueError('Signed plate is from a different Blender render.')
        with Image.open(public / receipt['download']['url']) as plate:
            if not plate.info.get('Author', '').startswith('Daniel Sultan'):
                raise ValueError('Film requires signed artwork.')
            credit = plate.info.get('Description', '')
            credits.extend(line for line in credit.splitlines() if line)
            image = plate.convert('RGB').resize(SIZE, Image.Resampling.LANCZOS)
        # Place the chapter caption between the signature and the map key.
        film_draw = ImageDraw.Draw(image)
        film_draw.text((330, 979), label, font=face, anchor='lm', fill='#333537')
        png = local / (stage + '.png')
        image.save(png, compress_level=2)
        inputs.extend(['-loop', '1', '-framerate', '24', '-t', '4.30', '-i', str(png)])
        if stage == 'existing':
            poster = target / 'Downtown-film-poster.webp'
            temp = poster.with_suffix('.writing')
            image.save(temp, format='WEBP', quality=92, method=5)
            temp.replace(poster)
    if native_cameras[1:] != native_cameras[:-1]:
        raise ValueError('The three stages must share one camera.')
    output = local / 'Downtown-film-final.mp4'
    filters = ('[0:v][1:v]xfade=transition=fade:duration=0.25:offset=3.75[step2];'
               '[step2][2:v]xfade=transition=fade:duration=0.25:offset=7.75,'
               'trim=duration=12,format=yuv420p[out]')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs,
                    '-filter_complex', filters, '-map', '[out]', '-frames:v', '288',
                    '-an', '-c:v', 'libx264', '-threads', '4', '-crf', '17', '-movflags',
                    '+faststart', str(output)], check=True)
    output.replace(target / 'Downtown-film.mp4')
    (target / 'Downtown-film-credits.txt').write_text(
        'Downtown · by Daniel Sultan\n20 November 2026\n\n'
        'Three matched oblique views of the verified Downtown scenes.\n\n' +
        '\n'.join(dict.fromkeys(credits)) + '\n')


if __name__ == '__main__':
    main()
