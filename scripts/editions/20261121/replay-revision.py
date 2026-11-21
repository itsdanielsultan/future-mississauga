"""Run a dated local Blender recipe in isolation and render only its published cameras.

The recipe builds the original model state, view and lighting. Redirect its render
operations into the new edition and suppress all historical file writes.
"""
import ast
import hashlib
import json
import os
import sys
from pathlib import Path
import bpy

job_path = Path(sys.argv[sys.argv.index('--') + 1])
inspect_camera = '--camera-only' in sys.argv
job = json.loads(job_path.read_text())
recipe = Path(job['recipe'])
destination = job_path.parent / 'renders'
destination.mkdir(exist_ok=True)
model_inputs = {}
object_sources = {}
targets = job['targets']
source_hash = hashlib.sha256(recipe.read_bytes()).hexdigest()

def import_model(*args, **kwargs):
    source = Path(kwargs['filepath'])
    model_inputs[str(source)] = hashlib.sha256(source.read_bytes()).hexdigest()
    before={o.as_pointer() for o in bpy.data.objects}
    result=bpy.ops.import_scene.gltf(*args, **kwargs)
    for obj in bpy.data.objects:
        if obj.type=='MESH' and obj.as_pointer() not in before: object_sources[obj.as_pointer()]=str(source)
    return result

def reset_scene(*args,**kwargs):
    model_inputs.clear()
    object_sources.clear()
    return bpy.ops.wm.read_factory_settings(*args,**kwargs)

def camera_settings(scene):
    bpy.context.view_layer.update()
    camera = scene.camera
    lens = camera.data
    return {
        'type': lens.type, 'matrixWorld': [list(row) for row in camera.matrix_world],
        'location': list(camera.location), 'rotationEuler': list(camera.rotation_euler),
        'rotationMode': camera.rotation_mode, 'lens': lens.lens, 'orthographicScale': lens.ortho_scale,
        'sensorFit': lens.sensor_fit, 'sensorWidth': lens.sensor_width, 'sensorHeight': lens.sensor_height,
        'shift': [lens.shift_x, lens.shift_y], 'clip': [lens.clip_start, lens.clip_end],
        'pixelAspect': [scene.render.pixel_aspect_x, scene.render.pixel_aspect_y],
    }


def render(*args, **kwargs):
    scene = bpy.context.scene
    original = Path(scene.render.filepath)
    name = original.name
    if name not in targets:
        return
    target = destination / targets[name]
    receipt = target.with_suffix('.json')
    if inspect_camera:
        if not target.is_file() or not receipt.is_file():
            raise ValueError('Missing finished render: ' + target.name)
        old = json.loads(receipt.read_text())
        settings = camera_settings(scene)
        for key in ('location', 'rotationEuler'):
            if any(abs(a-b) > .00005 for a,b in zip(old['camera'][key], settings[key])):
                raise ValueError('Replayed pose differs for ' + target.name)
        if old['recipeSHA256'] != source_hash:
            raise ValueError('Original recipe changed: ' + target.name)
        # Some original receipts retained an earlier, already unloaded baseline.
        # Verify every recorded file and the active visible scene independently.
        if any(hashlib.sha256(Path(path).read_bytes()).hexdigest() != digest for path,digest in old['modelInputs'].items()):
            raise ValueError('Original model files changed: ' + target.name)
        expected = set(old['modelInputs'].values())
        if not set(model_inputs.values()).issubset(expected):
            raise ValueError('Unexpected model loaded for ' + target.name)
        if 'visibleModelInputs' in old:
            visible = {object_sources[o.as_pointer()] for o in scene.objects if o.type == 'MESH' and not o.hide_render and o.as_pointer() in object_sources}
            if visible != set(old['visibleModelInputs']):
                raise ValueError('Visible model differs: ' + target.name)
        old['camera'] = settings
        receipt.write_text(json.dumps(old, indent=2) + '\n')
        print('CONFIRMED_CAMERA', target.name, flush=True)
        return
    if target.is_file() and receipt.is_file():
        return
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA' if scene.render.film_transparent else 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.threads_mode='FIXED'
    scene.render.threads = 3
    target_width=max(2200,scene.render.resolution_x)
    scale=target_width/scene.render.resolution_x
    scene.render.resolution_y=round(scene.render.resolution_y*scale)
    scene.render.resolution_x=target_width
    scene.render.resolution_percentage=100
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'
    prefs.get_devices()
    for device in prefs.devices: device.use=device.type=='METAL'
    scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    scene.cycles.samples=12
    scene.cycles.use_denoising=True
    scene.render.filepath=str(target)
    bpy.ops.render.render(write_still=True)
    camera=scene.camera
    proof={'file':target.name,'historicalCamera':name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sourceRecipe':str(recipe),'replayedBothRegisteredVersions':bool(job.get('replayBothVersions')),'recipeSHA256':source_hash,'modelInputs':model_inputs.copy(),'visibleModelInputs':sorted({object_sources[o.as_pointer()] for o in scene.objects if not o.hide_render and o.as_pointer() in object_sources}),'camera':camera_settings(scene),'dimensions':[scene.render.resolution_x,scene.render.resolution_y],'engine':scene.render.engine,'device':scene.cycles.device,'samples':scene.cycles.samples}
    receipt.write_text(json.dumps(proof,indent=2)+'\n')
    scene.render.filepath=str(original)
    print('COMPLETED_PANEL',target.name,flush=True)

class Redirect(ast.NodeTransformer):
    def visit_For(self,node):
        self.generic_visit(node)
        if job.get('replayBothVersions') and isinstance(node.target,ast.Name) and node.target.id=='version' and ast.unparse(node.iter)=="['After']":
            # The archived pilot recipe exposes both imported model groups,
            # but its last invocation saved only the after state.
            node.iter=ast.List([ast.Constant('Before'),ast.Constant('After')],ast.Load())
        return node
    def visit_Call(self,node):
        self.generic_visit(node)
        name=ast.unparse(node.func)
        if name=='bpy.ops.render.render':node.func=ast.Name('renderFresh',ast.Load())
        elif name=='bpy.ops.wm.read_factory_settings':node.func=ast.Name('clearScene',ast.Load())
        elif name=='bpy.ops.import_scene.gltf':node.func=ast.Name('importOriginal',ast.Load())
        elif name=='bpy.ops.wm.save_as_mainfile' or name.endswith(('.write_text','.write_bytes')): return ast.copy_location(ast.Constant(None),node)
        return node
tree=ast.fix_missing_locations(Redirect().visit(ast.parse(recipe.read_text())))
sys.argv=['blender','--',*job.get('args',[])]
exec(compile(tree,str(recipe),'exec'),{'__file__':str(recipe),'__name__':'__main__','renderFresh':render,'importOriginal':import_model,'clearScene':reset_scene})
missing=[key for key,value in targets.items() if not (destination/value).with_suffix('.json').exists()]
if missing: raise RuntimeError('Missing historical cameras: '+', '.join(missing))
