"""Build the public building profiles from the reviewed selections and their evidence."""
import json
import re
from html import escape
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1] / "public"
DATA = ROOT / "data"

def load(name):
    return json.loads((DATA / name).read_text())

def link(url, label, cls=""):
    if url == 'https://davidlaskerphotography.com/':
        return f'<a class="{cls}" href="https://www.cityscapephotography.ca/" data-source-record="{url}">{escape(label)}</a>'
    return f'<a class="{cls}" href="{escape(url, quote=True)}">{escape(label)}</a>'

def picture(url, alt, size=None, lazy=False):
    dimensions = f' width="{int(size[0])}" height="{int(size[1])}"' if size else ""
    loading = ' loading="lazy"' if lazy else ""
    return f'<img src="{escape(url,quote=True)}" alt="{escape(alt,quote=True)}"{dimensions}{loading} decoding="async">'

def page_links(entry, feature):
    place = feature.get('place', {})
    addr = place.get('address') or feature.get('address') or entry['address'] or entry['title']
    query = place.get('query') or (addr + ', Mississauga, Ontario, Canada')
    google = 'https://www.google.com/maps/search/?' + urlencode({'api': '1', 'query': query})
    apple = 'https://maps.apple.com/?' + urlencode({'q': query})
    street = None
    if isinstance(place.get('lat'), (int,float)) and isinstance(place.get('lon'), (int,float)):
        coords = str(place['lat']) + ',' + str(place['lon'])
        street = 'https://www.google.com/maps/@?' + urlencode({'api':'1','map_action':'pano','viewpoint':coords})
    return addr,google,apple,street

def real_life(entry, feature, street):
    photos = feature.get('photos', [])
    portal = feature.get('photoPage')
    title = 'The site in real life' if feature.get('siteOnly') else 'In real life'
    figures = []
    for photo in photos:
        url = photo.get('url') or photo.get('remote')
        if not url: continue
        source = photo['source']
        credit = escape(photo['credit'])
        if photo.get('licenceURL'):
            credit += ' · ' + link(photo['licenceURL'], photo['licence'])
        figure_class = 'real-photo site-aerial' if photo.get('kind') == 'site-aerial' else 'real-photo'
        caption = '<strong>' + escape(photo.get('title') or photo['alt']) + '</strong><span>' + credit + ' · ' + link(source, photo.get('sourceLabel') or 'Original photo ↗') + '</span>'
        figures.append(f'<figure class="{figure_class}">' + picture(url,photo['alt'],photo.get('size'),True) + '<figcaption>' + caption + '</figcaption></figure>')
    actions = []
    if portal:
        actions.append(link(portal['url'],portal['label']))
    if street:
        actions.append(link(street, 'Look around in Street View'))
    if not actions and not figures:
        _,google,_,_=page_links(entry,feature)
        actions.append(link(google, 'View this address on Google Maps'))
    return '<section class="profile-real" aria-labelledby="realTitle"><h2 id="realTitle">' + title + '</h2>' + ''.join(figures) + ('<nav class="real-links" aria-label="Real-world views">' + ''.join(actions) + '</nav>' if actions else '') + '</section>'

def make_page(entry, feature, header, footer):
    key = entry['id']; name = feature.get('displayName') or entry['title']
    img = feature.get('displayImage') or entry['image']
    addr, google, apple, street = page_links(entry, feature)
    roles = feature.get('roles', [])
    grouped = {}
    for role in roles:
        label = role['role']
        if re.search(r'photograph|photo reference|structural engineer', label, re.I):
            continue
        label = 'Developers' if label.lower() == 'co-developer' else label
        grouped.setdefault(label, []).append(link(role['source'], role['name']))
    made_it = any(re.search(r'architect|build(?:er|ing contractor)|construct|contractor|design|develop|commission|craft|reconstruct', label, re.I) for label in grouped)
    facts = '' if made_it else '<div><dt>Architect or builder</dt><dd>Unconfirmed</dd></div>'
    facts += ''.join('<div><dt>'+escape(label)+'</dt><dd>'+', '.join(values)+'</dd></div>' for label,values in grouped.items())
    status=feature.get('statusLabel','')
    if status: facts+='<div><dt>Project stage</dt><dd>'+escape(status)+'</dd></div>'
    actions = ''.join(link(a['url'], {'city':'View in the 3D city','study':'See the exterior study','model':'Rotate the model'}[a['kind']], 'profile-action') for a in entry['links'])
    credit = entry.get('credit')
    byline='3D rendering by Daniel Sultan'
    if credit: byline+=' · Photograph reference by '+link(credit['url'], credit['label'])
    main = f'''<main id="main" class="building-profile">
<nav class="profile-breadcrumb" aria-label="Breadcrumb"><a href="model.html" data-directory-back>Buildings</a><span aria-hidden="true">/</span><a href="model.html?area={escape(urlencode({'a':entry['area']})[2:])}">{escape(entry['area'])}</a></nav>
<header class="profile-intro"><h1>{escape(name)}</h1><p>{escape(addr)} <a class="profile-photo-jump" href="#realTitle">See the site ↓</a></p></header>
<div class="profile-overview"><figure class="profile-model">{picture(img['url'],'3D study of '+name,[img['width'],img['height']])}<figcaption>{byline}</figcaption></figure>
<section class="profile-facts" aria-labelledby="teamTitle"><h2 id="teamTitle">Building team</h2><dl>{facts}</dl>
<nav class="profile-map-links" aria-label="Open the location">{link(google,'Google Maps ↗')}{link(apple,'Apple Maps ↗')}</nav>
<nav class="profile-actions" aria-label="Explore the model">{actions}</nav></section></div>
{real_life(entry,feature,street)}</main>'''
    title=escape(name)+' | Future Mississauga'; description=escape('The building team, location, real-world views and 3D study of '+name+'.',quote=True)
    canonical='https://futuremississauga.com/building-'+key+'.html'
    head=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><meta name="description" content="{description}"><link rel="canonical" href="{canonical}"><meta property="og:url" content="{canonical}"><meta property="og:title" content="{title}"><meta property="og:type" content="article"><meta property="og:image" content="https://futuremississauga.com/{escape(img['url'])}"><meta property="og:image:alt" content="3D model of {escape(name,quote=True)}"><link rel="icon" href="assets/favicon.svg"><link rel="stylesheet" href="site-ui.css?v=20261113-design2"><link rel="stylesheet" href="atlas-interface.css?v=20261120-buildings"><link rel="stylesheet" href="atlas-edition.css?v=20261120-publication"><link rel="stylesheet" href="atlas-buildings.css?v=20261120-publication"></head><body class="profile-page"><a class="site-skip" href="#main">Skip to content</a>'''
    (ROOT/('building-'+key+'.html')).write_text(head+header+main+footer+'<script type="module" src="site-ui.js?v=20261120-plates"></script><script type="module" src="building-detail.js?v=20261120-buildings"></script></body></html>\n')

BUILDING_FAMILIES = {
    'M City': ('mcity-pair', 'mcity-m1', 'mcity-m2', 'mcity-m5'),
    'Edge Towers': ('edge-1', 'edge-2', 'oro'),
    'Avia': ('avia-1', 'avia-2'),
}


def update_featured_directory(catalogue, features):
    def entry_card(key, level):
        feature, entry = features[key], catalogue[key]
        img = feature.get('cardImage') or feature.get('displayImage') or entry['image']
        tile = picture(img['url'], '', [img['width'], img['height']], lazy=True)
        credit = entry.get('credit')
        attribution = link(credit['url'], credit['label'], 'study-card-credit') if credit else ''
        name = escape(feature.get('displayName') or entry['title'])
        kinds = ' '.join(item['kind'] for item in entry['links'])
        search = ' '.join(str(entry.get(field) or '') for field in ('title', 'address', 'location'))
        return (f'<article class="building-card" data-building="{escape(key)}" data-area="{escape(entry["area"],quote=True)}" '
                f'data-views="{escape(kinds,quote=True)}" data-search="{escape(search,quote=True)}">'
                f'<a class="building-card-link" href="building-{escape(key)}.html">'
                f'<span class="building-card-image">{tile}</span><{level}>{name}</{level}></a>'
                f'{attribution}</article>')

    def card_row(keys, level):
        return '<div class="building-row">' + ''.join(entry_card(key, level) for key in keys) + '</div>'

    areas = {}
    for key in sorted(features, key=lambda item: catalogue[item]['title'].casefold()):
        areas.setdefault(catalogue[key]['area'], []).append(key)
    sections = []
    for area in sorted(areas, key=lambda name: (name != 'Downtown', name)):
        keys = areas[area]
        remaining = list(keys)
        rows = []
        for name, members in BUILDING_FAMILIES.items():
            present = [key for key in members if key in keys]
            if len(present) >= 2:
                rows.append(f'<div class="building-group"><h3 class="project-heading">{name}</h3>'
                            + card_row(present, 'h4') + '</div>')
                remaining = [key for key in remaining if key not in present]
        if remaining:
            rows.append(card_row(remaining, 'h3'))
        sections.append(f'<section class="building-area"><h2 class="area-heading">{escape(area)}</h2>'
                        + ''.join(rows) + '</section>')

    page = ROOT / 'model.html'
    html = page.read_text()
    html, n = re.subn(r'<!-- (?:featured buildings|building directory) -->.*?<!-- end (?:featured buildings|building directory) -->',
                      lambda _: '<!-- building directory -->' + ''.join(sections) + '<!-- end building directory -->',
                      html, count=1, flags=re.S)
    if not n:
        raise ValueError('The building directory container is missing from model.html')
    html = html.replace('class="building-catalogue" id="previewLinks"', 'class="building-catalogue is-grouped" id="previewLinks"')
    html = re.sub(r'(<p id="choiceStatus"[^>]*>).*?(</p>)', lambda match: match[1] + str(len(features)) + ' buildings' + match[2], html)
    names = sorted({entry['area'] for entry in catalogue.values()} - set(areas))
    html = re.sub(r'(<select[^>]*id="buildingArea")[^>]*>', lambda match: match[1] + ' data-archived-areas="' + escape(json.dumps(names), quote=True) + '">', html)
    page.write_text(html)

CITY_TERMS = 'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data'


def update_model_notes(features):
    manifest = load('model-previews.json')
    city_assets = {a['id'] for a in manifest['assets'] if a.get('cityDataTerms')}
    group = ['<section class="publication-note-group" id="model-credits" aria-labelledby="model-credits-title"><h2 id="model-credits-title">Interactive model credits</h2>']
    text = ['FUTURE MISSISSAUGA', 'Interactive model credits and limitations', '']
    for view in manifest['views']:
        key = view['id']
        group.append(f'<article id="model-{escape(key)}"><h3>{escape(view["title"])}</h3>')
        text.extend([view['title'], view['subtitle']])
        for field in ('credit', 'summary', 'limits', 'rights'):
            value = view.get(field)
            if value:
                group.append('<p>' + escape(value) + '</p>')
                text.append(value)
        sources = list(view['sources'])
        reference = view.get('visibleReferenceCredit')
        if reference:
            sources.append({'title': 'Photo reference: ' + reference['label'], 'url': reference['url']})
        if city_assets.intersection(view['assets']):
            sources.append({'title': 'City of Mississauga data terms', 'url': CITY_TERMS})
        group.append('<ul>')
        for source in sources:
            note = source.get('note', '')
            detail = (' · ' + escape(note)) if note else ''
            group.append('<li>' + link(source['url'], source['title']) + detail + '</li>')
            text.append(f'{source["title"]} · {source["url"]}' + (' · ' + note if note else ''))
        group.append('</ul><p>' + link('model.html?model=' + key, 'Return to the 3D model') + '</p></article>')
        text.append('')
    group.append('</section>')

    notes = ROOT / 'study-notes.html'
    original = notes.read_text()
    start, end = '<!-- interactive model credits -->', '<!-- end interactive model credits -->'
    section = start + '\n' + '\n'.join(group) + '\n' + end
    contact = '<section class="study-note-contact" id="reference-contact">'
    if start in original:
        updated, count = re.subn(re.escape(start) + '.*?' + re.escape(end), lambda _: section, original, count=1, flags=re.S)
        if count != 1:
            raise ValueError('Incomplete generated model-credit section.')
    elif contact in original:
        updated = original.replace(contact, section + '\n' + contact, 1)
    else:
        raise ValueError('The model notes page has no insertion point for its credits.')
    index_link = '<a href="#model-credits">Interactive model credits</a>'
    if index_link not in updated:
        updated = updated.replace('<a href="#reference-contact">', index_link + '<a href="#reference-contact">', 1)
    if updated != original:
        notes.write_text(updated)

    download = ROOT / 'downloads' / 'Model-study-credits.txt'
    original = download.read_text()
    divider = '\n\nOCTOBER 2026 RELEASE NOTICES\n\n'
    archive = original.partition(divider)[2] if divider in original else original
    updated = '\n'.join(text).rstrip() + divider + archive
    if updated != original:
        download.write_text(updated)

    directory = ROOT / 'model.html'
    page = directory.read_text()
    ids = ' '.join(view['id'] for view in manifest['views'] if view['id'] in features)
    updated, count = re.subn(r'(id="studyProfile" data-profiles=")[^"]*"', lambda m: m[1] + escape(ids) + '"', page, count=1)
    if count != 1:
        raise ValueError('The 3D study profile link is missing from model.html.')
    if updated != page:
        directory.write_text(updated)


def update_directory_routes(catalogue, features):
    by_project = {}
    for key in features:
        entry = catalogue[key]
        project = 'mcity-5' if key == 'mcity-m5' else entry['projectId']
        by_project.setdefault(project, []).append([key, entry['title']])
    if 'mcity-pair' in features:
        by_project['mcity-1-2'] = [['mcity-pair', catalogue['mcity-pair']['title']]]
    code = json.dumps(by_project, indent=2, ensure_ascii=False)
    (ROOT/'building-map-profiles.js').write_text('// Published building pages keyed by city map project.\nexport const buildingMapProfiles = ' + code + ';\n')
    areas = ' '.join(sorted({catalogue[key]['areaId'] for key in features}))
    gallery = ROOT/'gallery.html'
    gallery.write_text(re.sub(r'(id="placeBuildings" data-areas=")[^"]*', lambda m: m[1]+areas, gallery.read_text(), count=1))

def update_revision_plates(features):
    page = ROOT/'reference-updates.html'
    extra_path = ROOT.parent/'scripts/editions/20261120/buildings/revisions.json'
    editions = {key: value['displayImage']['url'] for key, value in features.items()}
    editions.update({key: value['image']['url'] for key, value in json.loads(extra_path.read_text()).items()})
    page_html = page.read_text()

    def bind(match):
        key, inner = match[1], match[2]
        if '<img ' not in inner:
            return match[0]
        if key == 'fairview-neighbourhood':
            for stage in ('before', 'after'):
                original = 'gallery/edition-20261120/originals/neighbourhood-fairview-' + stage + '-print.png'
                preview = 'gallery/edition-20261120/signed/neighbourhood-fairview-' + stage + '.webp'
                inner = re.sub(r'https://github\.com/[^"]+/neighbourhood-fairview-' + stage + r'-(?:clean|download)-[0-9a-f]+\.png', original, inner)
                old_image = r'gallery/native-[^"/]+/neighbourhood-fairview-' + stage + r'-[\w-]+\.(?:avif|webp)'
                inner = re.sub(r'src="' + old_image + '"', 'src="' + preview + '"', inner)
                sources = preview.replace('.webp','-thumb.webp') + ' 640w, ' + preview + ' 1600w, ' + preview.replace('.webp','-full.webp') + ' 1800w'
                inner = re.sub(r'srcset="' + old_image + r'[^"]*"', 'srcset="' + sources + '"', inner)
                master = preview.replace('.webp', '-full.webp')
                # Keep image inspection distinct from saving the signed print.
                inner = inner.replace(f'<a href="{original}" data-preview-download="{original}">',
                                      f'<a href="{master}" data-preview-download="{original}" data-edition-plate="neighbourhood/fairview/{stage}">')
                label = f'Download the {stage} view of Fairview'
                if f'aria-label="{label}"' not in inner:
                    pattern = r'(<figure><a href="'+re.escape(master)+r'"[\s\S]*?<figcaption\b[^>]*>[\s\S]*?)(</figcaption>)'
                    action = f'<a class="file-download" href="{original}" download data-download aria-label="{label}">Download PNG</a>'
                    inner = re.sub(pattern,lambda m:m[1]+action+m[2],inner,count=1)
        else:
            current = editions[key]
            previous = r'<div class="revision-edition">.*?</div>'
            inner = re.sub(previous, '', inner, flags=re.S)
            title = re.search(r'<h2[^>]*>(.*?)</h2>', inner, re.S)[1]
            reference = ('<div class="revision-edition"><h3>Earlier comparison</h3>'
                         f'<a href="{escape(current,quote=True)}" data-preview-title="{title} · Current rendering" '
                         f'data-preview-download="{escape(current,quote=True)}">Open current rendering →</a></div>')
            inner = inner.replace('<div class="image-pair">', reference + '<div class="image-pair">', 1)
        return match[0][:match.start(2)-match.start()] + inner + '</section>'

    bound = re.sub(r'<section class="model-change" id="([^"]+)"[^>]*>(.*?)</section>', bind, page_html, flags=re.S)
    if bound != page_html:
        page.write_text(bound)


def main():
    page=(ROOT/'model.html').read_text()
    header=re.search(r'<header class="site-header".*?</header>',page,re.S).group()
    footer=re.search(r'<footer class="compact-footer".*?</footer>',page,re.S).group()
    catalogue={r['id']:r for r in load('building-catalogue.json')['entries']}
    features=load('building-features.json')
    update_featured_directory(catalogue, features)
    update_model_notes(features)
    update_directory_routes(catalogue, features)
    update_revision_plates(features)
    for key,feature in features.items():
        make_page(catalogue[key],feature,header,footer)
    print(f'Built {len(features)} building profiles')

if __name__ == '__main__':
    main()
