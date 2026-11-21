"""Verify a complete print edition, both reader resolutions and its preserved catalogue history."""
import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import fitz
from PIL import Image

PUBLIC = Path(__file__).resolve().parents[3] / 'public'


def read_reader(edition):
    catalog = json.loads((PUBLIC / 'data' / f'document-previews-{edition}.json').read_text())
    stored_text = (PUBLIC / f'document-page-text-{edition}.txt').read_bytes()
    text = json.loads(gzip.decompress(base64.b64decode(stored_text)))
    assert len(catalog['documents']) == len(text)
    return catalog['documents'], text


def verify_document(document, accessible):
    path = PUBLIC / document['url']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == document['sourceSHA256'], path
    ppi, links = [], []
    with fitz.open(path) as pdf:
        assert len(pdf) == document['pages'] == len(accessible)
        for number, page in enumerate(pdf, 1):
            filename = f"{document['prefix']}{number:02}.avif"
            for field, width in [('base', 1200), ('zoomBase', 2880)]:
                with Image.open(PUBLIC / document[field] / filename) as image:
                    assert image.width == width, (filename, field)
                    image.load()
            assert page.get_text().strip() == accessible[number-1].strip(), filename
            for image in page.get_image_info():
                transform = fitz.Matrix(*image['transform'])
                ppi.extend((round(image['width'] * 72 / math.hypot(transform.a, transform.b)),
                            round(image['height'] * 72 / math.hypot(transform.c, transform.d))))
            for block in page.get_text('dict', flags=fitz.TEXTFLAGS_TEXT)['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        bounds = fitz.Rect(span['bbox'])
                        page_edge = page.rect + (-.2,-.2,.2,.2)
                        assert page_edge.contains(bounds), (filename, number, span['text'])
            links.extend(page.get_links())
        assert min(ppi) >= 300 and len(pdf.get_toc()) == len(pdf), path.name
        assert len(links) == sum(map(len,document['pageLinks'].values())), path.name
        if document['prefix'] == 'atlas-':
            assert len(pdf) == 56 and len(pdf[1].get_links()) >= 20
            assert 'How to read the city' in pdf[2].get_text()
        else:
            assert len(pdf) == 4 and pdf.embfile_names(), path.name
    return dict(pages=document['pages'], sha256=digest, bytes=path.stat().st_size,
                printedPPI=[min(ppi), max(ppi)], links=len(links))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace', type=Path)
    parser.add_argument('--edition', required=True)
    parser.add_argument('--previous-edition', required=True)
    args = parser.parse_args()
    docs, texts = read_reader(args.edition)
    older, old_texts = read_reader(args.previous_edition)
    assert docs[:len(older)] == older and texts[:len(older)] == old_texts, 'Earlier reader catalogue or text changed'
    current = docs[len(older):]
    assert len(current) == 12 and all(doc['base'] == f'document-previews/edition-{args.edition}/' for doc in current)
    result = {doc['prefix'].rstrip('-'): verify_document(doc, text) for doc,text in zip(current, texts[len(older):])}
    for state in ['existing', 'construction', 'future']:
        source = PUBLIC/'downloads'/f'edition-{args.edition}'/f'Downtown-{state}-print.pdf'
        with fitz.open(source) as pdf:
            assert len(pdf)==1
            images=pdf[0].get_image_info()
            assert len(images)==1
            image=images[0]
            xppi=image['width']*72/pdf[0].rect.width
            yppi=image['height']*72/pdf[0].rect.height
            assert min(xppi,yppi)>=300 and (image['width'],image['height'])==(6144,3840)
        result['home-'+state]=dict(pages=1,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                                   bytes=source.stat().st_size,printedPPI=[round(xppi),round(yppi)])
    assert len(result) == 15 and sum(doc['pages'] for doc in current)==100
    output=args.workspace/'publication-verification.json'
    output.write_text(json.dumps(result,indent=2)+'\n')
    print('Verified 15 PDFs, 100 reader pages at two resolutions and',len(older),'archived records.')


if __name__=='__main__':
    main()
