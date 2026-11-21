"""Publish a compact, exact world-coordinate lookup for the live municipal building layers."""
import argparse
import json
import hashlib
import sys
from collections import defaultdict
from pathlib import Path
import numpy as np

HERE=Path(__file__).resolve().parent
NATIVE=HERE.parent/'20261120'
sys.path.insert(0,str(NATIVE))
import geometry_mask
import replay
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
registry=json.loads((HERE/'native-existing-facets.json').read_text())
cameras=json.loads((NATIVE/'cameras.json').read_text())
seen=set();world_faces=defaultdict(set)
for key,scene in cameras['scenes'].items():
    expected=registry['sourceScenes'][key]
    if not any(item not in seen and item in registry['meshMasks'] for item in expected['tileGeometry']):continue
    proof=args.archive/scene['importProof']
    replay.verify(proof,scene['importSHA256'])
    source=replay.relocate(json.loads(proof.read_text()),args.archive)['input']
    if source['sha256']!=expected['sourceGLBSHA256']:raise ValueError(key)
    for tile,name,world,triangles in geometry_mask.mesh(source,{},municipal_tiles_only=True):
        shape=geometry_mask.geometry_digest(world,triangles)
        if shape in seen or shape not in registry['meshMasks']:continue
        seen.add(shape)
        mask=registry['meshMasks'][shape]
        if mask['tile']!=tile or len(triangles)!=mask['faces']:raise ValueError(name)
        for start,end in mask['runs']:
            faces=world[triangles[start:end]]
            quantized=np.floor(faces.astype('f8')*1000+.5).astype('<i4')
            for triangle,encoded in zip(faces,quantized):
                center=triangle.mean(axis=0,dtype='f8')
                cell=f'{tile}:{int(np.floor(center[0]/200))}:{int(np.floor(center[2]/200))}'
                # Index only the individual registered faces. Nearby shorter roofs stay unchanged.
                vertices=['/'.join(map(str,vertex)) for vertex in encoded]
                world_faces[cell].add(','.join(sorted(vertices)))
if seen!=set(registry['meshMasks']):raise ValueError('Missing source geometry')
data={k:sorted(faces) for k,faces in sorted(world_faces.items())}
args.output.write_text('// Generated from the measured upper surfaces of existing municipal buildings.\nexport const municipalUpperFaces='+json.dumps(data,separators=(',',':'))+';\n')
print(len(data),'spatial cells;',sum(map(len,data.values())),'verified unique facets; bytes',args.output.stat().st_size)
