import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import {
  createDocumentPreviewIndex,
  documentPageURL,
  documentPreviewKey,
  isDocumentPreviewCandidate,
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
