from pathlib import Path
from io import BytesIO
import argparse,hashlib,json,os
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
parser=argparse.ArgumentParser(description="Publish the verified local city plates, poster, and printable homepage covers.")
parser.add_argument('workspace',type=Path)
parser.add_argument('--part',choices=['all','catalog','covers'],default='all')
args=parser.parse_args()
w=args.workspace.resolve()
pub=Path(__file__).resolve().parents[1]/'public' 
assets=pub/'gallery/edition-20261120'
def update_json(path,data):
    temp=path.with_suffix('.partial')
    temp.write_text(json.dumps(data,indent=2)+'\n')
    temp.replace(path)
def digest(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file,'sha256').hexdigest() if hasattr(hashlib,'file_digest') else hashlib.sha256(file.read()).hexdigest()
def alias(source,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and os.path.samefile(source,target):return
    temp=target.with_name(target.name+'.link')
    temp.unlink(missing_ok=True)
    os.link(source,temp)
    temp.replace(target)
if args.part in ('all','catalog'):
    plates=json.loads((w/'edition.json').read_text())
    source_rows={r['id']:r for r in json.loads((w/'selected.json').read_text())}
    for plate in plates['plates']:
        caption=source_rows[plate['id']]['caption']
        plate['attribution']=dict(cityCredit='City of Mississauga',openStreetMap=bool(caption.get('openStreetMap')),requiredModelCredits=caption.get('requiredModelCredits',[]))
        stem=plate['id'].replace('/','-').removesuffix('.png')
        receipt=json.loads((w/'original-receipts'/(stem+'.json')).read_text())
        assert plate['sourceSHA256']==receipt['sourceSHA256'] and receipt['newNativeRender']
        plate.update({k:receipt[k] for k in ['sourceSceneSHA256','displayMaster','download','signedPreview','signedThumbnail','signedMaster']})
        thumb=assets/'thumbnails'/(stem+'.webp')
        assert thumb.is_file()
        plate['thumbnail']=str(thumb.relative_to(pub))
        tone=w/'toned'/(stem+'.json')
        if tone.is_file():plate['presentationSHA256']=json.loads(tone.read_text())['gradeSHA256']
    assert len(plates['plates'])==69
    update_json(pub/'data/city-plates-20261120.json',plates)
    with Image.open(assets/'Downtown-film-poster.webp') as poster:
        film_size=list(poster.size)
    manifest=dict(dimensions=film_size,durationSeconds=12,historicalFilmPreserved=True,frames=[])
    for key,name in [('film','Downtown-film.mp4'),('poster','Downtown-film-poster.webp'),('credits','Downtown-film-credits.txt')]:
        file=assets/name
        manifest[key]=dict(url=str(file.relative_to(pub)),bytes=file.stat().st_size,sha256=digest(file))
    for index,scenario in enumerate(['existing','construction','future']):
        stem='wide-downtown-skyline-'+scenario
        record=json.loads((w/'native'/stem/'render-proof.json').read_text())
        frame=record['images'][0]
        tone=json.loads((w/'toned'/(stem+'.json')).read_text())
        manifest['frames'].append(dict(scenario=scenario,startSeconds=index*4,sourceImageSHA256=frame['image']['sha256'],sourceSceneSHA256=record['sourceGLB']['sha256'],presentationSHA256=tone['gradeSHA256'],renderedUTC=frame['renderCompletedUTC']))
    update_json(pub/'data/downtown-film-20261120.json',manifest)
    print('Gallery and film catalogs ready',flush=True)
if args.part in ('all','covers'):
    for state in ['existing','future']:
        receipt=json.loads((w/'original-receipts'/('home-downtown-'+state+'.json')).read_text())
        full=pub/receipt['download']['url']
        assert digest(full)==receipt['download']['sha256']
        image=Image.open(full).convert('RGB')
        for width in [1200,2560]:
            preview=assets/f'home-{state}-{width}.webp'
            image.resize((width,round(width*image.height/image.width)),Image.Resampling.LANCZOS).save(preview,quality=90,method=5)
            alias(preview,pub/'gallery/city-plates'/f'downtown-{state}-{width}.webp')
        alias(full,pub/'gallery/city-plates'/f'downtown-{state}.png')
        alias(full,assets/f'home-{state}.png')
        out=pub/'downloads/edition-20261120'/f'Downtown-{state}-print.pdf'
        temp=out.with_suffix('.partial')
        jpeg=BytesIO()
        image.save(jpeg,'JPEG',quality=94,subsampling=0,optimize=True)
        jpeg.seek(0)
        pdf=Canvas(str(temp),pagesize=(1152,720),pageCompression=1)
        pdf.setTitle('Downtown Mississauga · '+('Existing buildings' if state=='existing' else 'With proposed projects'))
        pdf.setAuthor('Daniel Sultan · Future Mississauga')
        pdf.drawImage(ImageReader(jpeg),0,0,1152,720)
        pdf.showPage()
        pdf.save()
        temp.replace(out)
        destination='Downtown-Mississauga-existing-print.pdf' if state=='existing' else 'Downtown-Mississauga-print.pdf'
        alias(out,pub/'downloads'/destination)
        print('Cover ready', state, flush=True)
