"""Rasterize the visible geometry classes used for the November Downtown colour match."""
from pathlib import Path
import ctypes as C
import gzip
import hashlib
import json
import struct
import subprocess
import sysconfig
import numpy as np
PUBLIC = Path(__file__).resolve().parents[3] / 'public'
SOURCE = Path(__file__).with_name('tower-mask.cpp')

def initialise(directory):
    global fn, bounds
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()[:12]
    target = directory / ('tower-mask-' + digest + sysconfig.get_config_var('SHLIB_SUFFIX'))
    if not target.is_file():
        subprocess.run(['c++', '-std=c++17', '-O3', '-shared', '-fPIC', str(SOURCE), '-o', str(target)], check=True)
    fn = C.CDLL(str(target)).shade_mask
    fn.argtypes = [C.c_void_p, C.c_void_p, C.c_int, C.c_int, C.c_void_p, C.c_void_p, C.c_void_p, C.c_int] + [C.c_double] * 4 + [C.c_int]
    fn.restype = None
    bounds = {}
    for row in json.loads((PUBLIC / 'data/existing-building-style.json').read_text())['records']:
        if row['heightM'] >= 35:
            bounds.setdefault(row['tile'], []).append(np.array(row['bounds']))

def quat(vals):
    (x, y, z, w) = vals
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])

def xyz(vals):
    (x, y, z) = vals
    (cx, cy, cz) = np.cos(vals)
    (sx, sy, sz) = np.sin(vals)
    return np.array([[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx], [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx], [-sy, cy * sx, cy * cx]])

def mesh(source, semantic):
    p = Path(source['path'])
    raw = p.read_bytes() if p.is_file() else gzip.decompress(Path(str(p) + '.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest() == source['sha256']
    n = struct.unpack_from('<I', raw, 12)[0]
    d = json.loads(raw[20:20 + n])
    start = 28 + n

    def values(idx):
        a = d['accessors'][idx]
        v = d['bufferViews'][a['bufferView']]
        t = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
        size = np.dtype(t).itemsize
        dim = {'VEC3': 3, 'SCALAR': 1}[a['type']]
        return np.ndarray((a['count'], dim), dtype=t, buffer=raw, offset=start + v.get('byteOffset', 0) + a.get('byteOffset', 0), strides=(v.get('byteStride', dim * size), size))

    def visit(i, parent):
        node = d['nodes'][i]
        e = node.get('extras', {})
        a = np.eye(4)
        if 'matrix' in node:
            a = np.array(node['matrix']).reshape(4, 4).T
        else:
            a[:3, :3] = quat(node.get('rotation', [0, 0, 0, 1])) * node.get('scale', [1, 1, 1])
            a[:3, 3] = node.get('translation', [0, 0, 0])
        a = parent @ a
        if 'mesh' in node:
            for part in d['meshes'][node['mesh']]['primitives']:
                if part.get('mode', 4) != 4:
                    continue
                pos = values(part['attributes']['POSITION'])
                world = pos @ a[:3, :3].T + a[:3, 3]
                face = np.ascontiguousarray(values(part['indices']).ravel() if 'indices' in part else np.arange(len(pos)), dtype=np.uint32).reshape(-1, 3)
                selected = np.zeros(len(face), 'uint8')
                if (e.get('lifecycle') == 'existing' or e.get('Status') == 'Existing') and (not e.get('assetId')) and (not e.get('preserveFinish')):
                    if e.get('id') and np.ptp(world[:, 1]) >= 35:
                        selected.fill(1)
                    elif e.get('tile') in bounds:
                        centers = world[face].mean(axis=1)
                        for (lo, hi) in bounds[e['tile']]:
                            ix = np.flatnonzero((centers[:, 0] >= lo[0] - 0.06) & (centers[:, 0] <= hi[0] + 0.06))
                            selected[ix[np.all((centers[ix] >= lo - 0.06) & (centers[ix] <= hi + 0.06), axis=1)]] = 1
                if node.get('name') in semantic:
                    selected.fill(semantic[node['name']])
                yield (world, face, selected)
        for child in node.get('children', []):
            yield from visit(child, a)
    for i in d['scenes'][d.get('scene', 0)]['nodes']:
        yield from visit(i, np.eye(4))

def categories(pr, i):
    (width, height) = i['dimensions']
    cam = i['camera']
    fit = cam['sensorFit']
    east = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]])
    basis = xyz(cam['rotationEuler'])
    rotation = east @ basis
    origin = np.array(cam['location']) @ basis
    max_fit = height if fit == 'VERTICAL' or (fit == 'AUTO' and height > width) else width
    sensor = cam['sensorHeight'] if fit == 'VERTICAL' else cam['sensorWidth']
    ortho = cam['type'] == 'ORTHO'
    focal = max_fit / (cam['orthoScale'] if ortho else sensor / cam['lens'])
    cx = width / 2 - max_fit * cam['shift'][0]
    cy = height / 2 + max_fit * cam['shift'][1]
    depth = np.full((height, width), np.inf, 'float32')
    mask = np.zeros((height, width), 'uint8')
    cats = {'proposed': 2, 'unknown': 3, 'mixed': 3, 'under_construction': 4, 'approved': 5}
    semantic = {s['object']: cats[s['lifecycle']] for s in pr.get('derivedDisplayMaterials', {}).get('changedSlots', []) if s['lifecycle'] in cats and s['projectId'] != 'voya'}
    for (world, faces, sel) in mesh(pr['sourceGLB'], semantic):
        camspace = np.ascontiguousarray(world @ rotation - origin, dtype=np.float64)
        fn(depth.ctypes.data, mask.ctypes.data, width, height, camspace.ctypes.data, faces.ctypes.data, sel.ctypes.data, len(faces), focal, cx, cy, cam['clip'][0], int(ortho))
    return mask
