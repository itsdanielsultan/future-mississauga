"""Prepare five updated building meshes and the seven Bridge House components for a city replay."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'scene-refresh'))


def recorded_views(recipe):
    result = {}
    for identity, row in recipe['views'].items():
        stem = identity.removesuffix('.png').replace('/', '-')
        models = {r['model'] for r in row['replacements']
                  if recipe['models'][r['model']].get('path', '').startswith('scene-refresh/')}
        if models:
            result[stem] = models
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path,
                        help='Original packed model archive, starting at work/')
    parser.add_argument('--project-models', required=True, type=Path,
                        help='Output directory passed to replay.py')
    parser.add_argument('--public', type=Path,
                        default=HERE.parents[2] / 'public', help='Published project and municipal models')
    args = parser.parse_args()
    if not __debug__:
        parser.error('Run Python without -O so mesh checks remain enabled.')
    import build
    output = args.project_models.resolve() / 'scene-refresh'
    build.configure(args.archive.resolve(), args.public.resolve(), output)
    import bridge_house
    import verify

    build.main()
    verify.main()
    bridge_house.main()
    recipe = json.loads((HERE / 'city-project-replacements.json').read_text())
    fragments = [row for row in recipe['models'].values() if row.get('path', '').startswith('scene-refresh/')]
    if len(fragments) != 6:
        raise ValueError('The dated edition must contain six registered scene corrections')
    for row in fragments:
        path = args.project_models / row['path']
        if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError(f'Reconstructed model differs from the edition receipt: {path.name}')
    per_view = json.loads((output / 'by-plate.json').read_text())
    measured = {stem: {r['assetId'] for r in job['replacements']} for stem, job in per_view.items()}
    for stem in json.loads((output / 'bridge-house-camera-scope.json').read_text()):
        measured.setdefault(stem, set()).add('bridge-house-20261121')
    if measured != recorded_views(recipe):
        raise ValueError('The measured geometry or camera scope differs from the edition')
    print('All six source-derived files and their camera memberships match the public edition receipt.')


if __name__ == '__main__':
    main()
