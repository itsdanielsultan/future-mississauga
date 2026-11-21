"""Independently compare decoded mesh attributes, indexed topology and placement."""
import array
import collections
import hashlib
import json
import math
import struct
from build import ASSET_REFERENCES, GEOMETRY, HERE, mesh_nodes, stream_source, write_json, PUBLIC, ASSETS, gzip

IDENTITY = tuple(1 if i % 5 == 0 else 0 for i in range(16))


def multiply(p, q):
    return tuple(sum(p[k*4+row]*q[col*4+k] for k in range(4)) for col in range(4) for row in range(4))


def local(n):
    if 'matrix' in n:
        return n['matrix']
    x, y, z, w = n.get('rotation', (0, 0, 0, 1))
    sx, sy, sz = n.get('scale', (1, 1, 1))
    tx, ty, tz = n.get('translation', (0, 0, 0))
    return ((1-2*y*y-2*z*z)*sx, (2*x*y+2*z*w)*sx, (2*x*z-2*y*w)*sx, 0, (2*x*y-2*z*w)*sy, (1-2*x*x-2*z*z)*sy, (2*y*z+2*x*w)*sy, 0, (2*x*z+2*y*w)*sz, (2*y*z-2*x*w)*sz, (1-2*x*x-2*y*y)*sz, 0, tx, ty, tz, 1)


def read_digest(f, requested, identity=None):
    hdr = f.read(20)
    assert hdr[:4] == b'glTF'
    d = json.loads(f.read(struct.unpack_from('<I', hdr, 12)[0]))
    b = f.read(8)
    assert b[4:] == b'BIN\0'
    children = {c: i for i, n in enumerate(d['nodes']) for c in n.get('children', [])}
    world_mats = {}

    def world(i):
        if i not in world_mats:
            world_mats[i] = multiply(world(children[i]) if i in children else IDENTITY, local(d['nodes'][i]))
        return world_mats[i]
    groups = collections.defaultdict(list)
    wanted = set()
    for i, n in enumerate(d['nodes']):
        aid = identity or n.get('extras', {}).get('assetId')
        if aid not in requested or 'mesh' not in n:
            continue
        w = world(i)
        q = tuple(round(v, 7) for v in w)
        for p in d['meshes'][n['mesh']]['primitives']:
            assert p.get('mode', 4) == 4
            pos = p['attributes']['POSITION']
            idx = p.get('indices')
            wanted.add(pos)
            if idx is not None:
                wanted.add(idx)
            groups[aid].append((pos, idx, q))
    use_views = collections.defaultdict(list)
    for i in wanted:
        use_views[d['accessors'][i]['bufferView']].append(i)
    last = 0
    digest = {}
    dimensions = {}
    component = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
    for vi in sorted(use_views, key=lambda x: d['bufferViews'][x].get('byteOffset', 0)):
        v = d['bufferViews'][vi]
        off = v.get('byteOffset', 0)
        assert v.get('buffer', 0) == 0 and 'extensions' not in v
        # Consume skipped compressed bytes in bounded chunks to avoid materializing large city meshes.
        remain = off-last
        assert remain >= 0
        while remain:
            part = f.read(min(1024*1024, remain))
            assert part
            remain -= len(part)
        buf = f.read(v['byteLength'])
        assert len(buf) == v['byteLength']
        last = off+len(buf)
        for i in use_views[vi]:
            a = d['accessors'][i]
            kind, size = component[a['componentType']]
            count = a['count']
            nsize = {'SCALAR': 1, 'VEC3': 3}[a['type']]
            nbytes = size*nsize
            stride = v.get('byteStride', nbytes)
            start = a.get('byteOffset', 0)
            end = start+stride*(count-1)+nbytes
            assert end <= len(buf)
            flat = buf[start:end] if stride == nbytes else b''.join(
                buf[k:k+nbytes] for k in range(start, end, stride))
            if a['type'] == 'SCALAR':
                indices = array.array(kind)
                indices.frombytes(flat)
                assert len(indices) == count
                flat = array.array('I', indices).tobytes()
            else:
                assert kind == 'f'
                xyz = array.array(kind)
                xyz.frombytes(flat)
                assert len(xyz) == count*3
                actual = [[fn(xyz[axis::3]) for axis in range(3)] for fn in (min, max)]
                assert all(abs(actual[l][j]-a[key][j]) < .005 for l,
                           key in enumerate(['min', 'max']) for j in range(3))
                dimensions[i] = actual
            digest[i] = hashlib.sha256(flat).hexdigest()
    proofs = {}
    for aid, parts in groups.items():
        entries = []
        triangles = 0
        mins = [math.inf]*3
        maxs = [-math.inf]*3
        for pos, idx, w in parts:
            entries.append(str((digest[pos], digest[idx] if idx is not None else None, w)))
            triangles += d['accessors'][pos if idx is None else idx]['count']//3
            b = dimensions[pos]
            for mask in range(8):
                x, y, z = [b[(mask >> j) & 1][j] for j in range(3)]
                point = [w[j]*x+w[4+j]*y+w[8+j]*z+w[12+j] for j in range(3)]
                for j in range(3):
                    mins[j] = min(point[j], mins[j])
                    maxs[j] = max(point[j], maxs[j])
        proofs[aid] = {'decodedIndexedPositionWorldSHA256': hashlib.sha256('\n'.join(sorted(entries)).encode()).hexdigest(
        ), 'triangleCount': triangles, 'primitiveCount': len(parts), 'registeredBoundsEnclosingLocalBoxes': [[round(v, 3) for v in point] for point in (mins, maxs)]}
    return proofs


def main():
    out = {'method': 'Raw float position accessor bytes and uint32-normalized indices for each primitive, with world transform rounded to 7 decimals. Sorted mesh primitives to ignore scene node order. Every decoded position also checked against its declared local bounds. Bounds enclose transformed local boxes.', 'public': {}, 'fragment': {}, 'native': {}}
    for aid in ASSET_REFERENCES:
        with gzip.open(PUBLIC/ASSETS[aid]['url'], 'rb') as f:
            out['public'][aid] = read_digest(f, [aid], aid)[aid]
        with (HERE/(aid+'.glb')).open('rb') as f:
            out['fragment'][aid] = read_digest(f, [aid])[aid]
        assert out['public'][aid] == out['fragment'][aid], aid
    for sha, e in GEOMETRY.items():
        matches = set(e['assets']) & ASSET_REFERENCES.keys()
        if not matches:
            continue
        with stream_source(e['source']) as f:
            proof = read_digest(f, matches)
        for aid, v in proof.items():
            v['matchesDecodedPublic'] = v['decodedIndexedPositionWorldSHA256'] == out['public'][aid]['decodedIndexedPositionWorldSHA256']
            v['capturedSourceSHA256'] = e['assets'][aid]['sourceSHA256']
        out['native'][sha] = {'plates': e['plates'], 'geometry': proof}
        print(next(iter(e['plates'])), {aid: v['matchesDecodedPublic']
              for aid, v in proof.items()}, flush=True)
        write_json(HERE/'decoded-geometry-proof.json', out)
    scopes = json.loads((HERE/'by-scene.json').read_text())
    for sha, n in out['native'].items():
        expected = {r['assetId'] for r in scopes.get(sha, {}).get('replacements', [])}
        stale = {a for a, v in n['geometry'].items() if not v['matchesDecodedPublic']}
        if expected != stale:
            raise RuntimeError(f'{sha} planned replacements {expected}, actual mismatch {stale}')
    print('All decoded fragments match the current public models exactly. The native discrepancies match the planned revisions.')
