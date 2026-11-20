"""Studio renderer for the 2026-11-20 building studies, in glTF Y-up coordinates."""
from pathlib import Path
from io import BytesIO
import ctypes
import sys
import subprocess
import numpy as np
import trimesh
from PIL import Image, ImageFilter


def unit(vector):
    return np.asarray(vector, dtype=float) / np.linalg.norm(vector)


def array(value, dtype='float32'):
    return np.ascontiguousarray(value, dtype=dtype)


def model_geometry(raw_glb):
    scene = trimesh.load_scene(BytesIO(raw_glb), file_type='glb', process=False)
    items = []
    for name in scene.graph.nodes_geometry:
        transform, key = scene.graph[name]
        mesh = scene.geometry[key]
        if not isinstance(mesh, trimesh.Trimesh) or not len(mesh.faces):
            continue
        points = trimesh.transform_points(mesh.vertices, transform)
        normals = mesh.vertex_normals @ np.linalg.pinv(transform[:3, :3])
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
        visual = mesh.visual
        material = getattr(visual, 'material', None)
        base = getattr(material, 'baseColorFactor', None)
        if base is None:
            base = [207, 206, 203, 255]
        colors = np.tile(np.asarray(base, dtype=float)[:3], (len(points), 1))
        uv, texture, indices = array([]), array([], 'uint8'), array(mesh.faces, 'int32')
        if visual.kind == 'vertex':
            colors = np.asarray(visual.vertex_colors[:, :3], dtype=float)
        elif visual.kind == 'face':
            points, normals = points[mesh.faces].reshape(-1, 3), normals[mesh.faces].reshape(-1, 3)
            colors = np.repeat(visual.face_colors[:, :3], 3, axis=0)
            indices = array(np.arange(len(points)).reshape(-1, 3), 'int32')
        source_uv = getattr(visual, 'uv', None)
        source_texture = getattr(material, 'baseColorTexture', None)
        if source_uv is not None and source_texture is not None and visual.kind != 'face':
            uv = array(source_uv)
            texture = array(np.asarray(source_texture.convert('RGBA')), 'uint8')
        colors = array(colors)
        linear = colors / 255
        colors[:] = 255 * np.where(linear <= .0031308, 12.92 * linear, 1.055 * np.power(linear, 1 / 2.4) - .055)
        items.append((points, normals, colors, uv, texture, indices))
    return items


def build_raster(directory):
    filename = Path(directory) / ('raster.dylib' if sys.platform == 'darwin' else 'raster.so')
    subprocess.run(['c++', '-std=c++17', '-O3', '-shared', '-fPIC', str(Path(__file__).with_name('raster.cpp')), '-o', str(filename)], check=True)
    library = ctypes.CDLL(str(filename))
    ptr, integer = ctypes.c_void_p, ctypes.c_int
    library.draw.argtypes = [integer, integer, ptr, ptr, ptr, ptr, ptr, ptr, ptr, integer, integer, ptr, integer]
    return library


def render_view(items, direction, target, raster, frontage=False):
    width, height = 1920, 1440
    eye = unit(direction)
    right = unit(np.cross([0, 1, 0], eye))
    up = unit(np.cross(eye, right))
    matrix = np.stack((right, -up, eye)).T
    low = np.min([part[0].min(axis=0) for part in items], axis=0)
    high = np.max([part[0].max(axis=0) for part in items], axis=0)
    centre = (low + high) / 2
    projected = [(points - centre) @ matrix for points, *_ in items]
    # The two warehouse models include an entire block. Fit their studied facade.
    framed = [position for part, position in zip(items, projected) if np.ptp(part[0], axis=0)[0] < 65] if frontage else projected
    minimum = np.min([part.min(axis=0) for part in framed], axis=0)
    maximum = np.max([part.max(axis=0) for part in framed], axis=0)
    span = maximum - minimum
    scale = min(width * .86 / max(span[0], 1e-9), height * .84 / max(span[1], 1e-9))
    offset = np.array([width / 2, height * .49]) - (minimum[:2] + maximum[:2]) / 2 * scale
    colors = np.full((height, width, 3), [241, 241, 238], dtype=np.uint8)
    depth = np.full((height, width), -np.inf, dtype=np.float32)

    def draw(positions, illumination, surface, uv, texture, indices):
        pointers = [data.ctypes.data for data in (depth, colors, positions, illumination, surface, uv, texture)]
        texture_height, texture_width = texture.shape[:2] if texture.ndim == 3 else (0, 0)
        raster.draw(width, height, *pointers, texture_width, texture_height, indices.ctypes.data, len(indices))

    for points, _, _, _, _, indices in items:
        ground = points.copy()
        elevation = ground[:, 1] - low[1]
        ground[:, 0] -= elevation * .22
        ground[:, 2] -= elevation * .12
        ground[:, 1] = low[1]
        positions = (ground - centre) @ matrix
        positions[:, :2] = positions[:, :2] * scale + offset
        draw(array(positions), array(np.ones(len(points))), array(np.tile([189, 192, 190], (len(points), 1))), array([]), array([], 'uint8'), indices)
    colors = np.array(Image.fromarray(colors).filter(ImageFilter.GaussianBlur(width / 245)))
    depth[:] = -np.inf
    light = unit([-.65, 1, .75])
    for (_, normals, surface, uv, texture, indices), positions in zip(items, projected):
        positions[:, :2] = positions[:, :2] * scale + offset
        illumination = .71 + .28 * np.maximum(0, normals @ light) + .06 * np.maximum(0, normals[:, 1])
        draw(array(positions), array(illumination), surface, uv, texture, indices)
    Image.fromarray(colors).resize((1440, 1080), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=92, method=4)
    return sum(len(part[-1]) for part in items)
