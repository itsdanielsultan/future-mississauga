import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../public/', import.meta.url);
const html = readFileSync(new URL('downloads.html', root), 'utf8');
const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
const {documents} = JSON.parse(readFileSync(new URL('data/document-previews-20261120.json', root)));
const links = [...main.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);

function matchingLinks(url) {
  return links.filter(link => link.includes('href="' + url + '"'));
}

test('Downloads links every archived atlas to its own reader and original PDF', () => {
  const archives = documents.filter(doc => doc.url.startsWith('downloads/Future-Mississauga-Atlas'));
  assert.ok(archives.length >= 4);
  for (const {url} of archives) {
    const actions = matchingLinks(url);
    assert.equal(actions.filter(a => a.includes('data-document-preview')).length, 1, url);
    assert.equal(actions.filter(a => a.includes(' download data-download')).length, 1, url);
  }
  assert.equal(matchingLinks('downloads/Future-Mississauga-Atlas.pdf').length, 0);
});

test('download categories, thumbnails and signed prints have real destinations', () => {
  for (const {1:id} of main.matchAll(/href="#([^"]+)"/g)) assert.ok(main.includes('id="' + id + '"'), id);
  for (const {1:path} of main.matchAll(/(?:href|src)="(?!#)([^"]+)"/g)) {
    const file = new URL(path, root);
    assert.ok(statSync(file).isFile(), path);
  }
  for (const scenario of ['existing','future']) {
    const signed = 'gallery/edition-20261120/originals/home-downtown-' + scenario + '-print.png';
    assert.ok(main.includes('data-preview-download="' + signed + '"'));
    assert.ok(matchingLinks(signed).some(a => a.includes(' download data-download')));
    assert.ok(matchingLinks('downloads/edition-20261120/Downtown-' + scenario + '-print.pdf').some(a => a.includes(' download data-download')));
  }
});
