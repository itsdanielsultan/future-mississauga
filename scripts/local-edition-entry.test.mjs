import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

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
  const location = {protocol:'file:',search:'?scenario=existing',hash:'#skyline',replace(url){this.destination=url;}};
  vm.runInNewContext(script,{URL,document,location});
  const opened = new URL(location.destination);
  assert.equal(fileURLToPath(opened),home);
  assert.equal(opened.search+opened.hash,'?scenario=existing#skyline');
  location.destination=null; location.protocol='https:';
  vm.runInNewContext(script,{URL,document,location});
  assert.equal(location.destination,null);
  assert.doesNotMatch(await readFile(home,'utf8'),/<base|open-installed-edition/);
});
