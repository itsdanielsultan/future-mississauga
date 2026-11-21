"""Build the 12-second, signed Downtown film from the three matched Blender views."""
import argparse
from datetime import datetime
import hashlib
from io import BytesIO
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
    parser.add_argument('--edition', default='20261120')
    args = parser.parse_args()
    date = datetime.strptime(args.edition, '%Y%m%d')
    work = args.workspace.resolve()
    public = Path(__file__).resolve().parents[3] / 'public'
    target = public / 'gallery' / ('edition-' + args.edition)
    local = work / 'film'
    local.mkdir(exist_ok=True)
    fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
    face = ImageFont.truetype(str(fonts / 'Inter-SemiBold.ttf'), 23)

    inputs = []
    native_cameras = []
    credits = []
    sources = []
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
        signed = public / receipt['download']['url']
        signed_bytes = signed.read_bytes()
        signed_digest = hashlib.sha256(signed_bytes).hexdigest()
        if signed_digest != receipt['download']['sha256']:
            raise ValueError('Signed plate bytes differ from their receipt.')
        sources.append(dict(stage=stage, sceneSHA256=native['sourceGLB']['sha256'],
                            nativeSHA256=frame['image']['sha256'], signedSHA256=signed_digest))
        with Image.open(BytesIO(signed_bytes)) as plate:
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
            poster = local / 'Downtown-film-poster.webp'
            image.save(poster, format='WEBP', quality=92, method=5)
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
    metadata = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','stream=width,height,nb_frames,r_frame_rate:format=duration','-of','json',str(output)]))
    stream = metadata['streams'][0]
    if ((stream['width'],stream['height']) != SIZE or int(stream['nb_frames']) != 288 or
            stream['r_frame_rate'] != '24/1' or float(metadata['format']['duration']) != 12):
        raise ValueError('Unexpected final skyline film dimensions or timing.')
    credit_file = local / 'Downtown-film-credits.txt'
    credit_file.write_text(
        f'Downtown · by Daniel Sultan\n{date.day} {date:%B %Y}\n\n'
        'Three matched oblique views of the verified Downtown scenes.\n\n' +
        '\n'.join(dict.fromkeys(credits)) + '\n')
    for source in sources:
        stem = 'wide-downtown-skyline-' + source['stage']
        current = json.loads((work / 'original-receipts' / (stem + '.json')).read_text())['download']
        if (current['sha256'] != source['signedSHA256'] or
                hashlib.sha256((public / current['url']).read_bytes()).hexdigest() != source['signedSHA256']):
            raise ValueError('Signed artwork changed during the encode: ' + stem)
    output.replace(target / 'Downtown-film.mp4')
    poster.replace(target / poster.name)
    credit_file.replace(target / credit_file.name)
    receipt = dict(edition=args.edition, frames=sources, dimensions=list(SIZE), durationSeconds=12,
                   frameCount=288, filmSHA256=hashlib.sha256((target/'Downtown-film.mp4').read_bytes()).hexdigest())
    (local/'final-encoding.json').write_text(json.dumps(receipt, indent=2)+'\n')


if __name__ == '__main__':
    main()
