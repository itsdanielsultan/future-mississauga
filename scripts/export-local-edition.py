"""Export a self-contained file:// edition of the atlas (Python standard library)."""
import argparse
import base64
import ctypes
import gzip
import hashlib
import json
import mimetypes
import os
import posixpath
import re
import shutil
import sys
from functools import lru_cache
from html import escape
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public"
IMPORT = re.compile(r"""(\b(?:from\s*|import\s*(?:\(\s*)?))(['"])([^'"\n]+)\2""")
JSON_IMPORT = re.compile(r"""\bimport\s+([\w$]+)\s+from\s+(['"])(\.[^'"\n]+\.json)\2\s+with\s*\{\s*type\s*:\s*(['"])json\4\s*\}\s*;?""")
SCRIPT = re.compile(r"<script\b([^>]*)>([\s\S]*?)</script>", re.I)
ATTR = re.compile(r"""([\w:-]+)\s*=\s*(["'])(.*?)\2""", re.S)
MEDIA_MODULES = ["media-control-bar","media-play-button","media-time-range","media-time-display","media-loading-indicator"]
MIMES = {".glb":"model/gltf-binary", ".gz":"application/gzip",".txt":"text/plain;charset=utf-8",".json":"application/json"}

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = data.encode("utf-8") if isinstance(data, str) else data
    if path.is_file() and path.read_bytes() == data:
        return
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_bytes(data)
    temp.replace(path)

# APFS cloning keeps exported originals independent and reuses disk space.
# Other file systems can use hard links or normal copies.
CLONEFILE = getattr(ctypes.CDLL(None), 'clonefile', None) if sys.platform == 'darwin' else None

def copy(source, target, known):
    target.parent.mkdir(parents=True, exist_ok=True)
    stamp=source.stat()
    identity=[stamp.st_dev,stamp.st_ino,stamp.st_size,stamp.st_mtime_ns]
    if known==identity and target.is_file() and target.stat().st_size==stamp.st_size:
        return identity
    temp=target.with_suffix(target.suffix+'.copying')
    temp.unlink(missing_ok=True)
    try:
        cloned=CLONEFILE and CLONEFILE(os.fsencode(source),os.fsencode(temp),0)==0
        if not cloned:
            try:
                os.link(source,temp)
            except OSError:
                shutil.copy2(source,temp)
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)
    return identity

def resolved(owner, name):
    name = name.split("?")[0]
    if name == "three": return "vendor/three.module.js"
    if name.startswith("three/addons/"): return name.replace("three/addons/", "vendor/addons/", 1)
    if name.startswith("."): return posixpath.normpath(posixpath.join(posixpath.dirname(owner), name))
    raise ValueError(f"Unknown module specifier in {owner}: {name}")

def converted(owner, code):
    deps = set()
    # The local import map contains JavaScript blobs. Embed JSON modules into
    # their consumers so opening a map directly in Finder needs no file fetch.
    def json_module(match):
        path = (SOURCE / resolved(owner, match[3])).resolve()
        if not path.is_relative_to(SOURCE):
            raise ValueError(f'Invalid local JSON module in {owner}')
        payload = json.dumps(json.loads(path.read_text()), separators=(',', ':'))
        return 'const ' + match[1] + ' = JSON.parse(' + json.dumps(payload) + ');'
    code = JSON_IMPORT.sub(json_module, code)
    def change(m):
        name = m[3]
        if not (name.startswith(".") or name == "three" or name.startswith("three/addons/")):
            return m[0]
        path = resolved(owner, name)
        if not (SOURCE / path).is_file(): # e.g. documentation examples
            return m[0]
        deps.add(path)
        return m[1]+m[2]+"fm:"+path+m[2]
    code = IMPORT.sub(change, code)
    if owner == 'media-player.js':
        for name in MEDIA_MODULES: deps.add("vendor/media-chrome-4.19.2/"+name+".js")
        code=code.replace('import(`./vendor/media-chrome-', 'import(`fm:vendor/media-chrome-')
    code=code.replace('import.meta.url', 'new URL('+json.dumps(owner)+', document.baseURI).href')
    if owner == 'asset-delivery.js':
        code=code.replace('releaseAssetURL(cloudflareAssetURL(value))','window.fmLocal.localize(releaseAssetURL(cloudflareAssetURL(value)))')
    if owner == 'clean-media.js':
        code=code.replace('url=new URL(value,baseURL);', 'url=new URL(value,window.fmLocal.validationBase(baseURL));')
    if owner == 'media-catalog.js':
        code=code.replace('const url=new URL(asset.url,baseURL);', 'const url=new URL(asset.url,window.fmLocal.validationBase(baseURL));')
    if owner == 'image-preview.js':
        probe="!['http:','https:'].includes(url.protocol)"
        code=code.replace(probe, "("+probe+" && !window.fmLocal.contains(url))")
    if owner == 'media-catalog.js':
        code = code.replace("['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname)",
                            "(new URL(baseURL).protocol==='file:' || ['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname))")
    if owner == 'file-actions.js':
        code=code.replace('const url=assetURL(anchor.href);if(!isDeliveredImageURL(url)',"const url=assetURL(anchor.href);if(new URL(url,document.baseURI).protocol==='file:'||!isDeliveredImageURL(url)")
    if owner == 'document-preview.js':
        code=code.replace('const resolved = new URL(url, baseURL);','const resolved = new URL(window.fmLocal.localize(url), baseURL);')
    if owner in ('site-ui.js','viewer-bootstrap.js'):
        code=code.replace("'./#pictures'","'index.html#pictures'").replace("'./'","'index.html'")
    if owner in ('model.html','gallery.js','building-detail.js','compare-page.js','skyline-scenarios.js','map-location.js','building-catalogue.js','app.js','model-preview.js','accuracy-browser.js'):
        code=code.replace('window.location.search','window.fmLocal.historyURL(window).search')
        code=code.replace('location.search','window.fmLocal.historyURL().search')
        code=code.replace('location.href','window.fmLocal.historyURL().href')
        code=code.replace('history.pushState(history.state', "window.fmLocal.writeHistory('pushState', history.state")
        code=code.replace('history.replaceState(history.state', "window.fmLocal.writeHistory('replaceState', history.state")
    if owner == 'study-browser.js':
        code=code.replace("history[historyMode](history.state", "window.fmLocal.writeHistory(historyMode, history.state")
    return code, deps

def module_script(page, roots, modules, output):
    def package(entry_points):
        closure = set()
        pending = list(entry_points)
        while pending:
            name = pending.pop()
            if name in closure:
                continue
            closure.add(name)
            pending.extend(modules[name][1] - closure)
        bundle = json.dumps({name: modules[name][0] for name in sorted(closure)}, separators=(',', ':'))
        group = '_local/modules-' + hashlib.sha256(bundle.encode()).hexdigest()[:12] + '.js'
        output(group, 'fmLocal.modules(' + bundle + ');')
        return group

    full = package(roots)
    if page != 'model.html':
        return '<script src="' + full + '"></script>'
    # Both branches are dynamic imports in the web edition. A file: page needs
    # only the selected branch's import map before its module scripts run.
    if not {'model-preview.js', 'building-catalogue.js'}.issubset(roots):
        raise ValueError('The Buildings entry must declare its directory and viewer imports.')
    catalogue = package(roots - {'model-preview.js'})
    return ('<script data-building-graphs data-catalogue="' + catalogue + '" data-viewer="' + full + '">'
            'fmLocal.loadBuildingGraph(document.currentScript);</script>')

CSS_IMPORT = re.compile(r"""@import\s+url\(\s*['"]?([^)'"]+)['"]?\s*\)\s*;""", re.I)
CSS_URL = re.compile(r"""url\(\s*(?:(["'])(.*?)\1|([^)'"]+))\s*\)""", re.I | re.S)

@lru_cache(maxsize=None)
def data_uri(asset):
    mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(asset.read_bytes()).decode('ascii')

def html_attrs(tag):
    return {m[1].lower():m[3] for m in ATTR.finditer(tag)}

def page_presentation(html, target):
    # File previews can receive only the clicked HTML. Keep the cascade,
    # imported font faces and their assets in the document, in source order.
    target = target.resolve()
    seen_fonts = set()
    def css_string(file):
        if file.parent.is_relative_to(target/'vendor/fonts'):
            if file in seen_fonts:
                return ''
            seen_fonts.add(file)
        def rewrite(m):
            value = (m[2] or m[3]).strip()
            if value.startswith(('#', 'data:')) or urlsplit(value).scheme:
                return m[0]
            asset = (file.parent/unquote(urlsplit(value).path)).resolve()
            if not asset.is_relative_to(target) or not asset.is_file():
                raise ValueError(f'Missing CSS resource {value} in {file.name}')
            return 'url("' + data_uri(asset) + '")'
        # Rewrite each imported sheet relative to its own directory.
        chunks = []
        start = 0
        source = file.read_text()
        for imp in CSS_IMPORT.finditer(source):
            chunks.append(CSS_URL.sub(rewrite, source[start:imp.start()]))
            chunks.append(css_string((file.parent/imp[1]).resolve()))
            start = imp.end()
        chunks.append(CSS_URL.sub(rewrite, source[start:]))
        return ''.join(chunks)
    def link(m):
        attrs = html_attrs(m[0])
        if 'stylesheet' not in attrs.get('rel','').lower().split():
            return m[0]
        href = attrs['href']
        sheet = (target/urlsplit(href).path).resolve()
        if not sheet.is_relative_to(target):
            raise ValueError(f'Invalid local stylesheet {href}')
        media = ' media="' + escape(attrs['media'],quote=True) + '"' if attrs.get('media') else ''
        return '<style data-sheet="' + escape(sheet.name) + '"' + media + '>' + css_string(sheet) + '</style>'
    def image(m):
        tag = m[0]
        attrs = html_attrs(tag)
        src = attrs.get('src', '')
        if attrs.get('id') != 'heroImage' and 'future-mississauga-mark.svg' not in src:
            return tag
        asset = target/urlsplit(src).path
        # The Mac opener can travel separately from the site's image folder.
        # Embed the largest available local hero for high-density displays.
        candidates = []
        for candidate in attrs.get('srcset', '').split(','):
            parts = candidate.split()
            if len(parts) != 2 or not re.fullmatch(r'\d+w', parts[1]):
                continue
            url = urlsplit(parts[0])
            if url.scheme or url.netloc:
                continue
            path = (target / unquote(url.path)).resolve()
            if path.is_relative_to(target) and path.is_file():
                candidates.append((int(parts[1][:-1]), path))
        if candidates:
            asset = max(candidates, key=lambda item: item[0])[1]
        tag = re.sub(r'\s+srcset="[^"]*"', '', tag, flags=re.I)
        return re.sub(r'\bsrc="[^"]*"', lambda _: 'src="' + data_uri(asset) + '"', tag, count=1, flags=re.I)
    def timed_text(match):
        tag = match[0]
        src = html_attrs(tag).get('src', '')
        if not src or urlsplit(src).scheme or not src.endswith('.vtt'):
            return tag
        asset = (target / unquote(src)).resolve()
        if not asset.is_relative_to(target) or not asset.is_file():
            raise ValueError(f'Missing local text track: {src}')
        payload = base64.b64encode(asset.read_bytes()).decode('ascii')
        return re.sub(r'\bsrc=(["\']).*?\1', 'src="data:text/vtt;base64,' + payload + '"', tag, count=1)
    html = re.sub(r'<track\b[^>]+>',timed_text,html,flags=re.I)
    html = re.sub(r'<img\b[^>]+>',image,html,flags=re.I)
    return re.sub(r'<link\b[^>]+>',link,html,flags=re.I)

def write_mac_entry(destination, home):
    # Downloading an attachment puts the HTML alone in Downloads. This entry
    # opens the entire installed edition regardless of the downloaded filename.
    address = home.as_uri()
    from urllib.parse import quote
    sibling = quote(home.parent.name, safe='') + '/'
    bootstrap = ('<base href="' + escape(home.parent.as_uri() + '/') + '">'
                 '<script id="open-installed-edition">if(location.protocol==="file:"){'
                 'const openPage=base=>{const page=new URL(' + json.dumps(home.name) + ',base);'
                 'page.search=location.search;page.hash=location.hash;location.replace(page.href)};'
                 'const sibling=new URL(' + json.dumps(sibling) + ',location.href);'
                 'if(sibling.href===document.baseURI){openPage(sibling)}else{'
                 'const icon=new Image();icon.onload=()=>openPage(sibling);'
                 'icon.onerror=()=>openPage(document.baseURI);'
                 'icon.src=new URL("assets/favicon-32.png",sibling).href}}</script>')
    # A regular link remains usable in previewers that suppress local navigation.
    direct = '<a class="open-edition" href="' + escape(address) + '">Open the full website on this Mac ↗</a>'
    html = re.sub(r'<head\b[^>]*>',lambda m:m[0]+bootstrap,home.read_text(),count=1,flags=re.I)
    html = re.sub(r'<main\b[^>]*>',lambda m:m[0]+direct,html,count=1,flags=re.I)
    html = html.replace('</head>','<style>.open-edition{display:block;padding:12px var(--rail,20px);background:#f4f5f1;text-align:center;font:600 15px/1.4 var(--face,sans-serif);color:#192126}</style></head>',1)
    write(destination,html)

def local_page(rel, html, modules, output, localize):
    used=set()
    def script(m):
        attrs={a.group(1).lower():a.group(3) for a in ATTR.finditer(m[1])}
        kind=attrs.get('type','').lower()
        src=attrs.get('src','').split('?')[0]
        if kind=='importmap':return ''
        if src:
            if src not in modules:return m[0]
            if kind=='module':
                used.add(src)
                return '<script type="module">import "fm:'+src+'";</script>'
            code,deps=modules[src];used.update(deps)
            output(src,code)
            return '<script src="'+src+'"></script>'
        if kind=='module':
            code,deps=converted(rel,m[2]);used.update(deps)
            return '<script type="module">'+code+'</script>'
        return m[0]
    html=SCRIPT.sub(script,html)
    def attr(m):
        name,quote,value=m.groups()
        if name in ('href','src','poster','data-preview-download','data-preview-file','data-document-url'):
            return name+'='+quote+localize(value)+quote
        if name=='srcset':
            return name+'='+quote+re.sub(r'https?://[^,\s]+',lambda u:localize(u[0]),value)+quote
        return m[0]
    # Limit HTML rewriting to attributes on tags, not JS source or content.
    def rewrite_tag(match):
        tag = match[1]
        online_only = html_attrs(tag).get('data-online-only') == 'true'
        return '<' + ATTR.sub(lambda field: field[0] if online_only and field[1] == 'href' else attr(field), tag) + '>'
    html=re.sub(r'<(?!script\b)([A-Za-z][^>]*?)>',rewrite_tag,html)
    graph = module_script(rel, used, modules, output)
    runtime='<script src="_local/files.js"></script><script src="_local/runtime.js"></script>'+graph
    html=re.sub(r'<head\b[^>]*>',lambda m:m[0]+runtime,html,count=1,flags=re.I)
    return html

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination',type=Path)
    parser.add_argument('--assets',type=Path,help='JSON containing routes and extraFiles')
    parser.add_argument('--mac-entry',type=Path,help='Also write a named HTML file that opens this installed edition from Downloads')
    parser.add_argument('--mac-buildings-entry',type=Path,help='Also write a Mac opener for the Buildings directory')
    args=parser.parse_args()
    target=args.destination.resolve()
    if target==SOURCE or SOURCE in target.parents: raise ValueError("Use a separate destination.")
    extra=json.loads(args.assets.read_text()) if args.assets else {}
    routes=extra.get('routes',{})
    current_atlas = re.search(r'href="(downloads/edition-\d{8}/Mississauga-Atlas\.pdf)"',
                              (SOURCE/'downloads.html').read_text())
    if not current_atlas or not (SOURCE/current_atlas[1]).is_file():
        raise ValueError('The Downloads page must identify the current atlas file')
    # Renderers atomically replace these working files while new plates finish.
    # Only the committed filename belongs in a portable edition.
    source_files = {
        str(f.relative_to(SOURCE)): f for f in SOURCE.rglob('*')
        if f.is_file() and f.name != '.DS_Store'
        and not f.name.endswith(('.tmp', '.part', '.partial', '.copying', '.rebuilding', '.restore-part'))
    }
    for rel,source in extra.get('extraFiles',{}).items():
        if Path(rel).is_absolute() or '..' in Path(rel).parts:raise ValueError(rel)
        if rel not in source_files:source_files[rel]=Path(source)
    # These reviewed standalone models are Git-pinned assets outside public/.
    previews=json.loads((SOURCE/'data/model-previews.json').read_text())
    for asset in previews['assets']:
        url=asset['url']
        if not url.startswith('https://raw.githubusercontent.com/'):continue
        match=re.fullmatch(r'https://raw\.githubusercontent\.com/itsdanielsultan/future-mississauga/[a-f0-9]{40}/(model-assets/\d{8}/[a-z0-9-]+\.glb\.gz)',url)
        if not match:raise ValueError(f'Unknown model URL: {url}')
        source=ROOT/match[1]
        if hashlib.sha256(source.read_bytes()).hexdigest()!=asset['downloadSHA256']:raise ValueError(f'Model digest mismatch: {source}')
        rel='models/offline/'+source.name
        source_files[rel]=source
        routes[url]=rel
    for url,rel in routes.items():
        if rel not in source_files:raise ValueError(f'Missing local asset {rel} ({url})')
    inventory=target/'_local/inventory.json'
    previous=json.loads(inventory.read_text()) if inventory.exists() else {}
    if isinstance(previous,list):previous={'files':previous}
    old_sources=previous.get('sources',{})
    copied={}
    generated=set()
    def output(rel,data):
        generated.add(rel);write(target/rel,data)
    def localize(s):
        if s=='./' or s.startswith('./#'):return 'index.html'+s[2:]
        u=urlsplit(s)
        if (not u.query and u.path.removeprefix('./').lstrip('/') == 'downloads/Future-Mississauga-Atlas.pdf'
                and (not u.scheme and not u.netloc or u.hostname in ('futuremississauga.com','www.futuremississauga.com','futuremississauga.ca'))):
            return current_atlas[1]+('#'+u.fragment if u.fragment else '')
        if u.scheme not in ('https','http'):return s
        remote=u.scheme+'://'+u.netloc+u.path
        rel=routes.get(remote)
        if not rel and u.hostname in ('futuremississauga.com','www.futuremississauga.com','futuremississauga.ca'):
            fallback=unquote(u.path.lstrip('/')) or 'index.html'
            if fallback in source_files:rel=fallback
        if not rel:return s
        return rel+('?' + u.query if u.query else '')+('#'+u.fragment if u.fragment else '')
    transport={}
    for rel, source in source_files.items():
        ext=source.suffix.lower()
        if ext in ('.js','.mjs','.html','.css'):continue
        copied[rel]=copy(source,target/rel,old_sources.get(rel));generated.add(rel)
        if (rel.startswith(('data/','models/')) and ext in MIMES) or rel.startswith('document-page-text-') and ext=='.txt':
            uri='_local/bytes/'+rel+'.js'
            dest=target/uri;generated.add(uri)
            transport[rel]=[MIMES[ext],source.stat().st_size]
            if dest.exists() and dest.stat().st_mtime_ns>=source.stat().st_mtime_ns:continue
            data=source.read_bytes()
            packed=ext!='.gz'
            payload=gzip.compress(data,compresslevel=1,mtime=0) if packed else data
            output(uri,'fmLocal.receive('+json.dumps(rel)+',"'+base64.b64encode(payload).decode('ascii')+'",'+str(packed).lower()+');')
    for rel,source in source_files.items():
        if source.suffix!='.css':continue
        css=source.read_text()
        def font(m):
            value=m[1].strip("'\x22")
            asset=(source.parent/value.split('?')[0]).resolve()
            if asset.is_file() and asset.suffix in ('.woff2','.ttf'):
                mime='font/woff2' if asset.suffix=='.woff2' else 'font/ttf'
                return 'url(data:'+mime+';base64,'+base64.b64encode(asset.read_bytes()).decode('ascii')+')'
            return m[0]
        output(rel,re.sub(r'url\(([^)]+)\)',font,css))
    modules={}
    for rel,source in source_files.items():
        if source.suffix in ('.js','.mjs'):modules[rel]=converted(rel,source.read_text())
    for rel,source in source_files.items():
        if source.suffix!='.html':continue
        html=local_page(rel,source.read_text(),modules,output,localize)
        output(rel,page_presentation(html,target))
    output('_local/runtime.js',(ROOT/'scripts/local-edition-runtime.js').read_text())
    output('_local/files.js','window.fmEditionFiles='+json.dumps({'files':sorted(source_files),'routes':routes,'transport':transport,'currentAtlas':current_atlas[1]},separators=(',',':'))+';')
    for old in set(previous.get('files',[]))-generated:
        if not Path(old).is_absolute() and '..' not in Path(old).parts and (target/old).is_file():(target/old).unlink()
    write(inventory,json.dumps({'files':sorted(generated),'sources':copied},separators=(',',':')))
    for location, page in [(args.mac_entry,'index.html'),(args.mac_buildings_entry,'model.html')]:
        if not location:
            continue
        entry = location.resolve()
        if entry == target or target in entry.parents or SOURCE in entry.parents:
            raise ValueError("Keep the Mac entry outside the edition and public source.")
        write_mac_entry(entry,target/page)
    print(f'{sum(p.endswith(".html") for p in generated)} HTML pages, {len(transport)} local data/model files, {len(routes)} offline routes in {target}',flush=True)
if __name__=='__main__':main()
