"""Build research thumbnails and their provenance from the edition's rendered sources."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
args = parser.parse_args()
here = Path(__file__).resolve().parent
public = here.parents[2] / 'public'
edition = public/'gallery/edition-20261121'
folder = edition/'research'
folder.mkdir(exist_ok=True)
def read(path):
    return json.loads(path.read_text())
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def info(path):
    with Image.open(path) as image:
        return dict(url=path.relative_to(public).as_posix(), width=image.width, height=image.height, sha256=digest(path))

previous = read(public/'data/directory-pictures.json')['entries']
features = read(public/'data/building-features.json')
landmarks = read(here/'landmark-plates.json')
geometry = {row['id']:row for row in read(args.workspace/'geometry-pictures.json')}
records=[]
for original in previous:
    key = original['id']
    kind = original['kind']
    if kind=='study':
        if key in features:
            feature = features[key]
            source = public/feature['displayImage']['url'].replace('edition-20261120/','edition-20261121/')
            image = public/feature['cardImage']['url'].replace('edition-20261120/','edition-20261121/')
        else:
            source = public/landmarks[key]['image']['url']
            image = public/landmarks[key]['cardImage']['url']
        row = dict(id=key, kind=kind, label=original['label'], source=[dict(file=source.relative_to(public).as_posix(),sha256=digest(source))])
    else:
        row = dict(geometry[key])
        # Preserve honest distinctions between an actual building, municipal massing and a location map.
        if key=='exchange-district' and kind=='city-massing' and row['kind']=='project-model':
            kind=row['kind']
        if row['kind'] != kind:
            raise ValueError('Check changed model coverage for '+key)
        row['label'] = 'Model study' if key=='exchange-district' else original['label']
        if kind=='neighbourhood':
            stem='wide-'+row['area'].lower().replace(' ','-')+'-future'
            image=edition/'signed'/(stem+'-thumb.webp')
            source=edition/'originals'/(stem+'-print.png')
            row['source']=[dict(file=source.relative_to(public).as_posix(),sha256=digest(source))]
        else:
            image=folder/(key+'.webp')
            with Image.open(args.workspace/'ppm'/(key+'.ppm')) as canvas:
                if kind=='site-location':
                    draw=ImageDraw.Draw(canvas)
                    x,y=canvas.width//2,canvas.height//2
                    draw.ellipse((x-16,y-16,x+16,y+16),fill='#f8f7f3',outline='#282d2d',width=3)
                    draw.ellipse((x-7,y-7,x+7,y+7),fill='#4a5255')
                canvas.thumbnail((680,462),Image.Resampling.LANCZOS)
                canvas.save(image,'WEBP',quality=88,method=5)
    row['image']=info(image)
    records.append(row)
if len(records)!=151 or len(set(r['id'] for r in records))!=151:
    raise ValueError('Research directory source count changed.')
out=public/'data/directory-pictures-20261121.json'
out.write_text(json.dumps(dict(schema='future-mississauga-directory-pictures/v1',edition='2026-11-21',entries=records),ensure_ascii=False,indent=2)+'\n')
print(len(records),'research entries checked')
