from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, subprocess
import argparse, os
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
work = parser.parse_args().workspace.resolve()
public = Path(__file__).resolve().parents[3] / 'public'
fonts = Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts'))
p = work
target = public / 'gallery/edition-20261120'
local = p / 'film'
local.mkdir(exist_ok=True)
target.mkdir(parents=True, exist_ok=True)
stages = ['existing', 'construction', 'future']
labels = ['Existing buildings', 'Under construction', 'With proposed projects']
for (i, (stage, label)) in enumerate(zip(stages, labels)):
    ref = p / 'native' / ('wide-downtown-skyline-' + stage)
    proof = json.loads((ref / 'render-proof.json').read_text())
    rec = proof['images'][0]
    graded = p / 'toned' / ('wide-downtown-skyline-' + stage + '.png')
    assert graded.is_file()
    im = Image.open(graded).convert('RGBA')
    im.thumbnail((1920, 700), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (1920, 824), '#ffffff')
    sky = Image.new('RGBA', im.size, proof['background'])
    sky.alpha_composite(im)
    frame.paste(sky, (0, 0))
    draw = ImageDraw.Draw(frame)
    draw.line((48, 703, 1872, 703), fill='#d4d4d4', width=1)

    def txt(x, y, s, size, bold=False):
        draw.text((x, y), s, font=ImageFont.truetype(str(fonts / ('Inter-SemiBold.ttf' if bold else 'Inter-Regular.ttf')), size), fill='#282a2b')
    txt(48, 717, 'Downtown Mississauga', 36, True)
    txt(48, 769, 'Daniel Sultan  ·  City of Mississauga  ·  © OpenStreetMap', 19)
    txt(1234, 722, label, 30, True)
    txt(1234, 769, 'futuremississauga.com/sources.html', 19)
    frame.convert('RGB').save(local / (stage + '.png'))
    if i == 0:
        frame.convert('RGB').save(target / 'Downtown-film-poster.webp', quality=91)
concat = local / 'tracks.txt'
concat.write_text(''.join(("file '" + s + ".png'\nduration 4\n" for s in stages)) + "file 'future.png'\n")
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat), '-vf', 'fps=24,tpad=stop_mode=clone:stop_duration=1', '-frames:v', '288', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(local / 'Downtown-film-final.mp4')], check=True)
(local / 'Downtown-film-final.mp4').replace(target / 'Downtown-film.mp4')
credit = (public / 'gallery/refreshed-film-20261113-v2/Downtown-skyline-2026-11-13-credits.txt').read_text()
(target / 'Downtown-film-credits.txt').write_text('Film edition: 20 November 2026. Three new native renders of the verified November 13 scenes.\n\n' + credit)
