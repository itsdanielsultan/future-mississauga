import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import test from 'node:test';
import {
  createDocumentPreviewIndex,
  documentPageURL,
  documentPreviewKey,
  isDocumentPreviewCandidate,
  requestedDocumentPage,
} from '../public/document-preview.js';

const site = 'https://futuremississauga.com/sources.html';
const catalog = JSON.parse(await readFile(new URL('../public/data/document-previews.json', import.meta.url)));
const text = JSON.parse(gunzipSync(Buffer.from(
  await readFile(new URL('../public/document-page-text.txt', import.meta.url), 'utf8'), 'base64')));
const historical = catalog.documents.find(doc =>
  new URL(doc.url, site).pathname === '/downloads/Future-Mississauga-Atlas.pdf');
const newAtlas = {
  ...historical,
  url: 'downloads/Future-Mississauga-Atlas-20261028-012345abcdef.pdf',
  base: 'https://example.test/document-previews-20261028/',
  prefix: 'future-mississauga-atlas-012345abcdef-',
};

test('existing PDF paths keep their page images and corresponding accessible text', () => {
  const index = createDocumentPreviewIndex(catalog, site);
  for (const [position, doc] of catalog.documents.entries()) {
    const entry = index.get(documentPreviewKey(doc.url, site));
    assert.equal(entry.d, doc);
    assert.equal(entry.i, position);
    assert.equal(text[entry.i].length, doc.pages);
    for (let page = 1; page <= doc.pages; page++) {
      assert.equal(documentPageURL(catalog, entry.d, page, site),
        catalog.base + doc.prefix + String(page).padStart(2, '0') + '.avif');
      assert.ok(text[entry.i][page - 1].trim());
    }
  }
});

test('a versioned Atlas gets its own pages and appended text without rebinding the old PDF', () => {
  const extended = {...catalog, documents: [...catalog.documents, newAtlas]};
  const freshText = Array.from({length: newAtlas.pages}, (_, page) => `New Atlas page ${page + 1}`);
  const extendedText = [...text, freshText];
  const index = createDocumentPreviewIndex(extended, site);
  const old = index.get(documentPreviewKey('downloads/Future-Mississauga-Atlas.pdf?edition=012345abcdef', site));
  const current = index.get(documentPreviewKey(newAtlas.url + '?edition=012345abcdef#page=2', site));
  assert.equal(old.d, historical);
  assert.equal(current.d, newAtlas);
  assert.notEqual(old.i, current.i);
  assert.deepEqual(extendedText[old.i], text[catalog.documents.indexOf(historical)]);
  assert.deepEqual(extendedText[current.i], freshText);
  assert.equal(documentPageURL(extended, current.d, 2, site),
    'https://example.test/document-previews-20261028/future-mississauga-atlas-012345abcdef-02.avif');
  assert.equal(documentPageURL(extended, old.d, 2, site),
    catalog.base + historical.prefix + '02.avif');
  assert.equal(index.get(documentPreviewKey('https://unrelated.test/' + newAtlas.url, site)), undefined);
});

test('query-only editions cannot overwrite an existing document binding', () => {
  const conflicting = {...newAtlas, url: 'downloads/Future-Mississauga-Atlas.pdf?edition=012345abcdef'};
  assert.throws(() => createDocumentPreviewIndex({
    ...catalog, documents: [...catalog.documents, conflicting],
  }, site), /distinct PDF pathname/);
});

test('document base is optional and can resolve from the site without changing the global base', () => {
  assert.equal(documentPageURL(catalog, {...newAtlas, base: undefined}, 1, site),
    catalog.base + newAtlas.prefix + '01.avif');
  assert.equal(documentPageURL(catalog, {...newAtlas, base: 'assets/atlas-pages/'}, 1, site),
    'https://futuremississauga.com/assets/atlas-pages/' + newAtlas.prefix + '01.avif');
  for (const page of [0, -1, 1.5, newAtlas.pages + 1]) {
    assert.throws(() => documentPageURL(catalog, newAtlas, page, site), RangeError);
  }
});

test('first click recognizes a versioned Atlas before its catalogue has loaded', () => {
  assert.equal(isDocumentPreviewCandidate(newAtlas.url, site), true);
  assert.equal(isDocumentPreviewCandidate(historical.url, site), true);
  assert.equal(isDocumentPreviewCandidate(catalog.documents[0].url, site), true);
  for (const url of [
    'https://unrelated.test/' + newAtlas.url,
    newAtlas.url + '.backup',
    'downloads/Future-Mississauga-Atlas-not-a-reviewed-edition.pdf',
    'downloads/unregistered.pdf',
  ]) assert.equal(isDocumentPreviewCandidate(url, site), false);
});

test('registered documents match exact paths after loading without a filename convention', () => {
  const custom = {...newAtlas, url: 'downloads/reviewed-edition.pdf'};
  const index = createDocumentPreviewIndex({documents: [custom]}, site);
  assert.equal(isDocumentPreviewCandidate(custom.url + '?cache=1', site, index), true);
  assert.equal(isDocumentPreviewCandidate('downloads/reviewed-edition-old.pdf', site, index), false);
});


test('a place opens its exact numbered atlas page and malformed page fragments fall back to the cover', () => {
  assert.equal(requestedDocumentPage(site + '#page=17', 63), 17);
  for (const suffix of ['', '#page=0', '#page=-1', '#page=64', '#page=1.5', '#page=x']) {
    assert.equal(requestedDocumentPage(site + suffix, 63), 1);
  }
});

test('an explicit page stays selected when several final sheets fit in the same phone viewport', async () => {
  const source = await readFile(new URL('../public/document-preview.js', import.meta.url),'utf8');
  const handler = name => source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'))[0];
  const stage = {
    clientHeight: 540, scrollHeight: 196 * 56,
    get scrollTop() {return this.offset ?? 0;},
    set scrollTop(value) {this.offset = Math.max(0, Math.min(this.scrollHeight-this.clientHeight, value));},
    getBoundingClientRect() {return {top:0};},
  };
  const pages = Array.from({length:56}, (_,index)=>({
    getBoundingClientRect:()=>({top:index*196-stage.scrollTop+12}),
  }));
  const reader = vm.runInNewContext(`(function () {
    let current=1, scrollFrame=0, selectedScrollTop=null;
    ${handler('jump')}
    ${handler('selectVisiblePage')}
    return {jump, selectVisiblePage, get current(){return current;}};
  })()`, {stage, pages, dialog:{open:true}, renderPage(){},syncPage(){}});
  for (const page of [2,56,55,54,1,55]) {
    reader.jump(page);
    reader.selectVisiblePage();
    assert.equal(reader.current,page);
  }
  stage.scrollTop -= 1000;
  reader.selectVisiblePage();
  assert.ok(reader.current < 54);
  stage.scrollTop = stage.scrollHeight;
  reader.selectVisiblePage();
  assert.equal(reader.current,56);
});

test('print-quality reader pages use the same checked edition as their fitted preview', () => {
  const current = {...newAtlas, base: 'document-previews/edition/',
    zoomBase: 'document-previews/edition/zoom/', sourceSHA256: '1234567890abcdef'};
  const fit = new URL(documentPageURL(catalog, current, 2, site));
  const zoom = new URL(documentPageURL(catalog, current, 2, site, true));
  assert.equal(zoom.pathname, fit.pathname.replace('/edition/', '/edition/zoom/'));
  assert.equal(fit.searchParams.get('edition'), '1234567890ab');
  assert.equal(zoom.search, fit.search);
  assert.equal(documentPageURL(catalog, historical, 2, site, true),
    documentPageURL(catalog, historical, 2, site));
});

test('archival readers replace only page images for the same PDF and keep original text positions',()=>{
  const old={url:'downloads/district-202610.pdf?edition=123456789abc',title:'October',pages:2,prefix:'oct-',width:800,pageLinks:{1:[{page:2}]}};
  const sourceSHA256='123456789abc'+'0'.repeat(52);
  const fresh={url:old.url,sourceSHA256,pages:2,prefix:'page-',base:'new/',zoomBase:'new/zoom/',width:1200,height:800,zoomWidth:2880};
  const catalogue={base:'old/',documents:[old]};
  const key=documentPreviewKey(old.url,site);
  const bound=createDocumentPreviewIndex(catalogue,site,{documents:[fresh]}).get(key);
  assert.equal(bound.i,0);assert.equal(bound.d.url,old.url);assert.deepEqual(bound.d.pageLinks,old.pageLinks);
  assert.equal(documentPageURL(catalogue,bound.d,2,site,true),'https://futuremississauga.com/new/zoom/page-02.avif?edition=123456789abc');
  for(const bad of [{...fresh,sourceSHA256:'e'.repeat(64)},{...fresh,pages:3},{...fresh,url:'https://another.example/downloads/district-202610.pdf'}]){
    assert.equal(createDocumentPreviewIndex(catalogue,site,{documents:[bad]}).get(key).d,old);
  }
});
