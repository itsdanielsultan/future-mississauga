"""Rasterize visible city materials and their verified development status."""
from pathlib import Path
import ctypes as C
import gzip
import hashlib
import json
import re
import struct
import subprocess
import sysconfig
import numpy as np
PUBLIC = Path(__file__).resolve().parents[3] / 'public'
SOURCE = Path(__file__).with_name('tower-mask.cpp')
TOWER_RULES = PUBLIC / 'data/tower-stage-calibration.json'
NATIVE_HEIGHT_RECORDS = Path(__file__).resolve().parents[1] / '20261121/native-existing-facets.json'
MASSING_MATERIALS = NATIVE_HEIGHT_RECORDS.with_name('plan-massing-materials.json')
MALL_FACETS = NATIVE_HEIGHT_RECORDS.with_name('square-one-mall-facets.json')
COMMERCIAL_FACETS = NATIVE_HEIGHT_RECORDS.with_name('commercial-existing-facets.json')
commercial_facets = json.loads(COMMERCIAL_FACETS.read_text()) if COMMERCIAL_FACETS.is_file() else {}
commercial_tiles = {entry['tile'] for entry in commercial_facets.values()}
massing_materials = json.loads(MASSING_MATERIALS.read_text())
mall_facets = json.loads(MALL_FACETS.read_text()) if MALL_FACETS.exists() else {}


def default_neutral_material(primitive, material):
    pbr = material.get('pbrMetallicRoughness', {})
    return (not material.get('name') and 'baseColorTexture' not in pbr
            and 'COLOR_0' not in primitive['attributes']
            and pbr.get('baseColorFactor') == massing_materials['neutralBaseColorFactor'])


def neutral_status_class(node, primitive, material):
    metadata = node.get('extras', {})
    if metadata.get('preserveFinish') or not default_neutral_material(primitive, material):
        return 0
    stage = metadata.get('lifecycle')
    asset_id = metadata.get('assetId')
    if not asset_id:
        # Untextured municipal project envelopes carry their reviewed component lifecycle.
        # Baseline homes, terrain and infrastructure are outside this assignment.
        if not metadata.get('id'):
            return 0
        return {'under_construction':12,'proposed':13,'approved':13,'unknown':14}.get(stage,0)
    existing = massing_materials['existingTowerBodies'].get(asset_id)
    if existing and stage == 'existing' and node.get('name') in existing['nodes']:
        if (existing['projectId'] == metadata.get('projectId') and
                existing['sourceAssetSHA256'] == metadata.get('sourceAssetSHA256')):
            return existing.get('class',15)
    asset = massing_materials['neutralModels'].get(asset_id)
    if not asset or asset['project'] != metadata.get('projectId') or asset['sha256'] != metadata.get('sourceAssetSHA256'):
        return 0
    return {'under_construction':12,'proposed':13,'approved':13,'unknown':14,'on_hold':14}.get(stage,0)

height_masks_by_tile = {}
for shape_digest, height_record in json.loads(NATIVE_HEIGHT_RECORDS.read_text())['meshMasks'].items():
    height_masks_by_tile.setdefault(height_record['tile'], {})[shape_digest] = height_record


def geometry_digest(positions, faces):
    checksum = hashlib.sha256()
    checksum.update(np.asarray(positions, dtype='<f4').tobytes())
    checksum.update(np.asarray(faces, dtype='<u4').tobytes())
    return checksum.hexdigest()

tower_rules = json.loads(TOWER_RULES.read_text())
PLANNING_COMPONENTS = Path(__file__).resolve().parents[1] / '20261121' / 'planning-components.json'
planning_components = json.loads(PLANNING_COMPONENTS.read_text())['components']
protected_part = re.compile(tower_rules['protectedParts'], re.I)
tower_materials = {project:re.compile(pattern,re.I) for project,pattern in tower_rules['towerMaterials'].items()}
exchange_crown = re.compile(tower_rules['exchange']['crownMaterial'],re.I)

def tower_faces(node, material, points, faces):
    """Classify only evidenced facade surfaces. A handled, protected part returns zero."""
    data = node.get('extras', {})
    project, asset, lifecycle = data.get('projectId'), data.get('assetId'), data.get('lifecycle')
    name = node.get('name', '')
    label = tower_rules['maskClasses'].get(lifecycle,0)
    if project not in tower_materials and project != 'exchange-district':
        return None
    if asset:
        pin = tower_rules['assets'].get(asset, {})
        if pin.get('project') != project or data.get('sourceAssetSHA256') not in pin.get('sha256',[]):
            return None
    elif project != 'exchange-district':
        return None
    if project != 'exchange-district':
        return label if not protected_part.search(name) and tower_materials[project].search(material) else 0
    if not label or not re.search(r'exchange_63-615[56]_node',name,re.I) or exchange_crown.search(name):
        return 0
    # A single textured Exchange primitive can contain podium, shaft and roof.
    # Native source coordinates keep the same Y datum across these registered scenes.
    triangles = points[faces]
    normal = np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    vertical = np.abs(normal[:,1]) < np.linalg.norm(normal,axis=1)*tower_rules['exchange']['verticalCosineMax']
    above_podium = triangles[:,:,1].min(axis=1) >= tower_rules['exchange']['podiumCeilingY']
    return np.where(vertical & above_podium,label,0)

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

def mesh(source, semantic, *, replace_exchange=False, replaced_assets=(), replaced_components=(), municipal_stages=None, municipal_tiles_only=False, inspect_materials=False):
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
        is_old_exchange = (e.get('projectId') == 'exchange-district' or e.get('assetId') == 'exchange-recorded-topped-structures' or e.get('id') in ('63-6155', '63-6156') or 'exchange_63-615' in node.get('name','').lower())
        if 'mesh' in node and e.get('id') not in replaced_components and e.get('assetId') not in replaced_assets and not (replace_exchange and is_old_exchange):
            for part in d['meshes'][node['mesh']]['primitives']:
                if part.get('mode', 4) != 4:
                    continue
                pos = values(part['attributes']['POSITION'])
                world = pos @ a[:3, :3].T + a[:3, 3]
                face = np.ascontiguousarray(values(part['indices']).ravel() if 'indices' in part else np.arange(len(pos)), dtype=np.uint32).reshape(-1, 3)
                if municipal_tiles_only:
                    if e.get('tile') is not None and e.get('lifecycle')=='existing' and not e.get('assetId') and not e.get('preserveFinish'):
                        yield (int(e['tile']), node['name'], world, face)
                    continue
                selected = np.zeros(len(face), 'uint8')
                if (e.get('lifecycle') == 'existing' or e.get('Status') == 'Existing') and (not e.get('assetId')) and (not e.get('preserveFinish')):
                    if e.get('id') and np.ptp(world[:, 1]) >= 35:
                        selected.fill(1)
                    elif e.get('tile') in bounds:
                        centers = world[face].mean(axis=1)
                        for (lo, hi) in bounds[e['tile']]:
                            ix = np.flatnonzero((centers[:, 0] >= lo[0] - 0.06) & (centers[:, 0] <= hi[0] + 0.06))
                            selected[ix[np.all((centers[ix] >= lo - 0.06) & (centers[ix] <= hi + 0.06), axis=1)]] = 1
                    # These exact City surfaces belong to measured towers missed by the older
                    # component index. Face runs are tied to all source vertices and indices.
                    tile = e.get('tile')
                    tile_masks = height_masks_by_tile.get(tile)
                    has_measured_facets = tile in commercial_tiles or tile == massing_materials['mall']['tile'] or tile_masks
                    fingerprint = geometry_digest(world, face) if has_measured_facets else None
                    if tile in commercial_tiles:
                        commercial = commercial_facets.get(fingerprint)
                        if commercial:
                            assert len(face) == commercial['faces']
                            for first, end in commercial['runs']:
                                current = selected[first:end]
                                current[current==0] = 11
                    if tile == massing_materials['mall']['tile']:
                        mall = mall_facets.get(fingerprint)
                        if mall:
                            assert len(face) == mall['faces']
                            for first, end in mall['runs']:
                                selected[first:end] = 11
                    if e.get('id') in massing_materials['mall']['municipalIds']:
                        selected.fill(11)
                    if tile_masks:
                        measured = tile_masks.get(fingerprint)
                        if measured:
                            assert len(face) == measured['faces']
                            for first, end in measured['runs']:
                                selected[first:end] = 1
                source_material = d['materials'][part['material']].get('name','') if 'material' in part else ''
                tower = tower_faces(node, source_material, world, face)
                if tower is not None:
                    selected[:] = tower
                elif municipal_stages and e.get('id') in municipal_stages:
                    selected.fill(municipal_stages[e['id']])
                elif e.get('id') in planning_components and e.get('lifecycle') == 'unknown':
                    # The dated ID-level review established filed/approved planning for these
                    # untextured components. Both statuses use the single pale-pink map swatch.
                    selected.fill(5)
                elif node.get('name') in semantic:
                    selected.fill(semantic[node['name']])
                elif 'material' in part and (massing_class := neutral_status_class(node, part, d['materials'][part['material']])):
                    selected.fill(massing_class)
                elif e.get('lifecycle') == 'under_construction' and e.get('assetId') and not e.get('preserveFinish'):
                    # Detailed towers keep their architectural finishes. Use only the actual glass
                    # faces for the map key. Their plinths, upper roofs and balcony slabs stay intact.
                    object_name = node.get('name', '').casefold()
                    material_name = d['materials'][part['material']].get('name', '').casefold() if 'material' in part else ''
                    base = any(part_name in object_name for part_name in ('podium', 'grade', 'plinth', 'roof', 'crown', 'landscap', 'existing-exs'))
                    glazed = any(kind in material_name for kind in ('glass', 'glazing', 'window', 'glazed'))
                    voya_shaft = object_name in ('voya-taller-body', 'voya-shorter-body')
                    if not base and (glazed or voya_shaft):
                        selected.fill(6)
                if inspect_materials:
                    yield node, part, d['materials'][part['material']] if 'material' in part else {}, selected
                else:
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
    replacement = pr.get('exchangePhaseGeometry')
    assets = pr.get('assetReplacements', [])
    municipal = pr.get('municipalReplacements', [])
    excluded_ids = {component for row in municipal for component in row['componentIds']}
    meshes = mesh(pr['sourceGLB'], semantic, replace_exchange=bool(replacement),
                  replaced_assets={a['assetId'] for a in assets}, replaced_components=excluded_ids)
    if replacement or assets or municipal:
        from itertools import chain
        additions = ([replacement] if replacement else []) + assets
        meshes = chain(meshes, *(mesh(row, semantic) for row in additions),
                       *(mesh(row, semantic, municipal_stages={component:cats[row.get('lifecycle','under_construction')] for component in row['componentIds']})
                         for row in municipal if not row.get('removeOnly')))
    for (world, faces, sel) in meshes:
        camspace = np.ascontiguousarray(world @ rotation - origin, dtype=np.float64)
        fn(depth.ctypes.data, mask.ctypes.data, width, height, camspace.ctypes.data, faces.ctypes.data, sel.ctypes.data, len(faces), focal, cx, cy, cam['clip'][0], int(ortho))
    return mask
