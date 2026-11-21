"""Identify the large, connected City mesh shells inside the published Square One mall outlines."""
from pathlib import Path
import sys,json
import numpy as np
import argparse
parser=argparse.ArgumentParser(description='Reconstruct Square One roof and wall faces from recorded municipal footprints.')
parser.add_argument('--archive',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args()
here=Path(__file__).resolve().parent
rec=here.parent/'20261120'
sys.path.insert(0,str(rec))
import geometry_mask as gm,replay,runpy
helper=runpy.run_path(str(here/'measure-existing-facets.py'))
info=json.loads((here/'plan-massing-materials.json').read_text())['mall']
lo=np.array(list(info['sourceBounds'].values())).min(axis=(0,1));hi=np.array(list(info['sourceBounds'].values())).max(axis=(0,1));seen={};archive=args.archive
sources=json.loads((rec/'cameras.json').read_text())['scenes']
for key,raw in sources.items():
 p=replay.relocate(json.loads((archive/raw['importProof']).read_text()),archive)['input']
 for tile,name,world,face in gm.mesh(p,{},municipal_tiles_only=True):
  if tile!=info['tile']:continue
  sig=gm.geometry_digest(world,face)
  if sig in seen:continue
  labels,low,high=helper['connected_shells'](world,face);matched=(low[:,0]>=lo[0]-1)&(low[:,2]>=lo[2]-1)&(high[:,0]<=hi[0]+1)&(high[:,2]<=hi[2]+1)&((high[:,0]-low[:,0])>=120)&((high[:,2]-low[:,2])>=120)&((high[:,1]-low[:,1])<=35)
  mask=matched[labels];edges=np.flatnonzero(np.diff(np.r_[False,mask,False].astype(np.int8)));runs=np.column_stack([edges[::2],edges[1::2]]).tolist();seen[sig]={'faces':len(face),'runs':runs,'shells':[{'low':a.round(2).tolist(),'high':b.round(2).tolist()} for a,b in zip(low[matched],high[matched])]}
out={k:v for k,v in seen.items() if v['runs']};args.output.write_text(json.dumps(out,separators=(',',':'))+'\n')
print('Registered',len(out),'unique mesh representations of Square One roofs out of',len(seen),'tile captures.',flush=True)
