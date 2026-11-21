"""Rebuild the city overview's offshore opacity map from its original City water mesh."""
import hashlib
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from shapely import union_all
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge

HERE = Path(__file__).resolve().parent
settings = json.loads((HERE / 'shoreline-fade.json').read_text())
source = HERE.parents[3] / settings['geometrySource']
raw = source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == settings['geometrySHA256']
json_length = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20+json_length])
data_start = 28 + json_length


def accessor(index):
    item = gltf['accessors'][index]
    view = gltf['bufferViews'][item['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[item['componentType']]
    count = {'VEC3': 3, 'SCALAR': 1}[item['type']]
    size = np.dtype(dtype).itemsize
    return np.ndarray((item['count'], count), dtype=dtype, buffer=raw,
                      offset=data_start + view.get('byteOffset', 0) + item.get('byteOffset', 0),
                      strides=(view.get('byteStride', count * size), size))


node = next(n for n in gltf['nodes'] if n.get('name') == settings['object'])
primitive = gltf['meshes'][node['mesh']]['primitives'][0]
positions = accessor(primitive['attributes']['POSITION'])
indices = accessor(primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(positions))
faces = positions[indices].reshape(-1, 3, 3)[:, :, [0, 2]]
polygons = [Polygon(triangle) for triangle in faces]
water = union_all([p for p in polygons if p.area > 0], grid_size=0.01)
parts = [water] if water.geom_type == 'Polygon' else list(water.geoms)
ring = np.array(max(parts, key=lambda p: p.area).exterior.coords)
xmin, zmin, xmax, zmax = settings['boundsXZ']

# Two straight edges are the published model's display limits. They are offshore
# and should never be interpreted as an actual water-land boundary.
bank = []
for a, b in zip(ring, ring[1:]):
    on_x_limit = max(abs(a[0]-xmax), abs(b[0]-xmax)) < 0.03
    on_z_limit = max(abs(a[1]-zmax), abs(b[1]-zmax)) < 0.03
    if not (on_x_limit or on_z_limit):
        bank.append(LineString([a, b]))
shore = linemerge(bank).simplify(13)
lines = list(shore.geoms) if hasattr(shore, 'geoms') else [shore]
samples = []
for line in lines:
    if line.length > 1:
        for offset in np.linspace(0, line.length, max(2, int(line.length/5) + 1)):
            samples.append(line.interpolate(offset).coords[0])
tree = cKDTree(samples)


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


width, height = settings['dimensions']
x = xmin + (np.arange(width) + 0.5) / width * (xmax - xmin)
z = zmin + (np.arange(height) + 0.5) / height * (zmax - zmin)
start = settings['solidBandMetres']
end = settings['fadeEndsMetres']
mask = np.empty((height, width), dtype=np.uint8)
for row in range(0, height, 48):
    xx, zz = np.meshgrid(x, z[row:row+48])
    distance = tree.query(np.stack([xx, zz], axis=-1))[0]
    opacity = 1 - smoothstep((distance-start) / (end-start))
    cap = smoothstep(np.minimum(xmax-xx, zmax-zz) / settings['endCapFadeMetres'])
    mask[row:row+48] = np.round(opacity * cap * 255)
Image.fromarray(mask).save(HERE / 'shoreline-fade.png', optimize=True)
