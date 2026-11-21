"""Resolve the archived Blender camera recipes by content hash, before any render is started."""
import argparse
import hashlib
import json
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source_archive',type=Path)
parser.add_argument('workspace',type=Path)
parser.add_argument('--public',type=Path,default=Path('public'))
args=parser.parse_args()
args.workspace.mkdir(parents=True,exist_ok=True)
recipes=json.loads(Path(__file__).with_name('revision-camera-jobs.json').read_text())
catalogue=json.loads((args.public/'data/revision-panels-20261121.json').read_text())['panels']
by_name={Path(row['archive']).name:row for row in catalogue}
inputs=[]
for i,job in enumerate(recipes):
    matches=(path for path in args.source_archive.rglob(job['recipe']) if hashlib.sha256(path.read_bytes()).hexdigest()==job['recipeSHA256'])
    recipe=next(matches,None)
    if recipe is None:raise FileNotFoundError(job['recipe']+' at recorded SHA-256')
    config={'recipe':str(recipe.resolve()),'targets':job['views'],'args':job['args']}
    if job.get('replayBothVersions'):config['replayBothVersions']=True
    (args.workspace/f'job-{i:02}-{recipe.parent.name}.json').write_text(json.dumps(config,indent=2)+'\n')
    for camera,name in job['views'].items():
        row=by_name[name]
        inputs.append({'project':row['project'],'place':row['place'],'archive':row['archive'],'name':name,'caption':row['historicalLabel'],'recipe':str(recipe),'camera':camera})
if len(inputs)!=len(catalogue):raise ValueError('Incomplete signed publication mapping')
(args.workspace/'historical-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
print(len(inputs),'assigned views from',len(recipes),'verified camera recipes')
