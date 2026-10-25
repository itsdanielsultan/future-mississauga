"""Recovered source-preserving study batcher. No decimation or material edits.
Original inputs remain separate. Transparent primitives retain individual sort units.
"""
import argparse,copy,gzip,hashlib,json,math,re,struct
from pathlib import Path
import numpy as np
TYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
COUNTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def compress_study_glb(data):
 """Use the historical M City derivative's gzip envelope on every host.

 Level 9 and mtime 0 are part of the recorded encoding recipe. Python/zlib
 versions can otherwise write different OS bytes (3 or 255) into the header.
 Pin that descriptive byte to the historical value 3; the DEFLATE stream,
 checksum, size and decoded model remain unchanged. Exact byte reproduction
 still requires compatible zlib output and is checked against recorded hashes.
 """
 compressed=bytearray(gzip.compress(data,compresslevel=9,mtime=0))
 compressed[9]=3
 return bytes(compressed)

def read_glb(path):
 data=Path(path).read_bytes()
 if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)):raise ValueError('Expected a complete glTF 2 binary')
 size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);start=20+size
 if doc.get('extensionsRequired')or doc.get('skins')or doc.get('animations')or doc.get('images'):raise ValueError('Only static uncompressed, untextured study inputs are supported')
 if any('uri'in b for b in doc['buffers']):raise ValueError('External input buffers are not supported')
 if data[start+4:start+8]!=b'BIN\0':raise ValueError('Missing embedded binary buffer')
 return doc,data[start+8:],data

def accessor(doc,binary,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
 if a.get('sparse')or v.get('extensions'):raise ValueError('Unsupported sparse/compressed input')
 dtype=np.dtype(TYPES[a['componentType']]);width=COUNTS[a['type']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=offset,strides=(v.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()

def node_matrix(node):
 if 'matrix'in node:return np.array(node['matrix']).reshape((4,4),order='F')
 x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.eye(4)
 r[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 r[:3,:3]=r[:3,:3]@np.diag(node.get('scale',[1,1,1]));r[:3,3]=node.get('translation',[0,0,0]);return r

def podium_component(name,extras,registration):
 match=re.search(r'([Mm][12])_(?:R\d+_)?P(\d+)',name);component=f'{match.group(1)}_P{int(match.group(2)):02d}' if match else None
 if '_R02_'in name and component is None:
  if 'entry'not in name.lower():raise ValueError('Unmapped Rev02 podium part: '+name)
  component=registration.get('entryPodiumComponents',{}).get(name[:2])
  if component is None:raise ValueError('Missing entry component mapping: '+name)
 if component:
  expected=extras.get('covered_source_component',extras.get('source_component_approximate'))
  if expected is not None and int(component.split('_P')[1])!=expected:raise ValueError('Conflicting source component metadata: '+name)
  if component not in registration.get('podiumVerticalCorrections',{}):raise ValueError('Missing podium datum correction: '+component)
 return component

def semantic_partition(name,component,registration):
 if not registration.get('preserveSemanticPartitions'):return 'material-only'
 if '_R02_'in name:return ('rev02-entry:'if'entry'in name.lower()else'rev02-podium:')+component
 if component:return 'retained-source-podium:'+component
 return 'unchanged-tower'

def prepare(source,target,registration):
 doc,binary,source_bytes=read_glb(source);groups={};source_primitives=0;source_triangles=0;restoration=[];material_names=doc.get('materials',[])
 yaw=math.radians(registration.get('rotationYDegrees',0));c,s=math.cos(yaw),math.sin(yaw);world=np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]],dtype=float);world[:3,3]=registration.get('translation',[0,0,0]);corrections=registration.get('podiumVerticalCorrections',{})
 def visit(i,parent):
  nonlocal source_primitives,source_triangles
  node=doc['nodes'][i];local=parent@node_matrix(node);name=node.get('name',str(i));placement=np.eye(4);component=podium_component(name,node.get('extras',{}),registration);partition=semantic_partition(name,component,registration);delta=corrections.get(component,0)if component else 0;placement[1,3]+=delta;transform=placement@local
  if 'mesh'in node:
   for pi,primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
    if primitive.get('mode',4)!=4 or primitive.get('targets'):raise ValueError('Only triangle meshes without morph targets')
    attrs={k:accessor(doc,binary,a)for k,a in primitive['attributes'].items()}
    if set(attrs)-{'POSITION','NORMAL','TEXCOORD_0'}:raise ValueError('Unsupported attribute')
    attrs['POSITION']=(attrs['POSITION'].astype(float)@transform[:3,:3].T+transform[:3,3]).astype('<f4')
    if 'NORMAL'in attrs and not np.array_equal(transform[:3,:3],np.eye(3)):
     normal=attrs['NORMAL'].astype(float)@np.linalg.inv(transform[:3,:3]);length=np.linalg.norm(normal,axis=1,keepdims=True);attrs['NORMAL']=np.divide(normal,length,out=np.zeros_like(normal),where=length>0).astype('<f4')
    if not all(np.isfinite(a).all()for a in attrs.values()):raise ValueError('Non-finite vertex data')
    indices=accessor(doc,binary,primitive['indices']).ravel().astype('<u4')if'indices'in primitive else np.arange(len(attrs['POSITION']),dtype='<u4')
    if len(indices)%3 or indices.max(initial=0)>=len(attrs['POSITION']):raise ValueError('Invalid triangle indices')
    if np.linalg.det(transform[:3,:3])<0:indices=indices.reshape(-1,3)[:,[0,2,1]].ravel()
    material=primitive.get('material');transparent=material is not None and material_names[material].get('alphaMode')=='BLEND';key=(partition,material,tuple((k,str(v.dtype),v.shape[1])for k,v in sorted(attrs.items())),(i,pi)if transparent else None)
    group=groups.setdefault(key,{'material':material,'attrs':{},'indices':[],'vertices':0,'names':[],'transparent':transparent,'partition':partition,'component':component,'triangles':0,'sources':[]})
    group['sources'].append({'sourceNode':i,'sourcePrimitive':pi,'name':name,'sourceExtras':copy.deepcopy(node.get('extras',{})),'firstOutputTriangle':group['triangles'],'triangleCount':len(indices)//3,'verticalCorrectionM':delta,'bakedTransformRowMajor':transform.tolist()});group['triangles']+=len(indices)//3
    group['indices'].append(indices+group['vertices']);group['vertices']+=len(attrs['POSITION']);group['names'].append(name)
    for k,v in attrs.items():group['attrs'].setdefault(k,[]).append(v)
    source_primitives+=1;source_triangles+=len(indices)//3
    if component:restoration.append({'name':name,'component':component,'verticalCorrectionM':delta,'vertices':len(attrs['POSITION'])})
  for child in node.get('children',[]):visit(child,local)
 for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,np.eye(4))
 out={'asset':{'version':'2.0','generator':'Future Mississauga source-preserving web batcher'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':copy.deepcopy(material_names),'accessors':[],'bufferViews':[],'buffers':[],'extras':{'sourceSHA256':hashlib.sha256(source_bytes).hexdigest(),'representation':registration['representation'],'optimization':'Opaque primitives batched by material; exact complete-vertex duplicates welded; transparent objects retained; no geometry decimation','coordinateSystem':'x=UTM17N easting-615000; y=ASL-70; z=4827000-northing; metres, glTF Y up'}}
 payload=bytearray();all_positions=[];source_mapping=[]
 def add(array,type_,component,target):
  while len(payload)%4:payload.append(0)
  view={'buffer':0,'byteOffset':len(payload),'byteLength':array.nbytes,'target':target};out['bufferViews'].append(view);payload.extend(array.tobytes());a={'bufferView':len(out['bufferViews'])-1,'componentType':component,'count':len(array),'type':type_}
  if type_=='VEC3'and component==5126:a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
  out['accessors'].append(a);return len(out['accessors'])-1
 for group in groups.values():
  attrs={k:np.concatenate(v)for k,v in group['attrs'].items()};indices=np.concatenate(group['indices']).astype('<u4');packed=np.concatenate([np.ascontiguousarray(v).view(np.uint8).reshape(len(v),-1)for _,v in sorted(attrs.items())],axis=1);keys=np.ascontiguousarray(packed).view(np.dtype((np.void,packed.shape[1]))).ravel();_,first,inverse=np.unique(keys,return_index=True,return_inverse=True);order=np.argsort(first);remap=np.empty(len(order),dtype=np.uint32);remap[order]=np.arange(len(order),dtype=np.uint32);attrs={k:v[first[order]]for k,v in attrs.items()};indices=remap[inverse[indices]];all_positions.append(attrs['POSITION']);component=5123 if len(attrs['POSITION'])<=65536 else 5125;indices=indices.astype('<u2'if component==5123 else'<u4');primitive={'attributes':{},'indices':add(indices,'SCALAR',component,34963)}
  for key,array in attrs.items():
   component=next(k for k,v in TYPES.items()if np.dtype(v)==array.dtype);primitive['attributes'][key]=add(array,'VEC'+str(array.shape[1]),component,34962)
  if group['material']is not None:primitive['material']=group['material']
  idx=len(out['meshes']);mat_name=material_names[group['material']].get('name','material')if group['material']is not None else'material';name=group['names'][0]if group['transparent']else'Batched '+(group['partition']+' / 'if registration.get('preserveSemanticPartitions')else'')+mat_name
  out['meshes'].append({'name':name,'primitives':[primitive]});out['nodes'].append({'name':name,'mesh':idx,'extras':{'representation':registration['representation'],'studySemantic':group['partition'],'podiumComponent':group['component']}});out['scenes'][0]['nodes'].append(idx);source_mapping.append({'outputNode':idx,'outputMesh':idx,'semanticPartition':group['partition'],'material':group['material'],'transparentSortUnitRetained':group['transparent'],'sources':group['sources']})
 root_index=len(out['nodes']);out['nodes'].append({'name':'Municipal coordinate registration','matrix':world.flatten(order='F').tolist(),'children':out['scenes'][0]['nodes']});out['scenes'][0]['nodes']=[root_index];out['buffers']=[{'byteLength':len(payload)}];j=json.dumps(out,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);payload+=b'\0'*((-len(payload))%4);result=b'glTF'+struct.pack('<II',2,28+len(j)+len(payload))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(payload),b'BIN\0')+payload
 target=Path(target);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(compress_study_glb(result)if target.suffix=='.gz'else result);positions=np.concatenate(all_positions).astype(float)@world[:3,:3].T+world[:3,3]
 return {'sourceSHA256':hashlib.sha256(source_bytes).hexdigest(),'outputSHA256':hashlib.sha256(target.read_bytes()).hexdigest(),'decodedSHA256':hashlib.sha256(result).hexdigest(),'sourceBytes':len(source_bytes),'decodedBytes':len(result),'outputBytes':target.stat().st_size,'sourcePrimitives':source_primitives,'outputPrimitives':len(groups),'triangles':source_triangles,'vertices':len(positions),'bounds':[positions.min(axis=0).tolist(),positions.max(axis=0).tolist()],'transparentPrimitivesRetained':sum(g['transparent']for g in groups.values()),'materialIdentity':out['materials']==doc.get('materials',[]),'registration':registration,'podiumCorrections':restoration,'sourceMapping':source_mapping}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('target');p.add_argument('--registration',required=True);p.add_argument('--report',required=True);a=p.parse_args();r=prepare(a.source,a.target,json.loads(Path(a.registration).read_text()));Path(a.report).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ['registration','podiumCorrections','sourceMapping']},indent=2))
