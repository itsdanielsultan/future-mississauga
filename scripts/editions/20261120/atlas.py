"""Build the reader's city atlas from full-resolution, individually verified scene masters."""
import argparse
from collections import defaultdict
from dataclasses import dataclass, field
import hashlib
from io import BytesIO
import json
import math
import os
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / 'public'
W, H, M = 768, 564, 28
INK, MUTED, RULE, PAPER = '#23272a', '#525957', '#d5d8d5', '#fafaf7'
ARCHIVE = 'https://futuremississauga.com/'
SECTIONS = [
    ('citywide', 'The shape of Mississauga', 'Follow the Lake Ontario shoreline, then look inland for the cluster of towers around Square One.'),
    ('downtown', 'Downtown around Square One', 'Square One sits between older apartment towers, new residential blocks and the streets that connect them.'),
    ('fairview', 'Fairview, before and after', 'Compare the earlier model with the revised streets and low-rise buildings around the towers.'),
    ('cooksville', 'Cooksville and its crossroads', 'Follow the blocks around Hurontario Street and Dundas Street to see how new buildings meet the existing neighbourhood.'),
    ('uptown', 'North along Hurontario', 'The same north–south street connects the higher buildings in Uptown with Downtown farther south.'),
    ('port-credit', 'Port Credit at the river', 'Look for the mouth of the Credit River and the change in scale between the waterfront and the streets inland.'),
    ('lakeview', 'The Lakeview waterfront', 'The shoreline gives the new blocks a clear edge. Trace the streets from established Lakeview toward the water.'),
    ('clarkson', 'The blocks of Clarkson', 'Read the larger sites beside the finer streets and houses to see the different scales within Clarkson.'),
    ('lorne-park', 'Inside Lorne Park', 'Individual houses and winding residential streets give this view a finer grain than the Downtown plates.'),
    ('erindale', 'Across Erindale and Sheridan', 'Read the larger building footprints against the surrounding residential streets.'),
    ('erin-mills', 'Erin Mills from above', 'Follow the major roads between centres, then look for the smaller streets in the blocks between them.'),
    ('streetsville', 'Streetsville along the Credit', 'The Credit River helps locate Streetsville within the wider city.'),
    ('meadowvale-village', 'Meadowvale Village', 'Look for the smaller streets and low-rise buildings within the broader road network.'),
    ('meadowvale', 'Meadowvale and Lisgar', 'This wider view shows how the residential areas fit together beyond the boundaries of any one development.'),
    ('lisgar', 'Lisgar and Argentia', 'Compare the closely spaced houses with the larger building footprints in the same view.'),
    ('churchill-meadows', 'The streets of Churchill Meadows', 'Trace the routes between neighbourhood blocks and the main roads around them.'),
    ('east-credit-creditview', 'East Credit and Creditview', 'Long residential blocks and the roads between them are easier to follow from above.'),
    ('heartland', 'Heartland and Gateway', 'Compare the scale of large commercial footprints with the surrounding city blocks.'),
    ('dixie-applewood', 'Dixie and Applewood', 'Follow the major streets to see where residential blocks meet larger sites.'),
    ('malton', 'Malton from above', 'Read the neighbourhood streets against the larger transport and employment areas nearby.'),
    ('airport-corporate', 'The airport employment district', 'Broad roads and large footprints give this part of Mississauga a different scale from its residential areas.'),
]
DETAILS = {
    'merner-41-bay': ('41 Bay Street', 'Port Credit', 'Follow the small cross-gable where the roof sections meet. Four elevations and photographs supplied by Merner Row Design guided this model.', 'Drawing and photograph references courtesy of Merner Row Design. Model by Daniel Sultan.'),
    'aldo-1422-study': ('1422 Aldo Drive', 'Lorne Park', 'The entrance faces Aldo Drive. The plain black upper roof sits above the lower shingled slopes in this study of the 2020 design.', 'Reference courtesy of Kyle / Kalgreens. Approximate model by Daniel Sultan.'),
}
STATUS = [('Existing buildings', '#6f7b82', 'The city used as the starting point.'), ('Under construction', '#83aeb9', 'Projects recorded as being built.'), ('Proposed or approved', '#d6aaa5', 'Plans that may change before construction.'), ('Uncertain', '#a88daf', 'A design or project status still in question.')]


@dataclass
class Page:
    kind: str
    title: str
    caption: str = ''
    district: str = ''
    views: list = field(default_factory=list)


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def district(row):
    return next(key for key, _, _ in SECTIONS if '/' + key + '-' in row['id'] or '/' + key + '/' in row['id'])


def group_pages(rows):
    pages = [Page('cover', 'Future Mississauga'), Page('contents', 'Inside the atlas'), Page('guide', 'How to read the city')]
    for key, title, caption in SECTIONS:
        records = [r for r in rows if district(r) == key]
        if key == 'fairview':
            pages.append(Page('wide-group', title, caption, key, sorted(records, key=lambda r: r['id'].endswith('after'))))
            continue
        principal = next(r for r in records if r['id'] == f'wide/{key}-future.png')
        pages.append(Page('hero', title, caption, key, [principal]))
        extra = [r for r in records if r != principal]
        skyline = [r for r in extra if r['id'].startswith('wide/') and '-skyline-' in r['id']]
        other = [r for r in extra if r['id'].startswith('wide/') and r not in skyline]
        portraits = [r for r in extra if r['id'].startswith('portraits/')]
        ordering = {'existing':0, 'construction':1, 'future':2}
        if key == 'downtown':
            def portrait_order(row):
                key = row['id']
                if '-skyline-' in key:
                    return (2, ordering[row['caption']['scenario']])
                if '-junction-' in key or '-landmark-' in key:
                    return (1, int('-landmark-' in key))
                return (0, 3 if '-portrait-' in key else ordering[row['caption']['scenario']])
            portraits.sort(key=portrait_order)
        if skyline:
            skyline.sort(key=lambda r: ['existing','construction','future'].index(r['caption']['scenario']))
            name = 'Three stages of the Downtown skyline' if len(skyline) == 3 else records[0]['title'] + ' skyline'
            pages.append(Page('wide-group', name, 'Read the three stages from top to bottom.' if len(skyline) == 3 else 'A wider frame places individual buildings within the surrounding skyline.', key, skyline))
        if other:
            for start in range(0, len(other), 2):
                selected = other[start:start+2]
                name = 'Street and landmark views' if key == 'downtown' else records[0]['title'] + ' in detail'
                pages.append(Page('wide-group', name, '', key, selected))
        batches = ([portraits[:3], portraits[3:5], portraits[5:]] if key == 'downtown' else [portraits[i:i+3] for i in range(0,len(portraits),3)])
        for group_index, selected in enumerate(batches):
            if key == 'downtown' and len(portraits) > 3:
                name = ['Square One in portrait', 'Landmarks and streets', 'The changing skyline'][group_index]
            else:
                name = records[0]['title'] + (' in portrait' if group_index == 0 else ' skyline in portrait')
            pages.append(Page('portraits', name, '', key, selected))
    for project,(title, area, caption, _) in DETAILS.items():
        pages.append(Page('detail', title, caption, project))
    return pages


def text(c, value, x, y, size=12, medium=False, color=INK, right=False):
    c.setFillColor(HexColor(color))
    c.setFont('Inter-Semi' if medium else 'Inter', size)
    (c.drawRightString if right else c.drawString)(x, y, value)


def wrap(c, value, x, top, width, size=13, leading=18, color=MUTED):
    p = Paragraph(escape(value), ParagraphStyle('body', fontName='Inter', fontSize=size, leading=leading, textColor=HexColor(color)))
    _, height = p.wrap(width, 3000)
    p.drawOn(c, x, top - height)
    return height


def line(c, y):
    c.setStrokeColor(HexColor(RULE))
    c.setLineWidth(.65)
    c.line(M, y, W-M, y)


def folio(c, number):
    line(c, 32)
    text(c, 'Future Mississauga  ·  Daniel Sultan', M, 16, 9.5, color=MUTED)
    text(c, str(number), W-M, 16, 9.5, color=MUTED, right=True)


def titlebar(c, title, note=''):
    text(c, title, M, H-42, 25, True)
    if note:
        text(c, note, W-M, H-39, 10.5, color=MUTED, right=True)


def view_label(row):
    name = row['id']
    scenario = {'existing': 'Existing buildings', 'future': 'With proposals', 'construction': 'Under construction'}.get(row['caption']['scenario'], '')
    if 'fairview' in name:
        return 'Earlier model' if name.endswith('before') else 'Revised neighbourhood'
    if '-junction-' in name:
        return 'Street junction · ' + scenario
    if '-landmark-' in name:
        return 'Landmark view · ' + scenario
    if '-skyline-' in name:
        return 'Skyline · ' + scenario
    if '-portrait-' in name:
        return 'Closer view · ' + scenario
    return scenario


def north_arrow(c, degrees, x, y):
    if degrees is None:
        return
    angle = math.radians(degrees)
    vx, vy = math.sin(angle), math.cos(angle)
    nx, ny = vy, -vx
    tip = x + 11*vx, y + 11*vy
    tail = x - 8*vx, y - 8*vy
    c.setLineWidth(.8)
    c.setStrokeColor(HexColor(INK))
    for sign, shade in [(-1, '#ffffff'), (1, INK)]:
        shape = c.beginPath()
        shape.moveTo(*tip)
        shape.lineTo(x+sign*3.5*nx, y+sign*3.5*ny)
        shape.lineTo(*tail)
        shape.close()
        c.setFillColor(HexColor(shade))
        c.drawPath(shape, fill=1, stroke=1)
    text(c,'N',x+16,y-3,8.5,True)


def placed_image(c, source, box, crop=False):
    x, y, w, h = box
    with Image.open(source) as source_image:
        scale = (max if crop else min)(w/source_image.width, h/source_image.height)
        if 72/scale < 299.95:
            raise ValueError(f'{source.name} would print at only {72/scale:.1f} ppi')
        image = source_image.convert('RGB')
        if crop:
            sw, sh = w/scale, h/scale
            left, top = (image.width-sw)/2, (image.height-sh)/2
            image = image.crop((round(left),round(top),round(left+sw),round(top+sh)))
        dw, dh = image.width*scale, image.height*scale
        image.thumbnail((math.ceil(dw*330/72), math.ceil(dh*330/72)), Image.Resampling.LANCZOS)
        stream = BytesIO()
        image.save(stream, 'JPEG', quality=91, subsampling=0, optimize=True)
        stream.seek(0)
        c.drawImage(ImageReader(stream), x+(w-dw)/2, y+(h-dh)/2, dw, dh)


def build(args):
    work = args.workspace.resolve()
    work.mkdir(parents=True, exist_ok=True)
    fonts=Path(os.environ.get('FM_INTER_FONTS', Path.home()/'Library/Fonts'))
    for alias, name in [('Inter','Inter-Regular.ttf'),('Inter-Semi','Inter-SemiBold.ttf')]:
        pdfmetrics.registerFont(TTFont(alias, str(fonts/name)))
    rows = read(HERE/'selected.json')
    catalog = read(PUBLIC/'data/city-plates-20261120.json')
    published = {r['id']:r for r in catalog['plates']}
    pages = group_pages(rows)
    first = {}
    for n, page in enumerate(pages, 1):
        if page.district:
            first.setdefault(page.district,n)
    district_names = {row['id']: row['name'] for row in read(PUBLIC / 'data/districts.json')}
    location = {r['id']:n for n, page in enumerate(pages,1) for r in page.views}
    assert len(location) == len(rows) == 69
    (work/'atlas-page-map.json').write_text(json.dumps({'districts':first,'views':location},indent=2)+'\n')
    if args.plan:
        print(json.dumps(first, indent=2))
        return
    checked = {}
    def master(row):
        id_ = row['id']
        if id_ not in checked:
            key = id_.replace('/','-').removesuffix('.png')
            receipt = read(args.receipts/(key+'.json')) if args.receipts else published[id_]
            info = receipt['displayMaster']
            file = PUBLIC/info['url']
            if sha(file) != info['sha256']: raise ValueError(f'{key}: full-resolution scene differs from signed receipt')
            checked[id_] = (file, receipt)
        return checked[id_][0]
    hero = next(r for r in rows if r['id'] == 'wide/downtown-future.png')
    def bearing(row):
        key=row['id']
        if args.receipts:
            proof=args.receipts.parent/'native'/key.replace('/','-').removesuffix('.png')/'render-proof.json'
            if proof.is_file():
                frame=next(image for image in read(proof)['images'] if image['identity']==key)
                return frame['north']['bearingClockwiseFromScreenUpDegrees']
        return published[key].get('northDegrees')
    guide_image = next(r for r in rows if r['id'] == 'wide/downtown-portrait-future.png')
    printed = args.proof if args.proof else PUBLIC/'downloads/edition-20261120/Mississauga-Atlas.pdf'
    target = printed.with_suffix('.partial')
    c=Canvas(str(target),pagesize=(W,H),pageCompression=1,invariant=1)
    c.setTitle('Future Mississauga · City and neighbourhood atlas')
    c.setAuthor('Daniel Sultan')
    c.setSubject('An illustrated guide to existing buildings, construction and proposals across Mississauga')
    used = defaultdict(set)
    def credits(row,n):
        for credit in dict.fromkeys(row['caption'].get('fullCredits',[])+row['caption'].get('requiredModelCredits',[])): used[credit].add(n)
    def start(title, n):
        c.bookmarkPage('p'+str(n))
        c.addOutlineEntry(title,'p'+str(n),0,False)
    for n,page in enumerate(pages,1):
        start(page.title,n)
        if page.kind=='cover':
            placed_image(c,master(hero),(0,112,W,H-112),crop=True)
            credits(hero,n)
            text(c, page.title, M, 64, 39, True)
            text(c, 'A city and neighbourhood atlas by Daniel Sultan', M, 34, 15)
            text(c, 'November 2026', W-M, 35, 12, right=True, color=MUTED)
        elif page.kind=='contents':
            titlebar(c,page.title)
            wrap(c,'Start with the whole city, find a neighbourhood, then see how an individual building was modelled.',M,H-60,W-2*M,14)
            cards=[('citywide','The city','wide/citywide-future.png'),('lakeview','The waterfront','wide/lakeview-future.png'),('merner-41-bay','Building studies',None)]
            cell=(W-2*M-28)/3
            for i,(anchor,label,key) in enumerate(cards):
                x=M+i*(cell+14)
                if key:
                    row=next(r for r in rows if r['id']==key)
                    src=master(row)
                    credits(row,n)
                else:
                    src = args.studios/'merner-41-bay-front.webp'
                placed_image(c,src,(x,H-241,cell,137),crop=True)
                text(c,label,x,H-261,14,True)
                text(c,str(first[anchor]),x+cell,H-261,12,right=True,color=MUTED)
                c.linkRect('', 'p'+str(first[anchor]), (x,H-267,x+cell,H-100),thickness=0)
            text(c, 'Find a neighbourhood', M, 262, 17, True)
            items = sorted((district_names.get(district_id, 'Fairview'), page_number)
                           for district_id, page_number in first.items()
                           if district_id not in DETAILS and district_id != 'citywide')
            step=24
            per=math.ceil(len(items)/3)
            for i,(name,num) in enumerate(items):
                col,idx=divmod(i,per)
                x=M+col*(cell+14)
                y=231-idx*step
                text(c,name,x,y,11)
                text(c,str(num),x+cell-5,y,11,color=MUTED,right=True)
                c.linkRect('', 'p'+str(num),(x,y-5,x+cell,y+13),thickness=0)
            folio(c,n)
        elif page.kind=='guide':
            titlebar(c,page.title)
            placed_image(c,master(guide_image),(M,116,403,364),crop=True)
            credits(guide_image,n)
            x=459
            text(c,'Reading the colours',x,466,19,True)
            for i,(label,colour,detail) in enumerate(STATUS):
                y=425-74*i
                c.setFillColor(HexColor(colour))
                c.roundRect(x,y-1,15,15,3,fill=1,stroke=0)
                text(c,label,x+26,y,13,True)
                wrap(c,detail,x+26,y-10,W-M-x-26,11.5,15)
            wrap(c,'Use each north arrow to orient the view. The models show how plans fit into the existing city. Each project has its own evidence date, and proposals may change.',M,94,W-2*M,13,18)
            folio(c,n)
        elif page.kind=='detail':
            title,area,caption,attribution=DETAILS[page.district]
            titlebar(c,title,area)
            placed_image(c,args.studios/(page.district+'-front.webp'),(M,114,W-2*M,H-179))
            wrap(c,caption,M,95,W-2*M,13,17)
            text(c,attribution,M,44,9.2,color=MUTED)
            c.linkURL(ARCHIVE+'downloads/edition-20261120/'+page.district+'-review.pdf',(M,109,W-M,H-60),thickness=0)
            folio(c,n)
        else:
            titlebar(c, page.title)
            for r in page.views:
                credits(r,n)
            if page.kind=='hero' or len(page.views)==1:
                r = page.views[0]
                label=view_label(r)
                placed_image(c,master(r),(M,107,W-2*M,H-167))
                text(c,label,M,83,13,True)
                north_arrow(c,bearing(r),W-M-22,86)
                if page.caption:
                    wrap(c,page.caption,M,69,W-2*M,12,16)
            elif page.kind=='portraits':
                cell=(W-2*M-(len(page.views)-1)*14)/len(page.views)
                for i,r in enumerate(page.views):
                    x=M+i*(cell+14)
                    placed_image(c,master(r),(x,96,cell,H-166))
                    text(c,view_label(r),x,72,11,True)
                    north_arrow(c,bearing(r),x+cell-22,75)
            else:
                rowh=(H-120)/len(page.views)
                panoramic = len(page.views) == 3
                art_width = 535 if panoramic else 420 if page.district == 'fairview' else 500
                for i,r in enumerate(page.views):
                    top=H-62-i*rowh
                    placed_image(c,master(r),(M,top-rowh+7,art_width,rowh-14),crop=True)
                    label = view_label(r).removeprefix('Skyline · ') if panoramic else view_label(r)
                    wrap(c,label,M+art_width+18,top-9,W-2*M-art_width-18,13,17,color=INK)
                    north_arrow(c,bearing(r),M+art_width+30,top-63)
            folio(c,n)
        c.showPage()
    # Printed index keeps the full licence wording and page mapping with the publication.
    n=len(pages)
    y=0
    for credit, numbers in sorted(used.items()):
        ranges=[]
        for number in sorted(numbers):
            if ranges and number==ranges[-1][-1]+1:
                ranges[-1].append(number)
            else:
                ranges.append([number])
        refs=', '.join(str(a[0]) if len(a)==1 else str(a[0])+'–'+str(a[-1]) for a in ranges)
        para=Paragraph(escape(credit),ParagraphStyle('credit',fontName='Inter',fontSize=9.7,leading=13.3,textColor=HexColor(INK)))
        width=W-2*M-118
        _,height=para.wrap(width,1000)
        links=Paragraph(escape(refs),ParagraphStyle('ref',fontName='Inter',fontSize=9.5,leading=12.3,textColor=HexColor(MUTED)))
        _,refh=links.wrap(103,1000)
        h=max(height,refh)+13
        if y-h<48:
            if y:
                folio(c,n)
                c.showPage()
            n+=1
            start('Image credits' if n==len(pages)+1 else 'Image credits (continued)',n)
            titlebar(c,'Image credits')
            text(c,'Pages',M,H-68,10,True)
            text(c,'Sources and acknowledgements',M+118,H-68,10,True)
            y=H-82
        links.drawOn(c,M,y-refh)
        para.drawOn(c,M+118,y-height)
        y-=h
    if y:
        folio(c,n)
        c.showPage()
    c.save()
    target.replace(printed)
    new=[]
    for row in rows:
        old=published[row['id']].copy()
        rec=checked[row['id']][1]
        for k in ['sourceSHA256','sourceSceneSHA256','originalRender','displayMaster','download','newNativeRender']:
            old[k]=rec[k]
        for key in ('signedPreview', 'signedThumbnail', 'signedMaster'):
            if key in rec:
                old[key] = rec[key]
        if 'signedPreview' in rec:
            old['width'], old['height'] = rec['signedPreview']['dimensions']
        old['northDegrees']=bearing(row)
        old['page']=location[row['id']]
        new.append(old)
    data={'atlasPages':n,'plates':new}
    destination=work/'edition.json'
    destination.write_text(json.dumps(data,indent=2)+'\n')
    if not args.receipts and not args.proof:
        target=PUBLIC/'data/city-plates-20261120.json'
        temp=target.with_suffix('.tmp')
        temp.write_text(json.dumps(data,indent=2)+'\n')
        temp.replace(target)
    print(f'{n} atlas pages, {len(new)} city views, 2 detailed building models, {len(used)} distinct credit lines.',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--studios',type=Path,help='Fresh full-resolution front and reverse building illustrations')
    parser.add_argument('--receipts',type=Path,help='Use the freshly rendered signed city-image receipts')
    parser.add_argument('--proof',type=Path,help='Write a proof PDF outside the site and preserve the current catalogue')
    parser.add_argument('--plan',action='store_true',help='Write the stable district and plate page index without generating a PDF')
    args=parser.parse_args()
    if not args.studios:
        args.studios=args.workspace/'booklet-models'
    build(args)
