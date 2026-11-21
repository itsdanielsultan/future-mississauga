"""Sign new model renders, preserve their historical mapping, and bind all finished pairs."""
import argparse
import datetime
import hashlib
import html
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat

parser=argparse.ArgumentParser()
parser.add_argument('workspace',type=Path)
parser.add_argument('--public',type=Path,default=Path('public'))
parser.add_argument('--bind',action='store_true')
args=parser.parse_args()
work=args.workspace.resolve()
base=Path('gallery/edition-20261121/revision-panels')
destination=args.public/base
destination.mkdir(parents=True,exist_ok=True)
page=args.public/'reference-updates.html'
page_source=page.read_text()
source_rows=json.loads((work/'historical-inputs.json').read_text())
font_dir=Path.home()/'Library/Fonts'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def plain(markup):
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',markup.replace('<br>',' ')))).strip()

def image_record(path):
    with Image.open(path) as im: size=im.size
    return {'url':str(path.relative_to(args.public)),'width':size[0],'height':size[1],'sha256':digest(path)}

def wrapped(text,font,width):
    lines=[]
    for word in text.split():
        if lines and font.getlength(lines[-1]+' '+word)<=width:lines[-1]+=' '+word
        else:lines.append(word)
    return lines

def make_print(scene,original,title,view,credits):
    scale=scene.width/2200
    medium=ImageFont.truetype(str(font_dir/'Inter-Medium.ttf'),round(37*scale))
    regular=ImageFont.truetype(str(font_dir/'Inter-Regular.ttf'),round(24*scale))
    small=ImageFont.truetype(str(font_dir/'Inter-Regular.ttf'),round(19*scale))
    padding=round(36*scale)
    line_height=round(28*scale)
    credit_lines=wrapped(credits,small,scene.width-2*padding)
    h=round(119*scale)+len(credit_lines)*line_height
    signed=Image.new('RGB',(scene.width,scene.height+h),(247,246,244))
    signed.paste(scene,(0,0))
    draw=ImageDraw.Draw(signed)
    y=scene.height
    title_width=round(scene.width*.63)
    for line in wrapped(title,medium,title_width):
        draw.text((padding,y+round(18*scale)),line,font=medium,fill='#22221f')
        y+=round(45*scale)
    draw.text((padding,y+round(15*scale)),'by Daniel Sultan',font=regular,fill='#55554e')
    draw.text((scene.width-padding,scene.height+round(28*scale)),view,font=regular,fill='#393934',anchor='ra')
    y+=round(57*scale)
    draw.line((padding,y,scene.width-padding,y),fill='#d1d0ca',width=max(1,round(scale)))
    for line in credit_lines:
        draw.text((padding,y+round(11*scale)),line,font=small,fill='#53534e')
        y+=line_height
    signed.save(original,optimize=False,compress_level=6)
    return signed

def published_label(project,label):
    plain_labels={
        'Before':'Before · City model', 'Partial facade detail':'After · Façade detail',
        'After · Facade detail':'After · Façade detail',
        'Earlier model':'Before', 'Earlier City model':'Before · City model',
        'Earlier reference model':'Before', 'Updated opposite end':'After · Opposite end',
        'Updated exterior study':'After · Exterior', 'Updated roof and exterior study':'After · Roof and exterior',
        'Updated kitchen-gable study':'After · Kitchen gable', 'Updated frontage study':'After · Street frontage',
        'Steel frame and stones · Approximate model view':'Steel frame and stones', 'Front view · Approximate model view':'Front view',
        'New study · tower and visible birds':'Tower and birds', 'New study · roof and bird detail':'Roof and bird detail',
        'New study · neutral daylight':'Neutral daylight','Same study · warm light':'Warm light',
        '01 Before Campus Context':'Before · Campus','02 After Campus Context':'After · Campus','03 Canopy Detail':'Canopy detail',
        'Estate mapped ground':'Estate grounds','House ground contact':'House and grounds',
        'City context':'Park setting','Landmark detail':'Close-up','After Rear plan study':'After · Rear elevation',
    }
    if label in plain_labels:return plain_labels[label]
    direction=re.match(r'NRC (Northwest close|Northeast context) (Before|After)$',label)
    if direction:return direction[2]+' · '+('Northwest façade' if direction[1]=='Northwest close' else 'Northeast surroundings')
    for prefix,mark in [('Earlier model · ','Before'),('Earlier City model · ','Before'),('Updated study · ','After')]:
        if label.startswith(prefix):return mark+' · '+label[len(prefix):].capitalize()
    for mark in ['Before','After']:
        if label.startswith(mark+' '):
            subtitle={'North entry':'North entrance','South garden':'South garden','Estate context':'Estate grounds','Temple front':'Front entrance','Temple context':'Temple setting','Street context':'Street view'}.get(label[len(mark)+1:])
            if subtitle:return mark+' · '+subtitle
    return label

records=[]
for row in source_rows:
    source=work/'renders'/row['name'];receipt=source.with_suffix('.json')
    if not receipt.is_file():continue
    proof=json.loads(receipt.read_text())
    if digest(source)!=proof['sha256'] or not proof['modelInputs']:raise ValueError('Invalid input or missing model source for '+row['name'])
    section=re.search(r'<section class="model-change" id="'+re.escape(row['project'])+r'"[\s\S]*?</section>',page_source)[0]
    credit_block=re.search(r'<p class="credits"[^>]*>([\s\S]*?)</p>',section)
    if not credit_block:raise ValueError('Missing study credits for '+row['project'])
    credits=plain(credit_block[1])
    if not credits:raise ValueError('Missing credit text for '+row['project'])
    view=published_label(row['project'],row['caption'])
    stem=row['name'].removesuffix('.png')
    original=destination/(stem+'.png')
    full=destination/(stem+'.webp')
    preview=destination/(stem+'-preview.webp')
    private_meta=work/'renders'/(stem+'-publication.json')
    sig=hashlib.sha256((digest(receipt)+credits+str(row['place'])+row['caption']+digest(Path(__file__))).encode()).hexdigest()
    if private_meta.exists() and all(p.exists() for p in [original,full,preview]):
        cached=json.loads(private_meta.read_text())
        if cached['signature']==sig:
            records.append(cached['public']);continue
    with Image.open(source) as image:
        if 'A' in image.getbands():
            background='#e8f2f7' if row['project']=='ergocentric-275-superior' else '#f1f0ec'
            scene=Image.new('RGBA',image.size,background)
            scene.alpha_composite(image.convert('RGBA'))
            scene=scene.convert('RGB')
        else:
            scene=image.convert('RGB')
    reduced=scene.copy();reduced.thumbnail((96,96))
    if max(ImageStat.Stat(reduced).stddev)<3:raise ValueError('Flat render '+row['name'])
    signed=make_print(scene,original,row['place'],view,credits)
    signed.save(full,method=4,quality=89)
    signed.thumbnail((920,920),Image.Resampling.LANCZOS)
    signed.save(preview,method=5,quality=83)
    record={'project':row['project'],'place':row['place'],'label':view,'historicalLabel':row['caption'],'archive':row['archive'],'camera':proof['historicalCamera'],
            'sourceHashes':sorted(set(proof['modelInputs'].values())),'visibleSourceHashes':sorted({proof['modelInputs'][p] for p in proof.get('visibleModelInputs',[])}),'renderSHA256':proof['sha256'],'renderSize':proof['dimensions'],
            'sourceRecipeSHA256':proof['recipeSHA256'],'download':image_record(original),'display':image_record(full),'thumbnail':image_record(preview)}
    private_meta.write_text(json.dumps({'signature':sig,'public':record},indent=2)+'\n')
    records.append(record)
print('Verified render publications:',len(records),'of',len(source_rows),flush=True)
if args.bind:
    if len(records)!=len(source_rows):raise SystemExit('All original published comparisons must resolve before cutover.')
    by_archive={row['archive']:row for row in records}
    by_current={row['display']['url']:row for row in records}
    html_attr=lambda value:html.escape(str(value),quote=True)
    def bind_section(match):
        section=match[0]
        if match[1]=='fairview-neighbourhood':
            return re.sub(r'<div class="image-pair"[^>]*>','<div class="image-pair" data-picture-area="Fairview" data-picture-map="explore.html?district=citywide&amp;context=fairview&amp;appearance=status">',section)
        if not any(row['project']==match[1] for row in records):return section
        place=plain(re.search(r'<h2[^>]*>([\s\S]*?)</h2>',section)[1])
        section=re.sub(r'<div class="image-pair"[^>]*>','<div class="image-pair" data-picture-area="'+html_attr(place)+'">',section)
        def bind_figure(figmatch):
            fig=figmatch[0]
            anchor=re.search(r'<a\b[^>]*\bhref="([^"]+)"[^>]*>',fig)
            assert anchor,fig
            key=html.unescape(anchor[1])
            row=by_archive.get(key) or by_current.get(key)
            if not row:return fig
            display=row['display'];thumb=row['thumbnail']
            new_anchor='<a href="'+html_attr(display['url'])+'" data-revision-panel="'+html_attr(row['project'])+'" data-preview-title="'+html_attr(row['label'])+'" data-preview-width="'+str(display['width'])+'" data-preview-height="'+str(display['height'])+'" data-preview-download="'+html_attr(row['download']['url'])+'">'
            fig=fig.replace(anchor[0],new_anchor,1)
            img=re.search(r'<img\b[^>]*>',fig)
            new_img=re.sub(r'\b(src|width|height)="[^"]*"',lambda m:m[1]+'="'+html_attr(thumb[{'src':'url','width':'width','height':'height'}[m[1]]])+'"',img[0])
            fig=fig.replace(img[0],new_img,1)
            return re.sub(r'(<figcaption[^>]*>)[\s\S]*?(</figcaption>)',lambda m:m[1]+html.escape(row['label'])+m[2],fig)
        return re.sub(r'<figure\b[^>]*>[\s\S]*?</figure>',bind_figure,section)
    final_page=re.sub(r'<section class="model-change" id="([^"]+)"[\s\S]*?</section>',bind_section,page_source)
    for landmark in ('gala-gateway','conference-council-house','utm-davis-meeting-place-canopy-study','churchill-meadows-log-play-study','paul-coffey-castle-study','fairwinds-park-ship-study'):
        new=f'gallery/edition-20261121/building-revisions/cards/{landmark}.webp'
        if not (args.public/new).is_file():raise SystemExit('Missing landmark thumbnail: '+landmark)
        final_page=final_page.replace(f'assets/project-pictures-20261120/{landmark}.webp',new)
    page.write_text(final_page)
    notes_path=args.public/'study-notes.html'
    notes=notes_path.read_text()
    def archive_links(match):
        collection=[row for row in records if row['project']==match[1]]
        if not collection:return match[0]
        grouped={}
        for row in collection:
            code=re.search(r'(?<!\d)(2026)-?(\d{2})-?(\d{2})(?!\d)',row['archive'])
            if not code:raise ValueError('Archive date missing: '+row['archive'])
            date=datetime.date(*map(int,code.groups()))
            grouped.setdefault(date,[]).append(row)
        body=re.sub(r'<div class="study-archive-links"[\s\S]*?</div>','',match[0])
        parts=[]
        for date,group in grouped.items():
            links=' · '.join('<a href="'+html_attr(row['archive'])+'">'+html.escape(row['label'])+'</a>' for row in group)
            parts.append('<p><strong>'+date.strftime('%-d %B %Y')+'</strong><br>'+links+'</p>')
        block='<div class="study-archive-links"><h4>Original comparison images</h4>'+''.join(parts)+'</div>'
        return body.replace('</article>',block+'</article>')
    notes_path.write_text(re.sub(r'<article id="([^"]+)"[\s\S]*?</article>',archive_links,notes))
    catalogue={'edition':'2026-11-21','panels':records}
    (args.public/'data/revision-panels-20261121.json').write_text(json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n')
