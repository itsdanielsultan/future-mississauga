"""Apply the city overview's cartographic offshore fade to the original water mesh."""
import hashlib
import json
import runpy
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
settings = json.loads((HERE / 'shoreline-fade.json').read_text())
texture = HERE / 'shoreline-fade.png'
assert hashlib.sha256(texture.read_bytes()).hexdigest() == settings['textureSHA256']
water = bpy.context.scene.objects.get(settings['object'])
assert water and water.type == 'MESH' and len(water.material_slots) == 1
material = water.material_slots[0].material.copy()
water.material_slots[0].material = material
nodes = material.node_tree.nodes
links = material.node_tree.links
output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
source_shader = output.inputs['Surface'].links[0].from_socket
left, near, right, far = settings['boundsXZ']
# The archived native capture verifies Blender (x, y, z) = runtime (x, -z, y).
position = nodes.new('ShaderNodeNewGeometry')
offset = nodes.new('ShaderNodeVectorMath')
offset.operation = 'SUBTRACT'
offset.inputs[1].default_value = (left, -far, 0)
links.new(position.outputs['Position'], offset.inputs[0])
scale = nodes.new('ShaderNodeVectorMath')
scale.operation = 'DIVIDE'
scale.inputs[1].default_value = (right - left, far - near, 1)
links.new(offset.outputs[0], scale.inputs[0])
mask = nodes.new('ShaderNodeTexImage')
mask.image = bpy.data.images.load(str(texture))
mask.image.colorspace_settings.name = 'Non-Color'
mask.extension = 'CLIP'
links.new(scale.outputs[0], mask.inputs['Vector'])
mix = nodes.new('ShaderNodeMixShader')
transparent = nodes.new('ShaderNodeBsdfTransparent')
links.new(mask.outputs['Color'], mix.inputs[0])
links.new(transparent.outputs[0], mix.inputs[1])
links.new(source_shader, mix.inputs[2])
links.new(mix.outputs[0], output.inputs['Surface'])
args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[2])
runpy.run_path(str(HERE / 'render-eebfbaf06da3.py'), run_name='__main__')
proof = out / 'render-proof.json'
record = json.loads(proof.read_text())
record['overviewWaterDisplay'] = settings
record['sourceMaterialsEdited'] = False
record['derivedDisplayMaterialEdited'] = True
proof.write_text(json.dumps(record, indent=2) + '\n')
