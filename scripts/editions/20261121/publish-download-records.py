"""Publish view cameras and the atlas receipt from this edition's finished artwork."""
import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / 'public'
DOWNLOADS = PUBLIC / 'downloads'
EDITION = '20261121'
MODEL_CAMERA_FIELDS = (
    'location', 'rotationEuler', 'type', 'lens', 'orthoScale', 'sensorFit',
    'sensorWidth', 'sensorHeight', 'shift', 'clip'
)
ARCHIVE_HASH = 'aac58cf77f9e27d19c23c982915ff8c96a9c896439efdea3768b51d36a4fd7a7'
CAMERA_FILE = 'City-view-cameras-20261121.json'
STUDY_CAMERAS = 'Building-revision-cameras-20261121.json'


def read(path):
    return json.loads(path.read_text())


def sha256(path):
    with path.open('rb') as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
        return digest.hexdigest()


def require(test, message):
    if not test:
        raise ValueError(message)


def save(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    temporary.replace(path)


def cameras(work, plates):
    proofs = {}
    for path in work.rglob('render-proof.json'):
        for frame in read(path).get('images', []):
            if isinstance(frame, dict) and frame.get('camera') and frame.get('image', {}).get('sha256'):
                key = (frame['identity'], frame['image']['sha256'])
                proofs[key] = frame
    rows = []
    for plate in sorted(plates, key=lambda item: item['id']):
        identity = plate['id']
        key = identity, plate['sourceSHA256']
        require(key in proofs, f'{identity}: no exact native image match')
        frame = proofs[key]
        camera = frame['camera']
        require(frame['sourceInputSHA256'] == plate['sourceSceneSHA256'], f'{identity}: source scene mismatch')
        north = frame['north']['bearingClockwiseFromScreenUpDegrees']
        if 'northDegrees' in plate:
            require(abs((north - plate['northDegrees'] + 180) % 360 - 180) < .01, f'{identity}: compass mismatch')
        require(camera['type'] in ('PERSP','ORTHO'), f'{identity}: unknown camera projection')
        require(all(math.isfinite(v) for v in camera['location'] + camera['rotationEuler']), f'{identity}: invalid transform')
        output = plate['download']
        require(output['url'].startswith('gallery/edition-20261121/originals/'), f'{identity}: edition mismatch')
        require((PUBLIC / output['url']).stat().st_size == output['bytes'], f'{identity}: download size mismatch')
        require(sha256(PUBLIC / output['url']) == output['sha256'], f'{identity}: signed PNG mismatch')
        fields = {field: camera[field] for field in MODEL_CAMERA_FIELDS}
        for field in ('matrixWorld', 'quaternionWXYZ', 'target'):
            if field in camera:
                fields[field] = camera[field]
        rows.append({
            'id': identity, 'district': frame['district'], 'scenario': frame['scenario'],
            'sceneSHA256': frame['sourceInputSHA256'], 'nativeImageSHA256': frame['image']['sha256'],
            'nativePixels': frame['dimensions'], 'camera': fields, 'northDegrees': north,
            'signedPNG': '../' + output['url'], 'signedPixels': output['dimensions'], 'signedSHA256': output['sha256']
        })
    approved = set(read(work / f'edition-{EDITION}/dispatch.json')['identities'])
    actual = {r['id'] for r in rows}
    require(len(approved) == 72, 'Expected 69 city views and three separate homepage cameras')
    require(len(actual) == len(rows), 'Duplicate city camera')
    require(actual == approved, f'Camera identity mismatch. Missing {sorted(approved-actual)}; unexpected {sorted(actual-approved)}')
    return {
        'edition': EDITION, 'creator': 'Daniel Sultan',
        'coordinates': 'Native Blender scene coordinates in metres. +Z is up and +Y is north. XYZ Euler angles are in radians. Lens and sensor dimensions are in millimetres. Shift is in sensor units. North is measured clockwise from screen up.',
        'views': rows
    }


def publish_study_cameras(work):
    folder = work / f'edition-{EDITION}/revision-panels/renders'
    available = {}
    for path in folder.glob('*.json'):
        proof = read(path)
        if 'camera' in proof:
            available[proof['sha256']] = proof
    panels = read(PUBLIC / f'data/revision-panels-{EDITION}.json')['panels']
    rows = []
    for panel in panels:
        proof = available[panel['renderSHA256']]
        require(proof['recipeSHA256'] == panel['sourceRecipeSHA256'], 'Historical recipe differs')
        require(proof['dimensions'] == panel['renderSize'], 'Historical render size differs')
        camera = proof['camera']
        require(camera['type'] in ('ORTHO', 'PERSP') and len(camera['matrixWorld']) == 4, 'Missing replayed optics')
        require(sorted(set(proof['modelInputs'].values())) == panel['sourceHashes'], 'Historical model hashes differ')
        download = panel['download']
        require(sha256(PUBLIC / download['url']) == download['sha256'], 'Signed study image differs')
        rows.append({
            'project': panel['project'], 'label': panel['label'], 'originalCamera': panel['camera'],
            'camera': camera, 'nativePixels': panel['renderSize'], 'sourceGeometrySHA256': panel['sourceHashes'],
            'recipeSHA256': proof['recipeSHA256'], 'nativeImageSHA256': panel['renderSHA256'],
            'signedPNG': '../' + download['url'], 'signedSHA256': download['sha256']
        })
    require(len(rows) == 62, 'Missing building cameras')
    save(DOWNLOADS / STUDY_CAMERAS, {
        'edition': EDITION, 'creator': 'Daniel Sultan',
        'coordinates': 'Local Blender studio coordinates in metres. XYZ Euler values are in radians. Lens and sensor sizes are in millimetres. The original camera matrix includes the object transform. Framing applies to nativePixels before the image footer.',
        'views': rows
    })
    print(f'Published {len(rows)} source-replayed building revision cameras.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True, help='Local art-correction directory')
    parser.add_argument('--check-inputs', action='store_true', help='Check current studio receipts without publishing')
    parser.add_argument('--building-cameras', action='store_true', help='Publish verified historical study cameras independently')
    args = parser.parse_args()
    if args.building_cameras:
        publish_study_cameras(args.work)
        return
    index_path = PUBLIC / f'data/city-plates-{EDITION}.json'
    receipts = args.work / f'edition-{EDITION}/original-receipts'
    if args.check_inputs:
        plates = [read(p) for p in receipts.glob('*.json')]
    else:
        plates = list(read(index_path)['plates'])
        registered = {p['id'] for p in plates}
        for stage in ('existing', 'construction', 'future'):
            home = read(receipts / f'home-downtown-{stage}.json')
            if home['id'] not in registered:
                plates.append(home)
    book = cameras(args.work, plates)
    if args.check_inputs:
        print(f"Verified {len(book['views'])} camera, native render and signed PNG matches.")
        return

    pdf_url = f'downloads/edition-{EDITION}/Mississauga-Atlas.pdf'
    pdf = PUBLIC / pdf_url
    require(f'href="{pdf_url}"' in (PUBLIC / 'downloads.html').read_text(), 'Downloads still selects another edition')
    pinfo = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
    pages = int(re.search(r'^Pages:\s+(\d+)', pinfo, re.MULTILINE).group(1))
    previews_file = f'data/document-previews-{EDITION}.json'
    entries = read(PUBLIC / previews_file)['documents']
    preview = next(doc for doc in entries if doc['url'] == pdf_url)
    require(pages == preview['pages'] == 56, 'Atlas reader and printed page count disagree')
    digest = sha256(pdf)
    require(digest == preview['sourceSHA256'], 'Atlas digest disagrees with reader registry')
    archive = DOWNLOADS / 'Atlas-build-manifest-20261004.json'
    require(sha256(archive) == ARCHIVE_HASH, 'The original October receipt changed')
    october = read(archive)
    require(sha256(DOWNLOADS / october['file']) == october['sha256'], 'The original October atlas changed')
    archived_pdf = october['file'] + '?edition=' + october['sha256'][:16]
    require(f'downloads/{archived_pdf}' in (PUBLIC / 'downloads.html').read_text(), 'October download link changed')

    save(DOWNLOADS / CAMERA_FILE, book)
    save(DOWNLOADS / 'Atlas-build-manifest.json', {
        'edition': '2026-11-21', 'title': 'Mississauga Atlas', 'creator': 'Daniel Sultan',
        'file': pdf.relative_to(DOWNLOADS).as_posix(), 'pageCount': pages, 'bytes': pdf.stat().st_size,
        'sha256': digest, 'readerRegistry': '../' + previews_file,
        'cityViews': '../' + index_path.relative_to(PUBLIC).as_posix(), 'cameraRegistry': CAMERA_FILE,
        'buildingRevisionCameras': STUDY_CAMERAS,
        'priorReceipt': archive.name, 'priorReceiptSHA256': ARCHIVE_HASH, 'priorPDF': archived_pdf,
    })
    notes = DOWNLOADS / 'Refinement-notes.md'
    text = notes.read_text()
    anchor = '[Study camera settings](' + STUDY_CAMERAS + ')'
    city_link = '[City camera settings](' + CAMERA_FILE + ')'
    require(anchor in text, 'Source notes are missing their camera section')
    if city_link not in text:
        notes.write_text(text.replace(anchor, city_link + ' · ' + anchor))
    print(f"Published {len(book['views'])} city cameras and the {pages}-page atlas receipt.")


if __name__ == '__main__':
    main()
