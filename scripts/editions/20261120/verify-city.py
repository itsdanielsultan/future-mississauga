"""Check the released city views against their actual Blender renders and print files."""
import argparse
import hashlib
import json
import math
import subprocess
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageColor

import native_storage

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / 'public'
FORMATS = ('displayMaster', 'download', 'signedMaster', 'signedPreview', 'signedThumbnail')


def read(path):
    return json.loads(path.read_text())


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_print_key(path, scenario):
    """Read the actual inset and locate its four possible rectangular colour samples."""
    expected = {'existing':1, 'construction':2}.get(scenario, 4)
    palette = [ImageColor.getrgb(row['colour']) for row in read(HERE/'print-key.json')]
    with Image.open(path) as image:
        width, height = image.size
        unit = width / (1840 if width > height else 1170)
        margin = round(32 * unit)
        inset = margin + round(12 * unit)
        bottom = height - margin - round(5 * unit)
        # The narrow untouched paper margin identifies its true top, including long credits.
        stripe = np.asarray(image.crop((inset, 0, inset+1, bottom+1)).convert('RGB'))[:,0,:]
        coloured = np.flatnonzero(np.any(stripe[:bottom] != 255, axis=1))
        assert coloured.size and np.all(stripe[bottom] == 255), path
        top = int(coloured[-1]) + 1
        for offset in (48,91):
            y = top + round(offset * unit)
            line = np.asarray(image.crop((inset, y, width-inset, y+1)).convert('RGB'))[0]
            found = []
            for colour in palette:
                mask = np.all(line == colour, axis=1)
                edges = np.flatnonzero(np.diff(np.r_[False,mask,False].astype(np.int8)))
                runs = edges[1::2] - edges[::2]
                found.append(any(12 * unit <= size <= 16 * unit + 1 for size in runs))
            if found == [i < expected for i in range(4)]:
                return expected
    raise ValueError(f'Printed legend differs from the shared colour key: {path}')


def verify_approved_downtown_surfaces(path):
    """Test the same registered camera positions against the original approved print."""
    # Fixed 1600 x 1000 proof coordinates. Only stable interiors are used here.
    samples = {
        'Block 5 Tower 1, upper facade': ((642, 235), (163, 125, 128)),
        'Block 5 Tower 1, lower facade': ((657, 330), (163, 123, 125)),
        'Square One main roof': ((840, 420), (152, 161, 166)),
        'Square One northeastern wing': ((959, 391), (152, 161, 166)),
        'Square One eastern wing': ((952, 417), (152, 161, 166)),
        'Cinema roof': ((873, 237), (153, 161, 166)),
        'Cinema neighbouring retail roof': ((877, 277), (150, 159, 165)),
        'Open ground south of mall': ((777, 481), (194, 196, 193)),
        'Open ground south of cinema': ((864, 255), (192, 193, 190)),
    }
    with Image.open(path) as source:
        frame = source.convert('RGB').resize((1600, 1000), Image.Resampling.LANCZOS)
    for subject, (point, approved) in samples.items():
        actual = frame.getpixel(point)
        assert max(abs(a-b) for a,b in zip(actual,approved)) <= 6, (subject,point,approved,actual)
    return len(samples)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--edition', default='20261120')
    parser.add_argument('--since', type=datetime.fromisoformat, help='Require native rendering to have begun on or after this UTC instant')
    parser.add_argument('--current-aliases', action='store_true', help='Also check the undated live aliases after cutover')
    args = parser.parse_args()
    work = args.workspace.resolve()
    views = read(HERE / 'cameras.json')['views']
    folder = 'edition-'+args.edition
    catalog = {r['id']: r for r in read(PUBLIC / 'data'/('city-plates-'+args.edition+'.json'))['plates']}
    assert len(views) == 72 and len(catalog) == 69
    native = {}
    city_photos = 0
    clean_previews = 0
    counted_tall_buildings = 0
    seen_recipes = set()
    key_samples = 0
    raw_camera_hashes = defaultdict(list)
    status_pixels = Counter()
    revision_scope = read(work/'complete-model-scope.json')['revisedIdentities'] if (work/'complete-model-scope.json').is_file() else []
    approved_path=work/'grade-approved.json'
    approved=read(approved_path) if approved_path.exists() else None
    for view in views:
        name = view['identity']
        stem = name.removesuffix('.png').replace('/', '-')
        proof = read(work / 'native' / stem / 'render-proof.json')
        assert proof['state'] == 'RENDERED_VISUAL_REVIEW_REQUIRED', name
        assert not proof['preview'] and proof['sourceBlend']['sha256'] == view['source'], name
        [frame] = proof['images']
        if name in revision_scope:
            correction = read(work/'revision-inputs'/(stem+'.json'))
            assert proof['replacementAdapter']['configuration']==correction, name
            revisions = proof.get('assetReplacements',[]) + proof.get('municipalReplacements',[])
            if proof.get('exchangePhaseGeometry'):
                exchange = proof['exchangePhaseGeometry']
                assert set(exchange['insertedTrianglesByPhase']) >= {'EX1','EX2','EXS'}, name
                assert ('EX3' in exchange['insertedTrianglesByPhase']) == (exchange['stage']!='existing'), name
                revisions.append(exchange)
            assert {r.get('sha256','removed') for r in revisions} == {r.get('sha256','removed') for r in correction['replacements']}, name
        raw_camera_hashes[frame['image']['sha256']].append(name)
        if args.since is not None:
            started = datetime.fromisoformat(frame['renderStartedUTC'].replace('Z','+00:00'))
            assert started >= args.since, (name,started)
        assert frame['identity'] == name and frame['camera'] == view['job']['camera'], name
        assert not frame['preview'] and frame['dimensions'] == view['job']['resolution'], name
        assert native_storage.verify(Path(frame['image']['path']), frame['image']['sha256']), name
        tone = read(work / 'toned' / (stem + '.json'))
        assert tone['sourceSHA256'] == frame['image']['sha256'], name
        if approved:
            assert tone.get('baseGradeRecipe',tone['gradeRecipe'])==approved['baseGradeRecipe'], name
            assert tone['towerStageRecipeSHA256']==approved['towerStageRecipeSHA256'], name
            if approved.get('nativeHeightSupplementSHA256'):
                assert tone['nativeHeightSupplementSHA256']==approved['nativeHeightSupplementSHA256'], name
            if approved.get('massingMaterialSHA256'):
                assert tone['massingMaterialSHA256']==approved['massingMaterialSHA256'], name
        if name=='home/downtown-future.png' and approved and approved.get('massingMaterialSHA256'):
            assert tone['geometricMaskPixels'].get('11',0)>0 and tone['geometricMaskPixels'].get('13',0)>0, 'Square One roof or proposed schematic building missing'
        status_pixels.update(tone['geometricMaskPixels'])
        counted_tall_buildings += bool(tone['geometricMaskPixels'].get('1'))
        if proof['district']=='cooksville':
            assert tone['municipalMidriseBuildings']==51 and tone['municipalMidriseMembershipSHA256'], name
            assert tone['gradeRecipe']!=tone['baseGradeRecipe'], name
        seen_recipes.add(tone.get('baseGradeRecipe',tone['gradeRecipe']))
        if 'wide/downtown-skyline-construction' in name:
            assert tone['geometricMaskPixels'].get('6', 0) > 0, 'Construction glazing missing'
            if approved:
                assert all(tone['geometricMaskPixels'].get(str(label),0)>0 for label in (7,8)), 'Detailed existing or construction towers missing'
        slots = proof.get('derivedDisplayMaterials', {}).get('changedSlots', [])
        assert not any(s['projectId'] == 'voya' and 'podium' in s['object'].lower() for s in slots), name
        receipt = read(work / 'original-receipts' / (stem + '.json'))
        assert receipt['sourceSHA256'] == frame['image']['sha256'], name
        if args.edition != '20261120':
            assert receipt['recipe']=='inset-attribution-map-key-v5', name
            key_samples += verify_print_key(PUBLIC/receipt['download']['url'], view['job']['scenario'])
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
        if name in catalog and args.edition!='20261120':
            for field,long_edge in (('cleanPreview',1600),('cleanThumbnail',640)):
                asset=catalog[name][field]
                path=PUBLIC/asset['url']
                assert path.stat().st_size==asset['bytes'] and digest(path)==asset['sha256'], name
                with Image.open(path) as preview:
                    assert preview.size==(asset['width'],asset['height']) and max(preview.size)==long_edge,name
                    preview.load()
                clean_previews+=1
    if args.edition != '20261120':
        # Authored, municipal and untextured neutral geometry have distinct calibrated treatments.
        families = {'existing':(1,7,15,16),'under construction':(4,6,8,12),
                    'proposed or approved':(2,5,9,13),'uncertain':(3,10,14)}
        for stage,categories in families.items():
            assert sum(status_pixels[str(k)] for k in categories)>0, f'No visible {stage} geometry'
        assert all(status_pixels[str(category)]>0 for category in (1,2,4,5,7,8,14,15,16)), 'Expected source material classes absent'
    assert len(seen_recipes) == 1, 'Some views still have an older presentation treatment.'
    for orientation in ('wide', 'portraits'):
        cameras = [native[orientation + '/downtown-skyline-' + s + '.png']['camera']
                   for s in ('existing', 'construction', 'future')]
        assert cameras[0] == cameras[1] == cameras[2]
        angle = 90 - math.degrees(cameras[0]['rotationEuler'][0])
        assert abs(angle - 22.8) < 0.2 and cameras[0]['type'] == 'ORTHO'
    home_stages = ('existing','construction','future')
    home_cameras = [native['home/downtown-'+stage+'.png']['camera'] for stage in home_stages]
    assert home_cameras[0]==home_cameras[1]==home_cameras[2], 'Homepage cameras differ'
    for scenario in home_stages:
        identity = 'home/downtown-' + scenario + '.png'
        width, height = native[identity]['dimensions']
        receipt = read(work / 'original-receipts' / ('home-downtown-' + scenario + '.json'))
        gallery = PUBLIC / 'gallery'/folder
        assert digest(gallery / ('home-' + scenario + '.png')) == receipt['download']['sha256']
        for size in (1200, 2560):
            preview = gallery / f'home-{scenario}-{size}.webp'
            alias = PUBLIC / 'gallery/city-plates' / f'downtown-{scenario}-{size}.webp'
            if args.current_aliases or args.edition=='20261120':
                assert digest(preview) == digest(alias)
            with Image.open(preview) as image:
                assert image.size == (size, round(size * height / width)), preview
        cover = PUBLIC / 'downloads'/folder/f'Downtown-{scenario}-print.pdf'
        listing = subprocess.check_output(['pdfimages', '-list', str(cover)], text=True)
        image_row = next(row.split() for row in listing.splitlines() if ' image ' in row)
        assert tuple(map(int, image_row[3:5])) == (width, height), cover
        assert min(int(image_row[12]), int(image_row[13])) >= 300, cover
    video = read(PUBLIC / 'data'/('downtown-film-'+args.edition+'.json'))
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
    material_samples = verify_approved_downtown_surfaces(PUBLIC/'gallery'/folder/'home-future.png') if args.edition=='20261121' else 0
    result = dict(approvedDowntownSurfaceSamples=material_samples, nativeRenders=len(native), verifiedPublicAssets=city_photos, verifiedCleanPreviews=clean_previews,
                  correctedNativeCameras=len(revision_scope), printedKeySwatches=key_samples,
                  nativeFramesSharingFileSHA256=[names for names in raw_camera_hashes.values() if len(names)>1],
                  nativeMaskPixelsByClass=dict(sorted(status_pixels.items())),
                  viewsWithVisibleTallBuildingMask=counted_tall_buildings,
                  stageCameraDownDegrees=round(angle, 2), verifiedHomePrints=len(home_stages),
                  filmSeconds=12, filmFrameCount=288)
    report = json.dumps(result, indent=2) + '\n'
    if args.report:
        args.report.write_text(report)
    print(report, end='')


if __name__ == '__main__':
    main()
