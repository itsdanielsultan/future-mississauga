"""Split the City's textured Exchange mesh by evidenced occupancy, without moving vertices."""
import argparse
from collections import Counter, defaultdict
import copy
import gzip
import hashlib
import json
from pathlib import Path
import struct
import numpy as np

PUBLIC = Path(__file__).resolve().parents[3] / 'public'
BASE = PUBLIC / 'models/exchange-textured-phase-aware.glb'
PROGRESS = PUBLIC / 'models/refinement/exchange-recorded-topped-structures.glb'
hash_bytes = lambda raw: hashlib.sha256(raw).hexdigest()

def unpack(path):
    raw=path.read_bytes()
    size=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+size]),raw[28+size:]

def accessor(doc, binary, index):
    a=doc['accessors'][index]
    view=doc['bufferViews'][a['bufferView']]
    dtype=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
    width={'VEC3':3,'SCALAR':1}[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,
                      offset=view.get('byteOffset',0)+a.get('byteOffset',0),
                      strides=(view.get('byteStride',width*dtype.itemsize),dtype.itemsize))

def arrays(doc,binary,primitive):
    return accessor(doc,binary,primitive['attributes']['POSITION']),accessor(doc,binary,primitive['indices']).reshape(-1,3)

def triangle_key(points):
    return tuple(sorted(point.tobytes() for point in points))

def pack(doc, blob):
    j=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
    j+=b' '*(-len(j)%4)
    blob+=b'\0'*(-len(blob)%4)
    return struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(blob),b'BIN\0')+blob

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--test',action='store_true')
    args=parser.parse_args()
    source,binary=unpack(BASE); supp,supp_blob=unpack(PROGRESS)
    assert hash_bytes(BASE.read_bytes())=='2ebd17feb79c742925cc7b27eb0a91840a9b0027ddcdf5a5bf427c1d85c411ce'
    reference=defaultdict(dict); exact=Counter()
    for n in supp['nodes']:
        phase,original=n['name'].split('__',1)
        if phase not in ('EX1','EX2','Native_low_shared_podium'):continue
        phase='podium' if phase=='Native_low_shared_podium' else phase
        p=supp['meshes'][n['mesh']]['primitives'][0];pos,faces=arrays(supp,supp_blob,p)
        for f in faces:
            k=triangle_key(pos[f])
            assert reference[original].get(k,phase)==phase
            reference[original][k]=phase
        exact[phase]+=len(faces)
    counts=Counter(); output=[]; missing=Counter();rem=[]
    for n in source['nodes']:
        old,original=n['name'].split('__',1);mesh=source['meshes'][n['mesh']];pr=mesh['primitives'][0];pos,faces=arrays(source,binary,pr)
        divisions=defaultdict(list); missing_points=[]
        for f in faces:
            points=pos[f];phase='EXS' if old=='existing-exs' else reference[original].get(triangle_key(points))
            if phase is None:
                center=points.mean(axis=0)
                if original.startswith('exchange_63-6156') and center[0]<-5187 and center[2]<-315 and points[:,1].max()>106.5:
                    phase='EX3 crown' if original.endswith('1318_region0') else 'EX3'
                elif original.startswith('exchange_63-6156') and points[:,0].min()>-5186.1 and points[:,0].max()<-5145 and points[:,2].min()>-335 and points[:,2].max()<-294 and points[:,1].min()>104 and points[:,1].max()<135.5:
                    # EX2's registered 42-storey envelope. The earlier progress cut deliberately
                    # omitted its intermediate facade; these are the original missing faces.
                    phase='EX2 facade'
                elif original.startswith('exchange_63-6155') and points[:,0].max()<-5238 and points[:,1].min()>181.35 and points[:,1].max()<191:
                    # The original phase proof kept this optional design roof above the
                    # evidenced EXS ceiling. Retain that narrower existing silhouette.
                    phase='EXS design roof'
                elif points[:,1].max() <= 106.5: phase='podium'
                else:
                    missing_points.append(points)
                    phase='unassigned'
            divisions[phase].append(f);counts[phase]+=1
        if missing_points:
            q=np.concatenate(missing_points);rem.append([original,len(missing_points),q.min(axis=0).round(1).tolist(),q.max(axis=0).round(1).tolist()])
        for phase,inds in divisions.items():output.append((phase,original,n,mesh,pr,np.asarray(inds)))
    print('reference',exact,'classes',counts,'remainder',rem)
    if args.test:return
    assert not counts['unassigned']
    assert all(counts[k]==exact[k] for k in ['EX1','EX2'])
    assert counts['EX3'] and counts['EX3 crown']
    stage_modes={'EX1':['existing','construction','future'],'EX2':['existing','construction','future'],'EX2 facade':['existing','construction','future'],'EXS design roof':['future'],'EXS':['existing','construction','future'],'podium':['existing','construction','future'],'EX3':['construction','future'],'EX3 crown':['future']}
    args.output.mkdir(exist_ok=True,parents=True)
    result={}
    for stage in ['all','existing','construction','future']:
        doc=copy.deepcopy(source);blob=bytearray(binary)
        doc['nodes']=[];doc['meshes']=[];doc['scenes'][0]['nodes']=[]
        for phase,original,n,mesh,pr,indices in output:
            if stage!='all' and stage not in stage_modes[phase]:continue
            materialPhase='under_construction' if phase.startswith('EX3') else 'existing'
            attrs=dict(projectId='exchange-district',componentPhase={'name':phase,'lifecycle':materialPhase},lifecycle=materialPhase,Status='Under Construction' if materialPhase=='under_construction' else 'Existing',atlasStatus='Under Construction' if materialPhase=='under_construction' else 'Existing',modes=stage_modes[phase],phase=phase,reviewed='2026-11-21',recordedProgress=phase=='EX3',nativeTexture=True)
            name=phase.replace(' ','-')+'__'+original;inds=indices.astype('<u4').ravel(); b=inds.tobytes();blob+=b'\0'*(-len(blob)%4)
            vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(b),'target':34963});blob+=b
            ai=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5125,'count':len(inds),'type':'SCALAR','min':[int(inds.min())],'max':[int(inds.max())]})
            legacy=mesh.get('extras',{});extras={k:v for k,v in legacy.items() if k in ['sourceComponentId','i3sNode','sourceURL','attribution','sourceNativeMesh']};extras.update(attrs)
            doc['meshes'].append({'name':name,'primitives':[dict(pr,indices=ai)],'extras':extras})
            doc['nodes'].append({'name':name,'mesh':len(doc['meshes'])-1,'extras':extras})
            doc['scenes'][0]['nodes'].append(len(doc['nodes'])-1)
        doc['buffers'][0]['byteLength']=len(blob);doc['scenes'][0]['extras'].update(reviewed='2026-11-21',statusSources=SOURCES,scenario=stage)
        raw=pack(doc,blob);name='exchange-'+stage+'-20261121.glb';(args.output/name).write_bytes(raw)
        result[stage]={'file':name,'sha256':hash_bytes(raw),'nodes':len(doc['nodes']),'triangles':sum(len(inds) for phase,_,_,_,_,inds in output if stage=='all' or stage in stage_modes[phase])}
        if stage=='all':
            compressed=gzip.compress(raw,compresslevel=9,mtime=0);(args.output/(name+'.gz')).write_bytes(compressed);result[stage]['gzipSHA256']=hash_bytes(compressed)
    receipt=dict(reviewed='2026-11-21',sourceSHA256=hash_bytes(BASE.read_bytes()),phaseReferenceSHA256=hash_bytes(PROGRESS.read_bytes()),trianglesByPhase=dict(counts),coordinatesMoved=0,materialTexturesReplaced=0,units='metres',sources=SOURCES,scenarios=result)
    (args.output/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')

SOURCES=['https://www.condoauthorityontario.ca/condo-registry-details/?id=ff38531f-56bb-f111-aaad-70a8a5ac79b5','https://condos.ca/mississauga/2-erskine-road-mississauga/unit-2404-W13683156','https://strata.ca/mississauga/exchange-district-condos-phase-2-ex2','https://rentexs.com/','https://urbantoronto.ca/forum/threads/toronto-exchange-district-condos-m-66s-camrost-felcorp-arcadis.29739/page-78','https://www.maedcollective.com/projects/exchange-district-ex3']
if __name__=='__main__': main()
