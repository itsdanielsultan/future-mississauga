"""Apply the approved grey tower tone to municipal mid-rise buildings in Cooksville."""
import hashlib
import json
from pathlib import Path

import numpy as np
import grade
import geometry_mask

public = geometry_mask.PUBLIC
districts = json.loads((public / 'data/districts.json').read_text())
west, north, east, south = next(d['bounds'] for d in districts if d['id'] == 'cooksville')
catalogue = public / 'data/existing-building-style.json'
records = json.loads(catalogue.read_text())['records']
included = []
for building in records:
    if 18 <= building['heightM'] < 35:
        box = np.array(building['bounds'])
        x, _, z = box.mean(axis=0)
        if west <= x <= east and north <= z <= south:
            geometry_mask.bounds.setdefault(building['tile'], []).append(box)
            included.append(building['id'])
if not included:
    raise ValueError('Missing municipal mid-rise records for Cooksville')
base_recipe = grade.finger
membership = hashlib.sha256(json.dumps(sorted(included)).encode()).hexdigest()
grade.finger = hashlib.sha256(base_recipe.encode() + membership.encode() + Path(__file__).read_bytes()).hexdigest()
requested = set(grade.args.only or [])
for path in sorted((grade.w / 'native').glob('*/render-proof.json')):
    proof = json.loads(path.read_text())
    if proof['state'] != 'RENDERED_VISUAL_REVIEW_REQUIRED' or proof['district'] != 'cooksville':
        continue
    for frame in proof['images']:
        identity = frame['identity']
        if requested and identity not in requested:
            continue
        grade.process(proof, frame)
        record = grade.out / (identity.removesuffix('.png').replace('/', '-') + '.json')
        data = json.loads(record.read_text())
        data.update(baseGradeRecipe=base_recipe, municipalMidriseBuildings=len(included),
                    municipalMidriseMembershipSHA256=membership)
        temp = record.with_suffix('.partial')
        temp.write_text(json.dumps(data, indent=2) + '\n')
        temp.replace(record)
