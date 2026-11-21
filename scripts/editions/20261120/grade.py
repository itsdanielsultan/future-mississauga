"""Match the approved print tone while preserving the podium and existing building materials."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
import geometry_mask
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
parser.add_argument('--only', nargs='+', help='Apply the shared treatment only to the specified camera identities')
args = parser.parse_args()
w = args.workspace.resolve()
out = w / 'toned'
out.mkdir(exist_ok=True)
geometry_mask.initialise(out)
palette = Path(__file__).with_name('cover-colour-samples.json')
config = json.loads(palette.read_text())
level = np.array(config['x'])
x = np.arange(256)
grade = np.zeros((6, 256, 3), 'float32')
for label in [0, 1, 2]:
    curve = np.array(config['classes'][str(label)]['deltas'])
    for ch in range(3):
        grade[label, :, ch] = np.interp(x, level, curve[:, ch])
common = grade[0].mean(axis=1)
for (label, balance) in [(3, [0.5, -0.24, 0.74]), (4, [-0.56, 0.3, 0.54]), (5, [0.7, 0.1, -0.5])]:
    grade[label] = common[:, None] * 0.82 + np.array(balance)[None, :] * np.minimum(18, x / 6)[:, None]
finger = hashlib.sha256(palette.read_bytes() + Path(__file__).read_bytes() + Path(geometry_mask.__file__).read_bytes() + geometry_mask.SOURCE.read_bytes()).hexdigest()

def process(pr, fr):
    stem = fr['identity'].removesuffix('.png').replace('/', '-')
    target = out / (stem + '.png')
    record = out / (stem + '.json')
    if record.is_file() and target.is_file():
        old = json.loads(record.read_text())
        if old.get('sourceSHA256') == fr['image']['sha256'] and old.get('gradeRecipe') == finger:
            return
    mask = geometry_mask.categories(pr, fr)
    pixels = np.array(Image.open(fr['image']['path']).convert('RGBA'))
    weights = []
    for label in range(1, 7):
        if not (mask == label).any():
            continue
        coverage = Image.fromarray(np.uint8(mask == label) * 255).filter(ImageFilter.GaussianBlur(0.65))
        weights.append((label, np.asarray(coverage)))
    for y in range(0, len(pixels), 100):
        pix = pixels[y:y + 100, :, :3]
        luminosity = np.uint8(np.rint(pix @ np.array([0.2126, 0.7152, 0.0722], dtype='float32')))
        delta = grade[0, luminosity].copy()
        for (label, coverage) in weights:
            alpha = coverage[y:y + 100, :, None].astype('float32') / 255.0
            if label == 6:
                # Retain reflections and building detail in this cartographic overlay.
                # Neutral glass takes the construction colour while saturated finishes stay authored.
                saturation = np.ptp(pix.astype('float32'), axis=2)
                neutral = np.clip((76 - saturation) / 48, 0, 1)[:, :, None]
                shade = np.array([-0.16, 0.041, 0.12], dtype='float32')
                change = shade * np.clip(luminosity.astype('float32') + 36, 66, 220)[:, :, None]
                delta += alpha * neutral * change
            else:
                delta += alpha * (grade[label, luminosity] - grade[0, luminosity])
        weight = np.clip(luminosity.astype('float32') / 36, 0, 1)
        pix[:] = np.rint(np.clip(pix + delta * weight[:, :, None], 0, 255)).astype('uint8')
    temp = target.with_suffix('.writing')
    Image.fromarray(pixels).save(temp, 'PNG', compress_level=1)
    temp.replace(target)
    result = {'sourceSHA256': fr['image']['sha256'], 'gradeSHA256': hashlib.sha256(target.read_bytes()).hexdigest(), 'gradeRecipe': finger, 'cameraType': fr['camera']['type'], 'reference': 'October 23 approved Downtown print 2983a42697af', 'referenceSamplePixels': sum((row['pixels'] for row in config['classes'].values())), 'treatment': 'Measured reference luminance for common ground, targeted grey for tall existing municipal buildings, material-specific proposed/uncertain colour. Source architectural finishes remain discernible.', 'geometricMaskPixels': {str(label): int((mask == label).sum()) for (label, _) in weights}}
    temp = record.with_suffix('.writing')
    temp.write_text(json.dumps(result, indent=2))
    temp.replace(record)
    print('MATCHED', stem, flush=True)
if __name__ == '__main__':
    selected = set(args.only or [])
    for receipt in sorted((w / 'native').glob('*/render-proof.json')):
        native = json.loads(receipt.read_text())
        if native['state'] != 'RENDERED_VISUAL_REVIEW_REQUIRED':
            continue
        for frame in native['images']:
            if not selected or frame['identity'] in selected:
                process(native, frame)
