"""Measure tall existing City structures in the source geometry and rebuild the signed facet registry."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

HERE = Path(__file__).resolve().parent
NATIVE = HERE.parent / '20261120'
sys.path.insert(0, str(NATIVE))
import geometry_mask
import replay


def connected_shells(points, triangles):
    """Weld coincident source vertices at millimetre precision, including split face normals."""
    welded = np.ascontiguousarray(np.round(points, 3), dtype='<f4')
    _, vertices = np.unique(welded.view('V12').ravel(), return_inverse=True)
    face = vertices[triangles]
    a, b = face.ravel(), face[:, [1, 2, 0]].ravel()
    n = int(vertices.max()) + 1
    graph = coo_matrix((np.ones(len(a), dtype='u1'), (a, b)), shape=(n,n)).tocsr()
    count, labels = connected_components(graph, directed=False)
    membership = labels[vertices]
    lo = np.full((count, 3), np.inf)
    hi = np.full((count, 3), -np.inf)
    for axis in range(3):
        np.minimum.at(lo[:,axis], membership, points[:,axis])
        np.maximum.at(hi[:,axis], membership, points[:,axis])
    return membership[triangles[:,0]], lo, hi


def additions(points, faces, prior_boxes):
    components, lo, hi = connected_shells(points, faces)
    corners = points[faces]
    centres = corners.mean(axis=1)
    high = (hi[:,1] - lo[:,1])[components] >= 35
    upper_faces = corners[:,:,1].max(axis=1) >= lo[components,1] + 18
    selected = high & upper_faces
    for old_lo, old_hi in prior_boxes:
        indices = np.flatnonzero(selected & (centres[:,0] >= old_lo[0]-.06) & (centres[:,0] <= old_hi[0]+.06))
        inside = np.all((centres[indices] >= old_lo-.06) & (centres[indices] <= old_hi+.06), axis=1)
        selected[indices[inside]] = False
    edges = np.flatnonzero(np.diff(np.r_[False, selected, False].astype(np.int8)))
    spans = np.column_stack((edges[::2], edges[1::2])).tolist()
    measured = [(lo[k].round(3).tolist(), hi[k].round(3).tolist()) for k in np.unique(components[selected])]
    return spans, measured


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--map-bounds', type=Path, help='Also write the measured component bounds for the interactive map')
    args = parser.parse_args()
    data = json.loads((geometry_mask.PUBLIC/'data/existing-building-style.json').read_text())
    boxes = {}
    for record in data['records']:
        if record.get('id') and record['heightM'] >= 35:
            boxes.setdefault(record['tile'], []).append(np.array(record['bounds']))
    recipe = json.loads((NATIVE/'cameras.json').read_text())
    sources, stored, shapes = {}, {}, {}
    seen = set()
    for scene_id, scene in recipe['scenes'].items():
        original = args.archive/scene['importProof']
        replay.verify(original, scene['importSHA256'])
        source = replay.relocate(json.loads(original.read_text()), args.archive)['input']
        tiles = []
        for tile, _, points, faces in geometry_mask.mesh(source, {}, municipal_tiles_only=True):
            key = geometry_mask.geometry_digest(points, faces)
            tiles.append(key)
            if key in seen:
                continue
            seen.add(key)
            runs, measured = additions(points, faces, boxes.get(tile, []))
            if runs:
                stored[key] = {'tile':tile, 'faces':len(faces), 'runs':runs}
                for lo, hi in measured:
                    shapes[(tile,*lo,*hi)] = {'tile':tile,'bounds':[lo,hi],'heightM':round(hi[1]-lo[1],3)}
        sources[scene_id] = {'sourceGLBSHA256':source['sha256'], 'tileGeometry':tiles}
    description = ('Height of connected municipal existing building vertices welded to one millimetre, minimum 35 m. '
                   'Additional faces must reach 18 m above their connected base. Exact vertices, indices, source tile, '
                   'and occluding geometry are preserved. Previously styled municipal faces are excluded from this supplement.')
    args.output.write_text(json.dumps({'method':description, 'sourceScenes':sources, 'meshMasks':stored}, separators=(',',':'))+'\n')
    if args.map_bounds:
        args.map_bounds.write_text(json.dumps(list(shapes.values()), indent=2)+'\n')
    print(f'{len(sources)} packed sources, {len(stored)} corrected tile geometries and {len(shapes)} component bounds.')


if __name__=='__main__':
    main()
