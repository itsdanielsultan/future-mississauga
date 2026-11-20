"""Publish clean and credited versions of each verified Blender render in an edition."""
import argparse
import hashlib
import json
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def asset(path, public, mime_type, size):
    return dict(url=path.relative_to(public).as_posix(), width=size[0], height=size[1],
                dimensions=list(size), bytes=path.stat().st_size, sha256=sha(path), mimeType=mime_type)


@lru_cache(maxsize=24)
def font(size, weight='Regular'):
    return ImageFont.truetype(str(Path(os.environ.get('FM_INTER_FONTS', Path.home() / 'Library/Fonts')) / ('Inter-' + weight + '.ttf')), size)


def compass(draw, x, y, degrees, scale):
    angle = math.radians(degrees)
    dx, dy = math.sin(angle), -math.cos(angle)
    tip = (x + dx*19*scale, y + dy*19*scale)
    tail = (x - dx*19*scale, y - dy*19*scale)
    left = (x + dy*5*scale, y - dx*5*scale)
    right = (x - dy*5*scale, y + dx*5*scale)
    draw.polygon([tip, left, tail, right], fill='white', outline='#222429', width=max(1, round(scale)))
    draw.polygon([tip, left, tail], fill='#222429')
    draw.text((x + dx*31*scale, y + dy*31*scale), 'N', font=font(round(11*scale),'SemiBold'),
              fill='#222429', anchor='mm')


def wrapped(draw, lines, face, width):
    result=[]
    for line in lines:
        words=line.split()
        segment=''
        for word in words:
            trial=(segment+' '+word).strip()
            if segment and draw.textlength(trial,font=face)>width:
                result.append(segment); segment=word
            else:segment=trial
        if segment:result.append(segment)
    return result


def write_print(image, row, north, output, home):
    w,h=image.size
    unit=w/(1840 if w>h else 1170)
    margin=round(32*unit)
    pad=round(26*unit)
    title_font=font(round(31*unit),'SemiBold')
    label_font=font(round(15*unit))
    detail_font=font(round(13*unit))
    source_font=font(round(12*unit))
    draw=ImageDraw.Draw(image)
    area='Downtown' if home else row['caption']['area'] or row['title']
    phase=row['caption'].get('scenario','')
    if row['id'].endswith(('/before','/after')):
        label='Earlier model' if row['id'].endswith('/before') else 'Revised model'
    else:
        label={'existing':'Existing buildings','construction':'Under construction','future':'With proposed projects'}.get(phase,phase)
    if not home:
        view=next((v for k,v in [('landmark','Landmark'),('junction','Street junction'),('skyline','Skyline')] if k in row['id']),None)
        if view: label=view+' · '+label
    short_credits=['City of Mississauga' + (' · © OpenStreetMap contributors' if row['caption'].get('openStreetMap') else '')]
    required=row['caption'].get('requiredModelCredits',[])
    source_lines=wrapped(draw,short_credits+required,source_font,w-2*margin-2*pad)
    detail_height=round(17*unit)
    band=round(105*unit)+len(source_lines)*detail_height
    if home:
        y=h-margin-band
        paper=image.copy()
        draw=ImageDraw.Draw(paper); draw.rounded_rectangle((margin,y,w-margin,h-margin),radius=round(6*unit),fill='#ffffff')
        x=margin+pad
    else:
        x=pad; y=h
        paper=Image.new('RGB',(w,h+band),'white');paper.paste(image); draw=ImageDraw.Draw(paper)
    draw.text((x,y+round(13*unit)),area,font=title_font,fill='#242528')
    draw.text((x,y+round(54*unit)),'by Daniel Sultan' if home else label+'   ·   Daniel Sultan',font=label_font,fill='#4b4d4e')
    if home:
        legend=[('#bdbebc','Existing'),('#83b2bc','Under construction'),('#dcb8aa','Proposed / approved'),('#ac91b9','Uncertain')]
        if phase=='existing':legend=legend[:1]
        current=w*(.45 if len(legend)>1 else .78)
        for colour,word in legend:
            mid=y+round(48*unit)
            draw.rounded_rectangle((current,mid-6*unit,current+14*unit,mid+6*unit),radius=2*unit,fill=colour)
            draw.text((current+22*unit,mid),word,anchor='lm',font=detail_font,fill='#333432')
            current+=draw.textlength(word,font=detail_font)+47*unit
    compass(draw,w-(margin if home else 0)-pad-20*unit,y+43*unit,north,unit)
    right=w-(margin if home else 0)-pad
    draw.line((x,y+80*unit,right,y+80*unit),fill='#dcdddd',width=max(1,round(.7*unit)))
    for n,line in enumerate(source_lines):draw.text((x,y+(89+n*17)*unit),line,font=source_font,fill='#505354')
    if not required and w>h:draw.text((right,y+89*unit),'futuremississauga.com/sources.html',font=source_font,fill='#505354',anchor='ra')
    meta=PngImagePlugin.PngInfo()
    meta.add_itxt('Title',area+' · '+label)
    meta.add_itxt('Author','Daniel Sultan / Future Mississauga')
    meta.add_itxt('Description','\n'.join(row['caption'].get('fullCredits',[])+required))
    paper.save(output,format='PNG',compress_level=4,pnginfo=meta)
    return paper.size


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--edition',default='20261120')
    parser.add_argument('--only',nargs='+',help='Compose only these camera identities')
    parser.add_argument('--workers',type=int,default=2)
    args=parser.parse_args()
    work=args.workspace.resolve();public=Path(__file__).resolve().parents[1]/'public'
    folder=public/'gallery'/('edition-'+args.edition)/'originals';folder.mkdir(parents=True,exist_ok=True)
    cache=work/'original-receipts';cache.mkdir(exist_ok=True)
    rows={r['id']:r for r in json.loads((work/'selected.json').read_text())}
    for scenario in ('existing','future'):
        rows['home/downtown-'+scenario+'.png']=rows['wide/downtown-'+scenario+'.png']
    receipts={}
    for proof_file in (work/'native').glob('*/render-proof.json'):
        proof=json.loads(proof_file.read_text())
        if proof.get('state')!='RENDERED_VISUAL_REVIEW_REQUIRED':continue
        for img in proof['images']:
            if img['identity'] in rows:
                receipts[img['identity']]=(img,proof)
    def produce(ident):
        target=re.sub('[^a-z0-9]+','-',ident.removesuffix('.png')).strip('-')
        info,proof=receipts[ident];source=Path(info['image']['path'])
        master=folder/(target+'-scene.webp');download=folder/(target+'-print.png')
        record=cache/(target+'.json')
        tone = work/'toned'/(target+'.json')
        grade = json.loads(tone.read_text()) if tone.exists() else None
        if grade and grade['sourceSHA256'] != info['image']['sha256']:raise ValueError('Mismatched tower grading source: '+ident)
        grade_hash = grade['gradeSHA256'] if grade else None
        recipe = 'a338e303b706ef26b474eb219122c786f16ce4cfafb59cc5f705f5c2af4dc629' if not ident.startswith('home/') else 'north-and-scenario-key-v1'
        if record.is_file() and master.is_file() and download.is_file():
            old=json.loads(record.read_text())
            if old.get('sourceSHA256')==info['image']['sha256'] and old.get('recipe')==recipe and old.get('gradeSHA256')==grade_hash:return
        if sha(source)!=info['image']['sha256']:raise ValueError('Render digest mismatch for '+ident)
        if grade:
            source=tone.with_suffix('.png')
            if sha(source)!=grade_hash:raise ValueError('Graded image digest mismatch for '+ident)
        with Image.open(source) as rgba:
            if list(rgba.size)!=info['plannedNativeDimensions']:raise ValueError('Render resolution mismatch for '+ident)
            background=Image.new('RGBA',rgba.size,proof['background']);background.alpha_composite(rgba.convert('RGBA'))
            im=background.convert('RGB')
        temp=master.with_name(master.name+'.tmp'); im.save(temp,'WebP',quality=92,method=3);temp.replace(master)
        temp=download.with_name(download.name+'.tmp')
        print_size=write_print(im,rows[ident],info['north']['bearingClockwiseFromScreenUpDegrees'],temp,ident.startswith('home/'))
        temp.replace(download)
        data=dict(id=ident,sourceSHA256=info['image']['sha256'],sourceSceneSHA256=proof['sourceGLB']['sha256'],
                  originalRender=info['renderCompletedUTC'],newNativeRender=True,recipe=recipe,gradeSHA256=grade_hash,
                  displayMaster=asset(master,public,'image/webp',im.size),download=asset(download,public,'image/png',print_size))
        tmp=record.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2));tmp.replace(record)
        print('COMPOSED',ident,flush=True)
    selected = args.only or list(receipts)
    missing = set(selected) - set(receipts)
    if missing: parser.error('Missing verified render: '+', '.join(sorted(missing)))
    with ThreadPoolExecutor(max_workers=args.workers) as pool:list(pool.map(produce,selected))


if __name__=='__main__':main()
