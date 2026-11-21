from pathlib import Path
from io import BytesIO
import argparse,hashlib,json,os
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
parser=argparse.ArgumentParser(description="Publish the verified local city plates, poster, and printable homepage covers.")
parser.add_argument('workspace',type=Path)
parser.add_argument('--edition',default='20261120')
parser.add_argument('--current-aliases',action='store_true',help='Also refresh the stable undated public download URLs')
parser.add_argument('--part',choices=['all','catalog','covers','plates','film'],default='all')
parser.add_argument('--cover', choices=['existing','construction','future'], action='append', help='Package the selected cover stages.')
parser.add_argument('--view', action='append', help='Camera identity for an incremental plate update')
args=parser.parse_args()
w=args.workspace.resolve()
pub=Path(__file__).resolve().parents[1]/'public' 
edition='edition-'+args.edition
assets=pub/'gallery'/edition
assets.mkdir(parents=True,exist_ok=True)
current_aliases=args.current_aliases or args.edition=='20261120'
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
if args.part=='plates':
    if not args.view:
        parser.error('Supply at least one --view for an incremental plate update.')
    path=pub/'data'/('city-plates-'+args.edition+'.json')
    catalog=json.loads(path.read_text())
    plates={plate['id']:plate for plate in catalog['plates']}
    for identity in dict.fromkeys(args.view):
        plate=plates[identity]
        stem=identity.removesuffix('.png').replace('/','-')
        receipt=json.loads((w/'original-receipts'/(stem+'.json')).read_text())
        native=json.loads((w/'native'/stem/'render-proof.json').read_text())
        frame=next(frame for frame in native['images'] if frame['identity']==identity)
        tone=json.loads((w/'toned'/(stem+'.json')).read_text())
        assert receipt['id']==identity and frame['image']['sha256']==receipt['sourceSHA256']==tone['sourceSHA256']
        for field in ('displayMaster','download','signedPreview','signedThumbnail','signedMaster'):
            asset=receipt[field]
            assert digest(pub/asset['url'])==asset['sha256'], (identity,field)
            plate[field]=asset
        for field in ('sourceSHA256','sourceSceneSHA256','originalRender','newNativeRender'):
            plate[field]=receipt[field]
        plate['presentationSHA256']=tone['gradeSHA256']
        plate['northDegrees']=frame['north']['bearingClockwiseFromScreenUpDegrees']
        plate['width'],plate['height']=receipt['signedPreview']['dimensions']
        with Image.open(pub/receipt['displayMaster']['url']) as master:
            image=master.convert('RGB')
            for field,edge,quality in [('webImage',1600,89),('thumbnail',640,79)]:
                image.thumbnail((edge,edge),Image.Resampling.LANCZOS)
                destination=pub/plate[field]
                temporary=destination.with_suffix('.partial')
                image.save(temporary,'WEBP',quality=quality,method=4)
                temporary.replace(destination)
        print('Plate ready',identity,flush=True)
    update_json(path,catalog)
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
        plate['webImage']=str((assets/(stem+'.webp')).relative_to(pub))
        assert (pub/plate['webImage']).is_file()
        if args.edition!='20261120':
            native=json.loads((w/'native'/stem/'render-proof.json').read_text())
            corrected=native.get('assetReplacements',[])+native.get('municipalReplacements',[])
            if native.get('exchangePhaseGeometry'):
                corrected=[native['exchangePhaseGeometry'],*corrected]
            if corrected:
                plate['sourceGeometryRevisions']=[
                    {k:item[k] for k in ('project','assetId','stage','componentIds','sha256','triangles','sourceGLB','lifecycle','removeOnly') if k in item}
                    for item in corrected]
            for field,key in (('webImage','cleanPreview'),('thumbnail','cleanThumbnail')):
                path=pub/plate[field]
                with Image.open(path) as image:
                    plate[key]=dict(url=plate[field],width=image.width,height=image.height,
                                    bytes=path.stat().st_size,sha256=digest(path))
            if source_rows[plate['id']]['caption'].get('geographicScope')=='aldo_drive_residential_streets_within_900m_study':
                plate['area']='Lorne Park'
                plate['label']='Neighbourhood study'
        tone=w/'toned'/(stem+'.json')
        if tone.is_file():plate['presentationSHA256']=json.loads(tone.read_text())['gradeSHA256']
    assert len(plates['plates'])==69
    update_json(pub/'data'/('city-plates-'+args.edition+'.json'),plates)
if args.part in ('all','catalog','film'):
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
        item=dict(scenario=scenario,startSeconds=index*4,sourceImageSHA256=frame['image']['sha256'],sourceSceneSHA256=record['sourceGLB']['sha256'],presentationSHA256=tone['gradeSHA256'],renderedUTC=frame['renderCompletedUTC'])
        if args.edition != '20261120':
            original=json.loads((w/'original-receipts'/(stem+'.json')).read_text())['download']
            item.update(signedImageURL=original['url'],signedImageSHA256=original['sha256'])
        manifest['frames'].append(item)
    if args.edition != '20261120':
        encoded=json.loads((w/'film'/'final-encoding.json').read_text())
        assert encoded['filmSHA256']==manifest['film']['sha256']
        assert [row['signedSHA256'] for row in encoded['frames']]==[row['signedImageSHA256'] for row in manifest['frames']]
        manifest['frameCount']=encoded['frameCount']
        manifest['fps']=24
    update_json(pub/'data'/('downtown-film-'+args.edition+'.json'),manifest)
    print('Skyline film catalog ready',flush=True)
if args.part in ('all','covers'):
    for state in args.cover or ['existing','construction','future']:
        receipt=json.loads((w/'original-receipts'/('home-downtown-'+state+'.json')).read_text())
        full=pub/receipt['download']['url']
        assert digest(full)==receipt['download']['sha256']
        image=Image.open(full).convert('RGB')
        for width in [1200,2560]:
            preview=assets/f'home-{state}-{width}.webp'
            image.resize((width,round(width*image.height/image.width)),Image.Resampling.LANCZOS).save(preview,quality=90,method=5)
            if current_aliases:alias(preview,pub/'gallery/city-plates'/f'downtown-{state}-{width}.webp')
        if current_aliases:alias(full,pub/'gallery/city-plates'/f'downtown-{state}.png')
        alias(full,assets/f'home-{state}.png')
        out=pub/'downloads'/edition/f'Downtown-{state}-print.pdf'
        out.parent.mkdir(parents=True,exist_ok=True)
        temp=out.with_suffix('.partial')
        jpeg=BytesIO()
        image.save(jpeg,'JPEG',quality=94,subsampling=0,optimize=True)
        jpeg.seek(0)
        pdf=Canvas(str(temp),pagesize=(1152,720),pageCompression=1,invariant=1)
        stage={'existing':'Existing buildings','construction':'Under construction','future':'With proposed projects'}[state]
        pdf.setTitle('Downtown Mississauga · '+stage)
        pdf.setAuthor('Daniel Sultan · Future Mississauga')
        pdf.drawImage(ImageReader(jpeg),0,0,1152,720)
        pdf.showPage()
        pdf.save()
        temp.replace(out)
        destination='Downtown-Mississauga-print.pdf' if state=='future' else f'Downtown-Mississauga-{state}-print.pdf'
        if current_aliases:alias(out,pub/'downloads'/destination)
        print('Cover ready', state, flush=True)
