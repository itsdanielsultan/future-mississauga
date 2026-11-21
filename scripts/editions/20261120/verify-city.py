"""Check the released city views against their actual Blender renders and print files."""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

from PIL import Image

import native_storage

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / 'public'
FORMATS = ('displayMaster', 'download', 'signedMaster', 'signedPreview', 'signedThumbnail')


def read(path):
    return json.loads(path.read_text())


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    work = args.workspace.resolve()
    views = read(HERE / 'cameras.json')['views']
    catalog = {r['id']: r for r in read(PUBLIC / 'data/city-plates-20261120.json')['plates']}
    assert len(views) == 71 and len(catalog) == 69
    native = {}
    city_photos = 0
    counted_tall_buildings = 0
    seen_recipes = set()
    for view in views:
        name = view['identity']
        stem = name.removesuffix('.png').replace('/', '-')
        proof = read(work / 'native' / stem / 'render-proof.json')
        assert proof['state'] == 'RENDERED_VISUAL_REVIEW_REQUIRED', name
        assert not proof['preview'] and proof['sourceBlend']['sha256'] == view['source'], name
        [frame] = proof['images']
        assert frame['identity'] == name and frame['camera'] == view['job']['camera'], name
        assert not frame['preview'] and frame['dimensions'] == view['job']['resolution'], name
        assert native_storage.verify(Path(frame['image']['path']), frame['image']['sha256']), name
        tone = read(work / 'toned' / (stem + '.json'))
        assert tone['sourceSHA256'] == frame['image']['sha256'], name
        counted_tall_buildings += bool(tone['geometricMaskPixels'].get('1'))
        seen_recipes.add(tone['gradeRecipe'])
        if 'wide/downtown-skyline-construction' in name:
            assert tone['geometricMaskPixels'].get('6', 0) > 0, 'Construction glazing missing'
        slots = proof.get('derivedDisplayMaterials', {}).get('changedSlots', [])
        assert not any(s['projectId'] == 'voya' and 'podium' in s['object'].lower() for s in slots), name
        receipt = read(work / 'original-receipts' / (stem + '.json'))
        assert receipt['sourceSHA256'] == frame['image']['sha256'], name
        for key in FORMATS:
            asset = receipt[key]
            if name in catalog:
                assert catalog[name][key] == asset, (name, key)
            file = PUBLIC / asset['url']
            with Image.open(file) as image:
                assert list(image.size) == asset['dimensions'], (name, key)
                if key in ('displayMaster', 'download', 'signedMaster'):
                    assert list(image.size) == frame['dimensions'], (name, key)
                if key == 'download':
                    assert image.info.get('Author', '').startswith('Daniel Sultan'), name
                image.verify()
            assert file.stat().st_size == asset['bytes'] and digest(file) == asset['sha256'], (name, key)
            city_photos += 1
        native[name] = frame
    assert len(seen_recipes) == 1, 'Some views still have an older presentation treatment.'
    for orientation in ('wide', 'portraits'):
        cameras = [native[orientation + '/downtown-skyline-' + s + '.png']['camera']
                   for s in ('existing', 'construction', 'future')]
        assert cameras[0] == cameras[1] == cameras[2]
        angle = 90 - math.degrees(cameras[0]['rotationEuler'][0])
        assert abs(angle - 22.8) < 0.2 and cameras[0]['type'] == 'ORTHO'
    for scenario in ('existing', 'future'):
        identity = 'home/downtown-' + scenario + '.png'
        width, height = native[identity]['dimensions']
        receipt = read(work / 'original-receipts' / ('home-downtown-' + scenario + '.json'))
        gallery = PUBLIC / 'gallery/edition-20261120'
        assert digest(gallery / ('home-' + scenario + '.png')) == receipt['download']['sha256']
        for size in (1200, 2560):
            preview = gallery / f'home-{scenario}-{size}.webp'
            alias = PUBLIC / 'gallery/city-plates' / f'downtown-{scenario}-{size}.webp'
            assert digest(preview) == digest(alias)
            with Image.open(preview) as image:
                assert image.size == (size, round(size * height / width)), preview
        cover = PUBLIC / 'downloads/edition-20261120' / f'Downtown-{scenario}-print.pdf'
        listing = subprocess.check_output(['pdfimages', '-list', str(cover)], text=True)
        image_row = next(row.split() for row in listing.splitlines() if ' image ' in row)
        assert tuple(map(int, image_row[3:5])) == (width, height), cover
        assert min(int(image_row[12]), int(image_row[13])) >= 300, cover
    video = read(PUBLIC / 'data/downtown-film-20261120.json')
    for key in ('film', 'poster', 'credits'):
        assert digest(PUBLIC / video[key]['url']) == video[key]['sha256'], key
    movie = PUBLIC / video['film']['url']
    details = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                         'stream=width,height,nb_frames:format=duration', '-of', 'json', str(movie)]))
    [stream] = details['streams']
    assert (stream['width'], stream['height'], int(stream['nb_frames'])) == (1920, 1080, 288)
    assert float(details['format']['duration']) == 12
    for index, row in enumerate(video['frames']):
        picture = native['wide/downtown-skyline-' + row['scenario'] + '.png']
        assert row['startSeconds'] == index * 4 and row['sourceImageSHA256'] == picture['image']['sha256']
    result = dict(nativeRenders=len(native), verifiedPublicAssets=city_photos,
                  viewsWithVisibleTallBuildingMask=counted_tall_buildings,
                  stageCameraDownDegrees=round(angle, 2), verifiedHomePrints=2,
                  filmSeconds=12, filmFrameCount=288)
    report = json.dumps(result, indent=2) + '\n'
    if args.report:
        args.report.write_text(report)
    print(report, end='')


if __name__ == '__main__':
    main()
