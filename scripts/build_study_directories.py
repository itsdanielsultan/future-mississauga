"""Write the illustrated Buildings indexes around their existing, linkable study sheets."""
from html import escape, unescape
from pathlib import Path
import re

PUBLIC = Path(__file__).resolve().parents[1] / 'public'


# Curatorial groups keep case studies with related work, including areas with only one study.
STUDY_GROUPS = {
    'Houses and apartments': {
        'aldo-1422-study','glen-erin-6719','merner-41-bay','merner-42-john','merner-42-peter','square-one-block22',
        'lakeview-deco-opus','clarkson-creekside-1639','paisley-45','sherobee-2200','winding-trail-1355','fairview-neighbourhood',
    },
    'Community buildings and workplaces': {
        'burnhamthorpe-community-centre','south-common-community-centre','st-hilarys-anglican-church','hazelhurst-business-park',
        'sgm-maritz-6710','ergocentric-275-superior','nrc-2620-speakman','west-end-buddhist-temple-study','utm-davis-meeting-place-canopy-study',
    },
    'Heritage buildings': {
        'anchorage','bell-gairdner-estate-study','benares-house','benares-visitor-centre','bradley-barn',
        'bradley-log-cabin','leslie-log-house','port-credit-lighthouse','queen-228',
    },
    'Parks and public art': {
        'gala-gateway','conference-council-house','churchill-meadows-log-play-study','paul-coffey-castle-study','fairwinds-park-ship-study',
    },
}


def update_study_directories(catalogue, features):
    for filename, title, old in [('review-renders.html', 'Building studies', 'Exterior studies'), ('reference-updates.html', 'Before and after', 'Model revisions')]:
        page = PUBLIC / filename
        html = page.read_text()
        html = html.replace('<h1>' + old + '</h1>', '<h1>' + title + '</h1>')
        html = html.replace(old + ' · Buildings |', title + ' · Buildings |')
        sheet_class = 'render-project' if filename == 'review-renders.html' else 'model-change'
        cards = []
        def sheet(match):
            opening, key, body = match.group(1, 2, 3)
            if 'data-archive-study' in opening:
                return match.group()
            feature = features.get(key, {})
            row = catalogue[key]
            name = re.search(r'<h2[^>]*>(.*?)</h2>', body, flags=re.S)[1]
            name = escape(unescape(re.sub('<[^>]+>','',name)))
            if feature.get('cardImage'):
                image = feature['cardImage']['url']
            elif sheet_class == 'render-project':
                image = re.search(r'<img[^>]+?src="([^"]+)"', body)[1]
            elif key == 'fairview-neighbourhood':
                image = 'gallery/edition-20261121/signed/neighbourhood-fairview-after-thumb.webp'
            else:
                image = (feature.get('cardImage') or row['image'])['url']
            if not (PUBLIC / image).is_file():
                raise ValueError('Missing thumbnail for '+key+': '+image)
            area = row['area']
            group = next((label for label, ids in STUDY_GROUPS.items() if key in ids), 'Other studies')
            address = escape(row.get('address', ''), quote=True)
            cards.append((group, name, '<li><a data-study-link="'+key+'" data-area="'+escape(area,quote=True)+'" data-address="'+address+'" href="#'+key+'"><img src="'+escape(image,quote=True)+'" alt="" width="640" height="480" loading="lazy" decoding="async"><span>'+name+'</span><small>'+escape(area)+'</small></a></li>'))
            if feature:
                if '<nav class="study-links"' in body and 'href="building-'+key+'.html"' not in body:
                    body = re.sub(r'(<nav class="study-links"[^>]*>)',r'\g<1><a href="building-'+key+'.html">Building profile →</a>',body,count=1)
            back='<a class="sheet-back" data-study-back href="'+filename+'">← '+title+'</a>'
            body=re.sub(r'<a class="sheet-back".*?</a>','',body)
            return opening + back + body + '</section>'
        html=re.sub(r'(<section class="'+sheet_class+r'" id="([^"]+)"[^>]*>)(.*?)</section>',sheet,html,flags=re.S)
        grouped=[]
        group_names = dict.fromkeys([*STUDY_GROUPS, *(item[0] for item in cards)])
        for area in group_names:
            items=sorted((item for item in cards if item[0]==area),key=lambda item:item[1].casefold())
            if not items: continue
            grouped.append('<div class="study-directory-group"><h2>'+escape(area)+'</h2><ul>'+''.join(item[2] for item in items)+'</ul></div>')
        directory='<nav class="study-list" aria-label="'+title+' index">'+''.join(grouped)+'</nav>'
        html=re.sub(r'<nav class="study-list".*?</nav>','',html,flags=re.S)
        controls=('<form class="study-browser" data-study-browser role="search"><label>Find a study<input class="ui-input" type="search" placeholder="Name or address" autocomplete="off"></label>'
                  '<label>Area<select class="ui-select" data-study-area><option value="">All areas</option></select></label>'
                  '<span role="status" aria-live="polite">'+str(len(cards))+' studies</span></form>')
        html=re.sub(r'<form class="study-browser".*?</form>',lambda _:controls+directory,html,count=1,flags=re.S)
        html=re.sub(r'<details class="building-about".*?</details>','',html,flags=re.S)
        if 'id="study-no-script"' not in html:
            html=html.replace('</head>', '''<noscript id="study-no-script"><style>
body.building-pages main#main .study-browser, body.building-pages main#main > :is(.render-project,.model-change) {display:none}
body.building-pages main#main > :is(.render-project,.model-change):is(:target,:has(:target)) {display:block!important}
body.building-pages main#main:has(> :is(.render-project,.model-change):is(:target,:has(:target))) .study-list {display:none}
</style></noscript></head>''')
        html=re.sub(r'<p class="study-notes-link"><a href="study-notes.html[^"]*" data-current-study-note>.*?</p>','',html,flags=re.S)
        if sheet_class=='render-project':
            def booklet(m):
                contents=m[1]
                if 'data-document-preview' in contents:
                    contents=re.sub(r'<a\b[^>]*\bdownload[^>]*>Download PDF[^<]*</a>','',contents)
                return '<div class="render-actions">'+contents+'</div>'
            html=re.sub(r'<div class="render-actions">(.*?)</div>',booklet,html,flags=re.S)
        page.write_text(html)
    for file in ('model.html','review-renders.html','reference-updates.html'):
        p=PUBLIC/file
        text=p.read_text()
        def nav(m):
            return m.group().replace('Exterior studies</a>','Building studies</a>').replace('Model revisions</a>','Before and after</a>')
        text=re.sub(r'<nav class="building-formats".*?</nav>',nav,text,count=1,flags=re.S)
        text=re.sub(r'<p class="catalogue-note">.*?Explore all mapped projects in 3D.*?</p>','',text,count=1,flags=re.S)
        p.write_text(text)
