"""Re-render a packed city capture with a verified project revision in source coordinates."""
import hashlib
import json
import runpy
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def is_old_exchange(obj):
    return (
        obj.get('projectId') == 'exchange-district'
        or obj.get('assetId') == 'exchange-recorded-topped-structures'
        or obj.get('id') in ('63-6155', '63-6156')
        or 'exchange_63-615' in obj.name.lower()
    )


def replace_mesh(spec):
    if not spec.get('removeOnly'):
        path = Path(spec['path'])
        assert checksum(path) == spec['sha256'], path
    replacing_exchange = spec.get('project') == 'exchange-district'
    original = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        if replacing_exchange:
            matches = is_old_exchange(obj)
        elif spec.get('componentIds'):
            matches = str(obj.get('id')) in spec['componentIds']
        else:
            matches = obj.get('assetId') == spec['assetId'] and obj.get('sourceAssetSHA256') in spec['oldPins']
        if matches:
            original.append(obj)
    if 'oldMeshCount' in spec:
        assert len(original) == spec['oldMeshCount'], (spec, [o.name for o in original])
    elif not original:
        raise ValueError('No source meshes found for ' + str(spec))
    archive = []
    for obj in original:
        archive.append({'name':obj.name, 'assetId':obj.get('assetId'), 'id':obj.get('id'),
                        'projectId':obj.get('projectId'), 'sourceAssetSHA256':obj.get('sourceAssetSHA256')})
        obj.hide_render = True
    if spec.get('removeOnly'):
        return {**spec, 'insertedMeshCount':0, 'insertedTrianglesByPhase':{}, 'replacedObjects':archive,
                'sourceBlendSaved':False, 'adapterSHA256':checksum(Path(__file__))}
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    inserted = [o for o in bpy.data.objects if o not in previous and o.type == 'MESH']
    tris = sum(len(p.vertices) - 2 for obj in inserted for p in obj.data.polygons)
    assert tris == spec['triangles'], (path, tris, spec['triangles'])
    assert all(not o.hide_render for o in inserted)
    counts = {}
    for obj in inserted:
        group = obj.get('phase') or obj.get('lifecycle') or 'model'
        counts[group] = counts.get(group, 0) + sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return {**spec, 'insertedMeshCount':len(inserted), 'insertedTrianglesByPhase':counts,
            'replacedObjects':archive, 'sourceBlendSaved':False,
            'adapterSHA256':checksum(Path(__file__))}


args = sys.argv[sys.argv.index('--') + 1:]
index = args.index('--project-replacements')
config = json.loads(Path(args[index + 1]).read_text())
args = args[:index] + args[index + 2:]
assert config['identity'] == args[args.index('--identities') + 1]
plan = json.loads(Path(args[0]).read_text())
assert config['sourceBlendSHA256'] == plan['packedBlend']['sha256']
receipts = [replace_mesh(spec) for spec in config['replacements']]
sys.argv = ['blender','--',*args]
renderer = HERE / config['baseRenderer']
assert renderer.parent == HERE and renderer.is_file()
runpy.run_path(str(renderer), run_name='__main__')
path = Path(args[2]) / 'render-proof.json'
receipt = json.loads(path.read_text())
assert receipt['state'] == 'RENDERED_VISUAL_REVIEW_REQUIRED'
for record in receipts:
    if record.get('project') == 'exchange-district':
        receipt['exchangePhaseGeometry'] = record
    elif record.get('componentIds'):
        receipt.setdefault('municipalReplacements', []).append(record)
    else:
        receipt.setdefault('assetReplacements', []).append(record)
receipt['derivedSceneGeometryEdited'] = True
receipt['replacementAdapter'] = {'sha256':checksum(Path(__file__)), 'configuration':config}
temporary = path.with_suffix('.verified')
temporary.write_text(json.dumps(receipt,indent=2)+'\n')
temporary.replace(path)
