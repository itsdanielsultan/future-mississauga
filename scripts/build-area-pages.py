"""Publish place pages from the same edition records as the downloadable atlas."""
import json
from html import escape as e
from pathlib import Path
import re
public=Path(__file__).resolve().parents[1]/'public'
def data(name):return json.loads((public/'data'/(name+'.json')).read_text())
areas=data('districts'); names={r['id']:r['name'] for r in areas if r['id']!='citywide'}
names.update({'fairview':'Fairview','lorne-park':'Lorne Park','lisgar':'Lisgar & Argentia'})
places=data('city-plates-20261120')['plates'];features=data('building-features');buildings=[r for r in data('building-catalogue')['entries'] if r['id'] in features]
source=(public/'index.html').read_text()
head=source.split('</head>')[0]
header=re.search(r'<header class="site-header".*?</header>',source,re.S)[0]
footer=re.search(r'<footer\b.*?</footer>',source,re.S)[0]
def page(path,title,content,hero=None,area=None):
 h=head
 h=re.sub(r'<title>.*?</title>','<title>'+e(title)+' | Future Mississauga</title>',h)
 for marker in ['<meta property="og:title" content="','<meta name="twitter:title" content="']:
  h=re.sub(re.escape(marker)+r'[^"]*',lambda m:marker+e(title)+' | Future Mississauga',h)
 for tag,field in [('link','canonical'),('meta','og:url')]:
  h=re.sub('(<'+tag+r' (?:rel|property)="'+field+r'" (?:href|content)=")[^"]+',lambda m:m[1]+'https://futuremississauga.com/'+path,h)
 desc='See '+title+' in the Future Mississauga city model.'
 for marker in ['<meta name="description" content="','<meta property="og:description" content="','<meta name="twitter:description" content="']:
  h=re.sub(re.escape(marker)+r'[^"]*',lambda _:marker+e(desc),h)
 if hero:
  for marker in ['<meta property="og:image" content="','<meta name="twitter:image" content="']:
   h=re.sub(re.escape(marker)+r'[^"]*',lambda _:marker+'https://futuremississauga.com/'+hero['webImage'],h)
  h=re.sub(r'(<meta name="twitter:image:alt" content=")[^"]+', lambda m:m[1]+e(title+' in the city model'), h)
  for key,val in [('width',str(hero['width'])),('height',str(hero['height'])),('type','image/webp'),('alt',e(title+' in the city model'))]:
   h=re.sub(r'(<meta property="og:image:'+key+r'" content=")[^"]+',lambda m:m[1]+val,h)
 h=re.sub(r'<script[^>]+src="(?:home-routes|downtown-aerial)[^"]+"[^>]*></script>','',h)
 h=re.sub(r'<link[^>]+href="atlas-home-print\.css[^"]*"[^>]*>', '', h)
 h=re.sub(r'<link[^>]+rel="preload"[^>]*>','',h)
 nav=re.sub(r'(data-section="places")(?! aria-current)',r'\1 aria-current="page"',header)
 collection=' data-picture-area="'+e(title)+'" data-picture-map="'+e(map_link(area))+'"' if area else ''
 (public/path).write_text(h+'<link rel="stylesheet" href="atlas-places.css?v=20261120"></head><body class="atlas-places"><a class="site-skip" href="#main">Skip to content</a>'+nav+'<main id="main" class="place-main"'+collection+'>'+content+'</main>'+footer+'<script type="module" src="site-ui.js?v=20261120-plates"></script></body></html>\n')
def member(row,area):
 if area=='fairview':return '/fairview/' in row['id']
 file=row['id'].split('/')[-1]
 return sorted([a for a in names if file.startswith(a+'-')],key=len,reverse=True)[:1]==[area]
def select(area):
 rows=[r for r in places if member(r,area)]
 return sorted(rows,key=lambda r:(r['id']!='wide/'+area+'-future.png','wide/' not in r['id'],'skyline' in r['id'],'future' not in r['id']))
def image(row,alt,priority=False):
 full=row['webImage']
 thumb=Path(full).parent/'thumbnails'/Path(full).name
 width,height=row['width'],row['height']
 srcset=''
 if (public/thumb).is_file():
  small_width=round(width*min(1,640/max(width,height)))
  sizes='(min-width:1400px) 1280px, 92vw' if priority else '(max-width:620px) 95vw, (max-width:800px) 45vw, 32vw'
  srcset=f' srcset="{e(str(thumb))} {small_width}w, {e(full)} {width}w" sizes="{sizes}"'
 return '<img src="'+e(full)+'"'+srcset+' width="'+str(row['width'])+'" height="'+str(row['height'])+'" alt="'+e(alt)+'" '+('fetchpriority="high"' if priority else 'loading="lazy"')+'>'
def area_link(id):return 'place-'+id+'.html'
def map_link(id):
 return 'explore.html?district=citywide&context=fairview' if id=='fairview' else 'explore.html?district='+id

def view_label(row):
 name=row['id'].split('/')[-1]
 if '-portrait-' in name:
  return 'Closer view · '+row['label']
 if 'landmark-' not in name and 'junction-' not in name and 'skyline-' not in name and row['id'].startswith(('wide/','portraits/')):
  return 'Aerial view · '+row['label']
 return row['label']

def picture_link(row,alt,priority=False):
 master=row['displayMaster']
 return (f'<a href="{e(master["url"])}" data-edition-plate="{e(row["id"])}"'
         f' data-preview-title="{e(view_label(row))}" data-preview-download="{e(row["download"]["url"])}"'
         f' data-preview-width="{master["width"]}" data-preview-height="{master["height"]}">'
         +image(row,alt,priority)+'</a>')

def view_grid(title,rows,portrait=False):
 if not rows:return ''
 layout='place-other place-vertical' if portrait else 'place-other'
 frames=[]
 for r in rows:
  label=view_label(r)
  frames.append('<figure>'+picture_link(r,label+' in '+r['area'])+'<figcaption>'+e(label)+'</figcaption></figure>')
 return '<section class="'+layout+'"><h2>'+e(title)+'</h2><div>'+''.join(frames)+'</div></section>'

def title_link(url,label):return '<a class="place-action" href="'+e(url)+'">'+e(label)+' <span aria-hidden="true">→</span></a>'
def card(id):
 row=select(id)[0];return '<a class="place-card" href="'+area_link(id)+'">'+image(row,'')+'<span>'+e(names[id])+'<i aria-hidden="true">→</i></span></a>'
landings={
 'downtown':('mcity-1-2','M City in 3D'),
 'port-credit':('port-credit-lighthouse','Lighthouse site in 3D'),
 'lakeview':('lakeview-master','Lakeview Village in 3D'),
 'cooksville':('cooksville-toc','Cooksville GO in 3D')
}
cards={}
for id,title in sorted(names.items(),key=lambda pair:pair[1]):
 rows=select(id)
 if not rows:continue
 lead=rows[0];studies=[b for b in buildings if b['areaId']==id]
 links=title_link(map_link(id),'Open 3D map')
 if id in {'downtown','port-credit','lakeview','clarkson'}:
  links+=title_link('compare.html?area='+id,'Compare views')
 body='<header class="place-mast"><div><a class="place-back" href="neighbourhoods.html">Neighbourhoods</a><h1>'+e(title)+'</h1></div><nav aria-label="Explore this neighbourhood">'+links+'</nav></header>'
 body+='<figure class="place-lead">'+picture_link(lead,title+' in the Mississauga model',True)+'<figcaption><span>'+e(lead['label'])+'</span><a href="downloads/edition-20261120/Mississauga-Atlas.pdf#page='+str(lead['page'])+'" data-document-preview>Atlas, page '+str(lead['page'])+' →</a></figcaption></figure>'
 if id in landings:
  project,label=landings[id]
  query='&context=' if project=='port-credit-lighthouse' else '&project='
  body+='<nav class="place-landmark" aria-label="Local landmark">'+title_link(map_link(id)+query+project,label)+'</nav>'
 if studies:
  li=''
  for b in studies:
   pageid='building-'+b['id']+'.html'
   if not (public/pageid).is_file():continue
   img=b.get('image'); li+='<a class="place-study" id="study-'+e(b['id'])+'" href="'+pageid+'?from='+id+'">'+('<img loading="lazy" src="'+e(img['url'])+'" alt="">' if img else '')+'<span>'+e(b['title'])+'<small>'+e(b.get('address') or title)+'</small></span><i aria-hidden="true">→</i></a>'
  if li:body+='<section class="place-studies"><h2>Buildings in '+e(title)+'</h2><div>'+li+'</div></section>'
 body+=view_grid('Other views',[r for r in rows[1:] if r['id'].startswith('wide/') or id=='fairview'])
 body+=view_grid('Portrait views',[r for r in rows if r['id'].startswith('portraits/')],True)
 page(area_link(id),title,body,lead,id);cards[id]=card(id)
hero=select('port-credit')[0]
featured = ['downtown','port-credit','lakeview']
def directory_group(title, ids):
 return '<section class="place-directory-group"><h2>'+e(title)+'</h2><div class="place-index">'+''.join(cards[id] for id in ids)+'</div></section>'
directory = '<header class="place-mast"><h1>Neighbourhoods</h1>'+'<nav aria-label="More ways to explore">'+title_link('gallery.html','Image gallery')+title_link('explore.html','Open city map')+'</nav></header>'
directory += directory_group('Downtown and the waterfront', featured)
directory += directory_group('More neighbourhoods', [id for id in cards if id not in featured])
page('neighbourhoods.html','Neighbourhoods',directory,hero)
print(len(cards),'neighbourhoods')
