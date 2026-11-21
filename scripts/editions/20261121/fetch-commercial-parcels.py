from pathlib import Path
import argparse,gzip,hashlib,json,urllib.parse,urllib.request
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser(description='Retrieve the four surveyed commercial uses in the December 2025 municipal land-use dataset.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
url='https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2025_Existing_Land_Use/FeatureServer/0/query'
categories=['General Retail Commercial','Other Retail','Automotive Service Commercial','Office']
def fetch(args):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url+'?'+urllib.parse.urlencode({'f':'json',**args}),timeout=28) as f:d=json.load(f)
   if 'error' in d:raise ValueError(d['error'])
   return d
  except OSError:
   if attempt==2:raise
ids=sorted(fetch({'where':"ELU_DESCRIPTION IN ("+','.join("'"+x+"'" for x in categories)+")",'returnIdsOnly':'true'})['objectIds'])
def page(group):
 obj=fetch({'objectIds':','.join(map(str,group)),'outFields':'OBJECTID,ELU_DESCRIPTION','outSR':'26917','geometryPrecision':2,'returnGeometry':'true'})
 assert {a['attributes']['OBJECTID'] for a in obj['features']}==set(group)
 assert obj['spatialReference'].get('latestWkid',obj['spatialReference']['wkid'])==26917
 return obj['features']
groups=[ids[i:i+175] for i in range(0,len(ids),175)]
features=[]
with ThreadPoolExecutor(max_workers=4) as workers:
 for batch in workers.map(page,groups):features.extend(batch)
features.sort(key=lambda a:a['attributes']['OBJECTID'])
data={'source':url,'item':'eca242246d6141fd9d8efbbaf2769a3d','surveyDate':'2025-12-31','layerLastEdit':1788362315669,'spatialReference':26917,'includedUses':categories,'features':features}
dest=args.output
dest.parent.mkdir(parents=True,exist_ok=True)
raw=json.dumps(data,separators=(',',':')).encode()
blob=gzip.compress(raw,mtime=0)
# The archived version pins the uncompressed municipal response independently of the zlib version.
pinned=Path(__file__).resolve().parent/'geometry-sources/commercial-parcels-2025.json.gz'
if raw!=gzip.decompress(pinned.read_bytes()):
 raise ValueError('The live parcel snapshot changed since the published survey was retrieved.')
assert len(features)==1266
dest.write_bytes(blob)
print(len(features),'parcels',len(blob),'bytes',hashlib.sha256(blob).hexdigest())
