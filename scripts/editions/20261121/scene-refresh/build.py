"""Build registered replacement fragments from the five published models.

Keep the original indexed geometry, source textures and coordinate hierarchy. The
Voya native exporter applies per-component materials, recovered from the matching
current Downtown capture. The parent renderer uses oldPins to avoid double draws.
"""
import copy
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

RECIPE = Path(__file__).resolve().parent


def configure(archive, public, output):
    global GEOMETRY, PUBLIC, HERE, ASSETS
    PUBLIC, HERE = public, output
    HERE.mkdir(parents=True, exist_ok=True)
    GEOMETRY = json.loads((RECIPE / 'source-scenes.json').read_text())
    for digest, scene in GEOMETRY.items():
        source = scene['source']
        source['path'] = str(archive / source['path'])
        with stream_source(source) as stream:
            measured = hashlib.sha256()
            for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
                measured.update(block)
        if measured.hexdigest() != digest:
            raise ValueError(f'Original geometry changed for {scene["district"]} {scene["stage"]}')
    ASSETS = {asset['id']: asset for asset in json.loads(
        (PUBLIC/'data/refinement-models.json').read_text())['assets']}


ASSET_REFERENCES = {
    'wf-26park-current-plan': 'wide-port-credit-future',
    'harborn-50-60-current-plan': 'wide-cooksville-future',
    'mcity-m1-20261025-exterior-study': 'home-downtown-future',
    'mcity-m5-authored-detail-20261101': 'home-downtown-future',
    'voya-towers-plan-derived': 'home-downtown-future',
}
META_KEYS = ['Status', 'displayStatus', 'lifecycle', 'projectId', 'modes', 'recordedProgress', 'nativeTexture', 'preserveSourceNormals',
             'localReview', 'hiddenObsolete', 'uncertainAsset', 'uncertain', 'draftStudy', 'constructionDesign', 'outsideDistrict', 'qaRenderOrder']


def SHA(data): return hashlib.sha256(data).hexdigest()


def read_json(data):
    return json.loads(data[20:20+int.from_bytes(data[12:16], 'little')])


def stream_source(pin):
    p = Path(pin['path'])
    if not p.is_file():
        p = Path(str(p)+'.gz')
    return gzip.open(p, 'rb') if p.suffix == '.gz' else p.open('rb')


def native_header(pin):
    with stream_source(pin) as f:
        h = f.read(20)
        return json.loads(f.read(struct.unpack_from('<I', h, 12)[0]))


def mesh_nodes(doc, aid=None):
    return [n for n in doc['nodes'] if 'mesh' in n and (aid is None or n.get('extras', {}).get('assetId') == aid)]


def triangle_count(doc, nodes):
    return sum(doc['accessors'][p.get('indices', p['attributes']['POSITION'])]['count']//3
               for n in nodes for p in doc['meshes'][n['mesh']]['primitives'])


def norm(s):
    return re.sub('[^a-z0-9]', '', s.lower())


def output_glb(doc, raw):
    n = struct.unpack_from('<I', raw, 12)[0]
    binary = raw[20+n:]
    text = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    text += b' '*(-len(text) % 4)
    return struct.pack('<4sIII4s', b'glTF', 2, 20+len(text)+len(binary), len(text), b'JSON')+text+binary


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2)+'\n')


def main():
    fragments = {}
    verify = {}
    for aid, example in ASSET_REFERENCES.items():
        a = ASSETS[aid]
        src = PUBLIC/a['url']
        packed = src.read_bytes()
        raw = gzip.decompress(packed)
        assert SHA(packed) == a['downloadSHA256']
        assert SHA(raw) in {a.get('decodedSHA256'), a.get('sha256')}
        d = read_json(raw)
        nodes = mesh_nodes(d)
        tris = triangle_count(d, nodes)
        ref = next(r for r in GEOMETRY.values() if example in r['plates'])
        native = native_header(ref['source'])
        active = mesh_nodes(native, aid)
        lookup = {norm(n['extras'].get('name') or n['name']): n for n in active}
        for n in active:
            lookup.setdefault(norm(n['name']), n)
        default = active[0]['extras']
        used = {}
        for n in nodes:
            mesh = d['meshes'][n['mesh']]
            native_node = lookup.get(norm(n.get('name', '')))
            original = mesh.get('extras', {}) | n.get('extras', {})
            metadata = {k: default[k] for k in META_KEYS if k in default}
            if native_node:
                metadata.update({k: v for k, v in native_node['extras'].items() if k in META_KEYS})
            metadata.update({'assetId': aid, 'projectId': a['projectId'], 'sourceAssetSHA256': SHA(
                raw), 'name': n.get('name', '')})
            if a.get('modelFidelity'):
                metadata['modelFidelity'] = a['modelFidelity']
            n['extras'] = original | metadata
            if aid != 'voya-towers-plan-derived':
                continue
            assert native_node, n['name']
            before = native['meshes'][native_node['mesh']]['primitives']
            assert len(before) == len(mesh['primitives'])
            for p, np in zip(mesh['primitives'], before):
                m = np['material']
                assert 'Texture' not in str(native['materials'][m])
                if m not in used:
                    used[m] = len(d['materials'])
                    d['materials'].append(copy.deepcopy(native['materials'][m]))
                p['material'] = used[m]
                if 'COLOR_0' not in np['attributes']:
                    p['attributes'].pop('COLOR_0', None)
        fragment = output_glb(d, raw)
        outfile = HERE/(aid+'.glb')
        outfile.write_bytes(fragment)
        assert triangle_count(read_json(fragment), mesh_nodes(read_json(fragment))) == tris
        current = {SHA(raw), SHA(packed)}
        stale = {v['assets'][aid]['sourceSHA256'] for v in GEOMETRY.values() if aid in v['assets']} - current
        if not stale:
            raise RuntimeError(f'No superseded pins for {aid}')
        fragments[aid] = {'assetId': aid, 'path': str(outfile), 'sha256': SHA(fragment), 'oldPins': sorted(stale), 'triangles': tris,
                          'sourceGLB': a['url'], 'publicDecodedSHA256': SHA(raw), 'publicDownloadSHA256': SHA(packed), 'worldBounds': a['bounds']}
        verify[aid] = {'currentTriangles': tris, 'nativeExample': example, 'referenceMeshCount': len(active),
                       'publicMeshCount': len(nodes), 'publicTriangleCount': tris, 'correctlyPreservedPublicBinary': True}
    scopes = {}
    for sha, r in GEOMETRY.items():
        apply = [v for aid, v in fragments.items() if r['assets'].get(
            aid, {}).get('sourceSHA256') in v['oldPins']]
        if apply:
            scopes[sha] = {'sceneSha256': sha, 'district': r['district'],
                           'stage': r['stage'], 'plates': r['plates'], 'replacements': apply}
    per_job = {plate: {'sceneSha256': sha, 'replacements': r['replacements']}
               for sha, r in scopes.items() for plate in r['plates']}
    write_json(HERE/'fragments.json', fragments)
    write_json(HERE/'by-scene.json', scopes)
    write_json(HERE/'by-plate.json', per_job)
    write_json(HERE/'build-proof.json', verify)
    print(f"{len(fragments)} registered models; {len(scopes)} stale scenes; {len(per_job)} affected views")
    for p, v in scopes.items():
        print(v['district'], v['stage'], len(v['plates']), [r['assetId'] for r in v['replacements']])
