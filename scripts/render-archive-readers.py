"""Render archived PDF page images from their exact pinned editions, leaving the PDFs and text untouched."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from urllib.parse import urlsplit

import fitz
from PIL import Image


SCRIPTS = Path(__file__).resolve().parent
PUBLIC = SCRIPTS.parent / 'public'
RECIPE = SCRIPTS / 'editions/20261121/archive-reader-sources.json'
OUTPUT = 'document-previews/archive-20261121'
PROOF = SCRIPTS / 'editions/20261121/archive-reader-proofs'
spec = importlib.util.spec_from_file_location('edition_reader', SCRIPTS / 'build-document-reader.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()


def image_placements(page):
    figures = []
    for image in page.get_image_info():
        a,b,c,d,_,_ = image['transform']
        width, height = math.hypot(a,b),math.hypot(c,d)
        if width < 1 or height < 1: continue
        visible = fitz.Rect(image['bbox']) & page.rect
        coverage = max(0,visible.width)*max(0,visible.height) / (page.rect.width*page.rect.height)
        if coverage < .01: continue
        figures.append({'pixels':[image['width'],image['height']],
                        'placedPoints':[round(width,2),round(height,2)],
                        'ppi':[round(72*image['width']/width,1),round(72*image['height']/height,1)],
                        'pageCoverage':round(coverage,4)})
    return figures


def render(args):
    pin,offline,force = args
    url = urlsplit(pin['url'])
    path = offline / '/'.join(url.path.split('/')[-2:]) if url.netloc else PUBLIC / url.path
    checksum = sha(path)
    if checksum != pin['sha256']: raise ValueError(f'Wrong bytes for {pin["url"]}')
    relative = OUTPUT + '/' + checksum[:16] + '/'
    dest = PUBLIC / relative
    zoom = dest / 'zoom'
    zoom.mkdir(parents=True,exist_ok=True)
    receipt_path = PROOF/(checksum[:16]+'.json')
    prior = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    sizes,details = [],[]
    with fitz.open(path) as pdf:
        if len(pdf) != pin['pages']: raise ValueError(f'Wrong page count for {pin["url"]}')
        for index,page in enumerate(pdf):
            filename = 'page-'+str(index+1).zfill(2)+'.avif'
            entry = {'page':index+1,'pagePoints':[round(page.rect.width,2),round(page.rect.height,2)],'images':image_placements(page)}
            for name,out,width,quality in [('standard',dest,1200,74),('zoom',zoom,2880,84)]:
                target = out/filename
                prior_pages = prior.get('measurements',[])
                old = prior_pages[index].get(name,{}) if index<len(prior_pages) else {}
                if force or not target.is_file() or old.get('sha256') != sha(target):
                    reader.preview_page(page,target,width,quality)
                with Image.open(target) as image:
                    dimensions = list(image.size)
                if dimensions[0]!=width: raise ValueError(f'Unexpected page raster {target}')
                entry[name] = {'pixels':dimensions,'bytes':target.stat().st_size,'sha256':sha(target)}
            sizes.append(entry['standard']['pixels']);details.append(entry)
    record = dict(url=pin['url'],sourceSHA256=checksum,pages=len(sizes),base=relative,
                  zoomBase=relative+'zoom/',prefix='page-',width=1200,height=sizes[0][1],zoomWidth=2880)
    if any(d != sizes[0] for d in sizes): record['sizes']=sizes
    receipt = {**record,'sourceBytes':path.stat().st_size,'renderer':fitz.VersionBind,'measurements':details}
    reader.write_atomic(receipt_path,(json.dumps(receipt,indent=2)+'\n').encode())
    print(f'{pin["title"]}: {len(sizes)} pages from {checksum[:12]}',flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline-assets',type=Path,required=True,help='Verified local copies of GitHub release PDFs, arranged by release tag')
    parser.add_argument('--workers',type=int,default=2)
    parser.add_argument('--force',action='store_true')
    args = parser.parse_args()
    pins = json.loads(RECIPE.read_text())['documents']
    PROOF.mkdir(parents=True,exist_ok=True)
    first = sorted(pins,key=lambda p:p['pages']!=35)
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        records=list(pool.map(render,[(p,args.offline_assets.resolve(),args.force) for p in first]))
    by_url={r['url']:r for r in records}
    result={'version':1,'documents':[by_url[p['url']] for p in pins]}
    reader.write_atomic(PUBLIC/'data/archive-reader-20261121.json',(json.dumps(result,indent=2)+'\n').encode())


if __name__=='__main__':
    main()
