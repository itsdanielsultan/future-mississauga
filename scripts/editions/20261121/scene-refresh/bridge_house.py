"""Extract and test the seven registered Bridge House components for native renders."""
import collections
import json
import math
import struct
import subprocess
import tempfile
from pathlib import Path
from build import RECIPE, GEOMETRY, HERE, PUBLIC, SHA, native_header, stream_source, write_json

REC = RECIPE.parent.parent / '20261120'
MUNICIPAL_SHA = '7138dffe8ff0eab094703602e388559bb5223fe01e581dc68c09a207a886e4c0'
IDS = {f'93-{n}' for n in range(742, 749)}


def chunk(kind, data):
    padding = b' ' if kind == b'JSON' else b'\0'
    data += padding*(-len(data) % 4)
    return struct.pack('<I4s', len(data), kind)+data


def uget(d, k):
    return {a: b for a, b in d.items() if a in k}


def extract(f, use_native=False):
    h = f.read(20)
    g = json.loads(f.read(struct.unpack_from('<I', h, 12)[0]))
    assert f.read(8)[4:] == b'BIN\0'
    chosen = {n.get('extras', {}).get('id', n.get('name')): n for n in g['nodes'] if 'mesh' in n and n.get(
        'extras', {}).get('id', n.get('name')) in IDS}
    parents = {c: i for i, n in enumerate(g['nodes']) for c in n.get('children', [])}
    for n in chosen.values():
        i = g['nodes'].index(n)
        while True:
            assert not any(k in g['nodes'][i] for k in ('translation', 'scale',
                           'rotation', 'matrix')), 'Unexpected transform on municipal geometry'
            if i not in parents:
                break
            i = parents[i]
    accessor_ids = set()
    for n in chosen.values():
        for p in g['meshes'][n['mesh']]['primitives']:
            accessor_ids.update([p['indices'], p['attributes']['POSITION']])
    by_view = collections.defaultdict(list)
    for i in accessor_ids:
        by_view[g['accessors'][i]['bufferView']].append(i)
    access = {}
    last = 0
    for vindex in sorted(by_view, key=lambda i: g['bufferViews'][i].get('byteOffset', 0)):
        v = g['bufferViews'][vindex]
        off = v.get('byteOffset', 0)
        todo = off-last
        assert todo >= 0 and v['buffer'] == 0
        while todo:
            read = f.read(min(todo, 1024*1024))
            assert read
            todo -= len(read)
        buf = f.read(v['byteLength'])
        assert len(buf) == v['byteLength']
        last = off+len(buf)
        for i in by_view[vindex]:
            a = g['accessors'][i]
            size, fmt = {5125: (4, 'I'), 5123: (2, 'H'), 5121: (1, 'B'), 5126: (12, '3f')}[a['componentType']]
            stride = v.get('byteStride', size)
            base = a.get('byteOffset', 0)
            access[i] = [struct.unpack_from('<'+fmt, buf, base+k*stride) for k in range(a['count'])]
    rows = {}
    for name, n in chosen.items():
        m = g['meshes'][n['mesh']]
        pr, = m['primitives']
        assert pr.get('mode', 4) == 4
        vert = access[pr['attributes']['POSITION']]
        ix = [x[0] for x in access[pr['indices']]]
        assert max(ix) < len(vert) and not len(ix) % 3
        triangles = [tuple(vert[j] for j in ix[k:k+3]) for k in range(0, len(ix), 3)]
        # Canonical triangle order distinguishes geometry without requiring compressor-specific vertex order.
        keys = sorted(tuple(sorted(t)) for t in triangles)
        signature = SHA(b''.join(struct.pack('<3f', *point) for tri in keys for point in tri))
        row = {'verts': vert, 'indices': ix, 'triangles': triangles, 'hash': signature,
               'extras': m.get('extras', {}) | n.get('extras', {}), 'count': len(triangles)}
        if use_native:
            row['material'] = g['materials'][pr['material']]
        rows[name] = row
    return rows


def camera_point(gltf, c):
    x, y, z = gltf
    dx, dy, dz = [a-b for a, b in zip((x, -z, y), c['location'])]
    cx, cy, cz = map(math.cos, c['rotationEuler'])
    sx, sy, sz = map(math.sin, c['rotationEuler'])
    return (dx*cz*cy+dy*sz*cy-dz*sy, dx*(cz*sy*sx-sz*cx)+dy*(sz*sy*sx+cz*cx)+dz*cy*sx, dx*(cz*sy*cx+sz*sx)+dy*(sz*sy*cx-cz*sx)+dz*cy*cx)


def visible_triangles(rows, j):
    c = j['camera']
    w, h = j['resolution']
    dim = h if c['sensorFit'] == 'VERTICAL' or c['sensorFit'] == 'AUTO' and h > w else w
    ortho = c['type'] == 'ORTHO'
    focal = dim/(c['orthoScale'] if ortho else (c['sensorHeight']
                 if c['sensorFit'] == 'VERTICAL' else c['sensorWidth'])/c['lens'])
    sx, sy = c['shift']
    cx = w/2-dim*sx
    cy = h/2+dim*sy
    near, far = c['clip']

    def planes(v):
        x, y, z = v
        size = 1 if ortho else -z
        return (-z-near, far+z, focal*x+cx*size, (w-cx)*size-focal*x, cy*size-focal*y, (h-cy)*size+focal*y)

    def clips(tri):
        poly = [camera_point(x, c) for x in tri]
        for k in range(6):
            if not poly:
                return False
            res = []
            a = poly[-1]
            av = planes(a)[k]
            for b in poly:
                bv = planes(b)[k]
                if (av < 0) != (bv < 0):
                    t = av/(av-bv)
                    res.append(tuple(x+(y-x)*t for x, y in zip(a, b)))
                if bv >= 0:
                    res.append(b)
                a = b
                av = bv
            poly = res
        return bool(poly)
    return {n: sum(clips(t) for t in r['triangles']) for n, r in rows.items()}


def main():
    municipal = PUBLIC/'models/port-credit.glb'
    if SHA(municipal.read_bytes()) != MUNICIPAL_SHA:
        raise ValueError('Port Credit municipal mesh bytes have changed')
    with tempfile.TemporaryDirectory() as td:
        plain = Path(td)/'port-credit.glb'
        subprocess.run(['node', str(REC/'buildings/decode-meshopt.mjs'),
                       str(municipal), str(plain)], check=True)
        with plain.open('rb') as f:
            town = extract(f)
    assert set(town) == IDS
    counts = {}
    audits = {}
    mats = {}
    for sha, scene in GEOMETRY.items():
        document = native_header(scene['source'])
        count = sum('mesh' in n and n.get('extras', {}).get('id') in IDS for n in document['nodes'])
        counts[sha] = count
        if not count:
            continue
        with stream_source(scene['source']) as f:
            captured = extract(f, True)
        assert count == len(IDS) and set(captured) == IDS
        for name, r in captured.items():
            assert town[name]['hash'] == r['hash'], (name, town[name]['hash'], r['hash'])
            if scene['district'] == 'port-credit':
                mats[name] = r['material']
        audits[sha] = {'componentCount': count, 'verifiedAgainstPublicMunicipalGLB': True,
                       'district': scene['district'], 'stage': scene['stage']}
    doc = {'asset': {'version': '2.0', 'generator': 'Future Mississauga municipal geometry extraction'}, 'scenes': [{'nodes': list(
        range(len(IDS)))}], 'scene': 0, 'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
    buffer = bytearray()

    def field(raw, typ, ctype, num, extra=None):
        offset = len(buffer)
        buffer.extend(raw)
        buffer.extend(b'\0'*(-len(buffer) % 4))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw)})
        idx = len(doc['accessors'])
        doc['accessors'].append({'bufferView': view, 'type': typ,
                                'componentType': ctype, 'count': num} | (extra or {}))
        return idx
    for i, name in enumerate(sorted(IDS)):
        r = town[name]
        v = r['verts']
        indices = r['indices']
        p = field(b''.join(struct.pack('<3f', *point) for point in v), 'VEC3', 5126,
                  len(v), {'min': list(map(min, zip(*v))), 'max': list(map(max, zip(*v)))})
        ix = field(struct.pack('<'+'H'*len(indices), *indices), 'SCALAR', 5123, len(indices))
        extras = r['extras'] | {'id': name, 'name': name, 'projectId': 'brightwater-bridge-house', 'Status': 'Under Construction', 'displayStatus': 'Under Construction', 'reviewedDisplayStatus': 'Under Construction', 'lifecycle': 'under_construction',
                                'statusReviewDate': '2026-11-17', 'uncertain': False, 'recordedProgress': False, 'constructionDesign': False, 'modes': ['future'], 'geometryState': 'Municipal architectural envelope. Groundbreaking records project status. Built-to-date geometry is unverified.'}
        doc['nodes'].append({'name': name, 'mesh': i, 'extras': extras})
        doc['materials'].append(mats[name])
        doc['meshes'].append({'name': name, 'primitives': [
                             {'mode': 4, 'attributes': {'POSITION': p}, 'indices': ix, 'material': i}]})
    doc['buffers'] = [{'byteLength': len(buffer)}]
    body = chunk(b'JSON', json.dumps(doc, separators=(',', ':')).encode())+chunk(b'BIN\0', bytes(buffer))
    frag = HERE/'bridge-house-20261121.glb'
    frag.write_bytes(struct.pack('<4sII', b'glTF', 2, len(body)+12)+body)
    with frag.open('rb') as f:
        check = extract(f)
    assert all(v['hash'] == town[n]['hash'] for n, v in check.items())
    def stem(identity): return identity.removesuffix('.png').replace('/', '-')
    sources = {plate: sha for sha, scene in GEOMETRY.items() for plate in scene['plates']}
    cameras = json.loads((REC/'cameras.json').read_text())['views']
    scopes = {}
    allc = {}
    for camera in cameras:
        identity = camera['identity']
        key = stem(identity)
        sha = sources[key]
        stage = GEOMETRY[sha]['stage']
        count = counts[sha]
        j = camera['job']
        hit = visible_triangles(town, j)
        inside = any(hit.values())
        allc[key] = {'stage': stage, 'originalSceneSHA256': sha,
                     'oldMeshCount': count, 'trianglesInsideFrustumByComponent': hit}
        if not count or not inside:
            continue
        action = {'project': 'bridge-house',
                  'componentIds': sorted(IDS), 'oldMeshCount': count, 'lifecycle': 'under_construction'}
        if stage == 'future':
            action.update({'path': str(frag), 'sha256': SHA(frag.read_bytes()),
                          'triangles': sum(v['count'] for v in town.values())})
        else:
            action['removeOnly'] = True
        scopes[key] = [action]
    write_json(HERE/'bridge-house-camera-scope.json', scopes)
    write_json(HERE/'bridge-house-proof.json', {'publicGeometry': str(municipal), 'municipalSHA256': SHA(municipal.read_bytes()), 'sourceGeometryComparisons': audits, 'components': {k: {'triangles': r['count'], 'decodedTriangleSHA256': r['hash']} for k, r in town.items()}, 'replacementSHA256': SHA(
        frag.read_bytes()), 'policy': 'Future complete envelope only. No newly built geometry or dated construction progress inferred. Preserve original full-district geographic inclusion. Visibility means triangle intersects actual camera frustum, independent of occlusion.', 'cameras': allc, 'changed': list(scopes)})
    print(len(scopes), 'scoped cameras:', *scopes)
