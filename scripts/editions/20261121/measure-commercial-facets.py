"""Register existing low-rise commercial buildings that lie entirely on surveyed commercial parcels."""
import argparse
import gzip
import json
import runpy
import sys
from pathlib import Path
import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.strtree import STRtree

HERE=Path(__file__).resolve().parent
NATIVE=HERE.parent/'20261120'
sys.path.insert(0,str(NATIVE))
import geometry_mask
import replay

def polygon(rings):
    pieces=[]
    # Esri polygon rings use odd-even interior. Symmetric difference retains holes and multipart features.
    for ring in rings:
        if len(ring)>=4:
            part=shapely.make_valid(Polygon(ring))
            if not part.is_empty:pieces.append(part)
    if not pieces:return Polygon()
    shape=pieces[0]
    for part in pieces[1:]:shape=shape.symmetric_difference(part)
    return shape

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    source=HERE/'geometry-sources/commercial-parcels-2025.json.gz'
    data=json.loads(gzip.decompress(source.read_bytes()))
    assert data['spatialReference']==26917
    parcels=[polygon(row['geometry']['rings']) for row in data['features']]
    attributes=[r['attributes'] for r in data['features']]
    lookup=STRtree(parcels)
    # The approved view shows the shopping centre and its neighbouring entertainment
    # buildings, including their smaller wings, roofs and mechanical enclosures.
    # These three City parcels were identified directly under the source image.
    subject_ids={705,5781,10244}
    campus=shapely.union_all([shape for shape,a in zip(parcels,attributes) if a['OBJECTID'] in subject_ids]).buffer(.1)
    shapely.prepare(campus)
    measure=runpy.run_path(str(HERE/'measure-existing-facets.py'))['connected_shells']
    scenes=json.loads((NATIVE/'cameras.json').read_text())['scenes']
    cached=set();registered={};trace={}
    for key,sc in scenes.items():
        proof=replay.relocate(json.loads((args.archive/sc['importProof']).read_text()),args.archive)['input']
        for tile,_,world,faces in geometry_mask.mesh(proof,{},municipal_tiles_only=True):
            digest=geometry_mask.geometry_digest(world,faces)
            if digest in cached:continue
            cached.add(digest)
            local,lo,hi=measure(world,faces)
            sizes=hi-lo
            # A full source roof class requires an intact low-rise structure and one whole commercial parcel.
            # No partial overlap or proximity to retail is sufficient. The whole footprint rectangle must fit.
            candidates=np.flatnonzero((sizes[:,1]>=4)&(sizes[:,1]<35)&(sizes[:,0]*sizes[:,2]>=180)&(np.minimum(sizes[:,0],sizes[:,2])>=8))
            boxes=shapely.box(615000+lo[candidates,0],4827000-hi[candidates,2],615000+hi[candidates,0],4827000-lo[candidates,2])
            matches=lookup.query(boxes,predicate='within')
            shell_ids=candidates[matches[0]]
            hit=np.isin(local,shell_ids)
            if tile==63:
                east,north=615000+world[:,0],4827000-world[:,2]
                inside=shapely.contains_xy(campus,east,north)
                policy=inside[faces].all(axis=1) & (sizes[local,1]<35)
                hit |= policy
            if not hit.any():continue
            edges=np.flatnonzero(np.diff(np.r_[False,hit,False].astype(np.int8)))
            spans=np.column_stack((edges[::2],edges[1::2])).tolist()
            registered[digest]={'tile':tile,'faces':len(faces),'runs':spans}
            evidence=[]
            for c,parcel in zip(shell_ids,matches[1]):
                evidence.append({'parcel':attributes[parcel]['OBJECTID'],'use':attributes[parcel]['ELU_DESCRIPTION'],
                                 'bounds':[lo[c].round(3).tolist(),hi[c].round(3).tolist()]})
            trace[digest]=evidence
    args.output.write_text(json.dumps(registered,separators=(',',':'))+'\n')
    if args.report:args.report.write_text(json.dumps(trace,separators=(',',':'))+'\n')
    unique={tuple(q['bounds'][0]+q['bounds'][1]) for group in trace.values() for q in group}
    print(f'{len(parcels)} pure commercial parcels, {len(registered)} affected tile meshes, {len(unique)} distinct registered bounds.')

if __name__=='__main__':
    main()
