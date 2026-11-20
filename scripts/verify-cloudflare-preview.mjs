import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';

const preview = 'https://future-mississauga-preview.thedanielsultan.workers.dev/';
const root = resolve(process.argv[2] || 'public');

async function request(path, options = {}) {
  return fetch(new URL(path, preview), {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(120000)
  });
}

async function digest(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function checkFile(path, {checkRanges = false} = {}) {
  const source = resolve(root, path);
  const info = await stat(source);
  const head = await request(path, {method: 'HEAD'});
  assert.equal(head.status, 200, path + ' HEAD');
  assert.doesNotMatch(head.headers.get('content-type') || '', /text\/html/i, path + ' served HTML');
  const ranged = checkRanges && info.size > 25 * 1024 * 1024;
  if (ranged) {
    const sample = await request(path, {headers: {Range: 'bytes=0-15'}});
    assert.equal(sample.status, 206, path + ' range');
    assert.equal(sample.headers.get('content-range'), 'bytes 0-15/' + info.size, path);
    const bytes = Buffer.from(await sample.arrayBuffer());
    const [prefix] = await Array.fromAsync(createReadStream(source, {start: 0, end: 15}));
    assert.deepEqual(bytes, prefix, path + ' prefix');
    const invalid = await request(path, {headers: {Range: 'bytes=' + info.size + '-'}});
    assert.equal(invalid.status, 416, path + ' invalid range');
    await invalid.body?.cancel();
  }
  const body = await request(path);
  assert.equal(body.status, 200, path + ' GET');
  const actual = await digest(Readable.fromWeb(body.body));
  const expected = await digest(createReadStream(source));
  assert.equal(actual, expected, path + ' SHA-256');
  console.log('Verified ' + path);
}

async function checkPage(path, required) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') || '', /text\/html/i, path);
  const html = await response.text();
  for (const fragment of required) assert.ok(html.includes(fragment), path + ' missing ' + fragment);
  return html;
}

const home = await checkPage('/', ['data-plate-state="existing"', 'data-plate-state="future"', 'id="heroImage"']);
await checkPage('/index.html', ['id="heroImage"']);
await checkPage('/neighbourhoods.html', ['place-port-credit.html', 'place-downtown.html']);
await checkPage('/place-port-credit.html', ['building-port-credit-lighthouse.html?from=port-credit']);
await checkPage('/building-port-credit-lighthouse.html?from=port-credit', ['data-neighbourhood-return']);
await checkPage('/explore.html?district=port-credit', ['type="importmap"', 'three/addons/']);
await checkPage('/downloads.html', ['Mississauga-Atlas.pdf']);
await checkFile('atlas-home-print.css');
await checkFile('home-compare.js');

const localHome = await readFile(resolve(root, 'index.html'), 'utf8');
function scenarioTag(html, state) {
  return (html.match(/<button\b[^>]*>/gi) || []).find(tag => tag.includes('data-plate-state="' + state + '"'));
}
const editions = new Set();
for (const state of ['existing', 'future']) {
  const switchTag = scenarioTag(home, state);
  const expectedTag = scenarioTag(localHome, state);
  assert.ok(expectedTag, 'Reviewed homepage missing ' + state);
  assert.ok(switchTag, 'Missing homepage control for ' + state);
  for (const field of ['small', 'large', 'original', 'print']) {
    const attribute = new RegExp('data-' + field + '="([^"]+)"');
    const match = attribute.exec(switchTag);
    assert.ok(match, 'Missing ' + field + ' for ' + state);
    const path = match[1];
    assert.equal(path, attribute.exec(expectedTag)?.[1], 'Published artwork differs from the reviewed ' + state + ' ' + field);
    assert.match(path, /^(?:gallery|downloads)\/edition-20261120\/[A-Za-z0-9._-]+$/, 'Unexpected artwork path');
    assert.ok(!editions.has(path), 'Duplicate scenario asset: ' + path);
    editions.add(path);
    await checkFile(path, {checkRanges: true});
  }
}
await checkFile('models/citywide.glb', {checkRanges: true});
await checkFile('models/aldo-1422-study.glb', {checkRanges: true});
await checkFile('downloads/edition-20261120/Mississauga-Atlas.pdf', {checkRanges: true});
await checkFile('downloads/Downtown-Mississauga-print.pdf', {checkRanges: true});
const missing = await request('downloads/no-such-future-mississauga-file-20261120.pdf');
assert.equal(missing.status, 404, 'A nonexistent download must return 404');
await missing.body?.cancel();

console.log('Cloudflare preview serves the reviewed site and files.');
