import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

test('the portable atlas bookmark opens the current print and preserves the original edition link', async () => {
  const original = 'downloads/Future-Mississauga-Atlas.pdf';
  const current = 'downloads/edition-20261121/Mississauga-Atlas.pdf';
  const base = 'file:///City%20atlas/';
  const window = {fmEditionFiles:{files:[original,current],routes:{},currentAtlas:current}};
  const Element = class {};
  const script = await readFile(new URL('local-edition-runtime.js',import.meta.url),'utf8');
  vm.runInNewContext(script, {
    URL, fetch, window, document:{baseURI:base+'downloads.html'}, Element,
    HTMLImageElement:Element, HTMLSourceElement:Element, HTMLMediaElement:Element,
    HTMLVideoElement:Element, HTMLAnchorElement:Element,
    MutationObserver:class {observe() {}}
  });
  const localize = window.fmLocal.localize;
  for (const url of [original,base+original,'https://futuremississauga.com/'+original]) {
    assert.equal(new URL(localize(url+'#page=4'),base).href,base+current+'#page=4');
    assert.equal(new URL(localize(url+'?edition=original#page=3'),base).href,base+original+'?edition=original#page=3');
  }
  assert.equal(localize('https://example.com/'+original),'https://example.com/'+original);
});

test('a downloaded HTML keeps its styles and aerial, and opens the installed site on this Mac', async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'atlas-entry-'));
  t.after(() => rm(folder, {recursive:true, force:true}));
  const installed = path.join(folder, 'Site & models');
  const downloads = path.join(folder, 'Downloads');
  await Promise.all([mkdir(installed), mkdir(downloads)]);
  await mkdir(path.join(installed,'fonts'));
  const baseCSS = "@font-face {font-family:Atlas;src:url('./face.woff2')}";
  await writeFile(path.join(installed,'fonts','type.css'), baseCSS);
  await writeFile(path.join(installed,'fonts','face.woff2'),Buffer.from('test-font'));
  await writeFile(path.join(installed,'layout.css'),"@import url('fonts/type.css'); .hero{display:grid}");
  await writeFile(path.join(installed,'night.css'),'.hero{color:white}');
  await writeFile(path.join(installed,'aerial.avif'),Buffer.from('test-scene'));
  const html = '<html><head><link rel="stylesheet" href="layout.css?v=9"><link rel="stylesheet" media="screen" href="night.css"></head><body><main id="main"><img id="heroImage" src="aerial.avif" srcset="separate.avif 2x"></main></body></html>';
  const home = path.join(installed,'index.html');
  const downloaded = path.join(downloads,'Future-Mississauga (2).html');
  await writeFile(home,html);
  const exporter = fileURLToPath(new URL('export-local-edition.py',import.meta.url));
  execFileSync('python3',['-c',[
    'import runpy, sys',
    'from pathlib import Path',
    'module = runpy.run_path(sys.argv[1])',
    'home, downloaded = map(Path, sys.argv[2:])',
    "home.write_text(module['page_presentation'](home.read_text(),home.parent))",
    "module['write_mac_entry'](downloaded,home)"
  ].join('\n'),exporter,home,downloaded]);
  const text = await readFile(downloaded,'utf8');
  assert.doesNotMatch(text,/rel="stylesheet"|@import|srcset=/);
  assert.match(text,/data:font\/woff2;base64,dGVzdC1mb250/);
  assert.match(text,/id="heroImage" src="data:image\/avif;base64,dGVzdC1zY2VuZQ=="/);
  assert.ok(text.indexOf('.hero{display:grid}') < text.indexOf('.hero{color:white}'));
  assert.match(text,/<style data-sheet="night.css" media="screen">/);
  const document = {baseURI:text.match(/<base href="([^"]+)"/)[1].replaceAll('&amp;', '&')};
  const script = text.match(/<script id="open-installed-edition">([^<]+)<\/script>/)[1];
  const location = {href:pathToFileURL(downloaded).href,protocol:'file:',search:'?scenario=existing',hash:'#skyline',replace(url){this.destination=url;}};
  vm.runInNewContext(script,{URL,document,location,Image:class {set src(value){this.onerror()}}});
  const opened = new URL(location.destination);
  assert.equal(fileURLToPath(opened),home);
  assert.equal(opened.search+opened.hash,'?scenario=existing#skyline');
  vm.runInNewContext(script,{URL,document,location,Image:class {set src(value){this.onload()}}});
  assert.equal(fileURLToPath(location.destination),path.join(downloads,'Site & models','index.html'));
  location.destination=null; location.protocol='https:';
  vm.runInNewContext(script,{URL,document,location});
  assert.equal(location.destination,null);
  assert.doesNotMatch(await readFile(home,'utf8'),/<base|open-installed-edition/);
});
