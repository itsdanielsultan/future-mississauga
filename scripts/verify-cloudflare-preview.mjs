import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {open, readFile, readdir, stat} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {legacyAtlasPath} from '../cloudflare/media-worker.mjs';

const release = join(dirname(dirname(fileURLToPath(import.meta.url))), '.cloudflare-release');
const staticRoot = join(release, 'assets');
const preview = 'https://future-mississauga-preview.thedanielsultan.workers.dev';
const args = new Set(process.argv.slice(2));
for (const value of args) assert(['--staged', '--full'].includes(value), 'Unknown argument: ' + value);
const offline = args.has('--staged');
const full = args.has('--full');
const routes = JSON.parse(await readFile(join(release, 'media-routes.json')));
const inventory = JSON.parse(await readFile(join(release, 'inventory.json')));
const blobPath = key => join(release, 'media', key);
const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

async function digest(stream) {
  const hash = createHash('sha256');
  for await (const bytes of stream) hash.update(bytes);
  return hash.digest('hex');
}
async function sample(path, size) {
  const file = await open(path);
  try {
    const prefix = Buffer.alloc(Math.min(size, 16));
    const {bytesRead} = await file.read(prefix, 0, prefix.length, 0);
    assert.equal(bytesRead, prefix.length, path);
    return prefix;
  } finally {
    await file.close();
  }
}
// Use precisely the generated Worker and the generated release when remote
// deployment is still pending. The live mode below uses only public HTTPS.
async function localFetcher() {
  const {default: worker} = await import(pathToFileURL(join(release, 'worker.mjs')));
  const env = {
    ASSETS: {
      async fetch(req) {
        const name = decodeURIComponent(new URL(req.url).pathname);
        const local = join(staticRoot, name);
        const file = await stat(local).catch(() => null);
        if (!file?.isFile()) return new Response(null, {status:404});
        const body = req.method === 'HEAD' ? null : Readable.toWeb(createReadStream(local));
        return new Response(body, {headers:{'Content-Length':String(file.size)}});
      }
    },
    MEDIA: {
      async get(key, options) {
        const file = blobPath(key);
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) return null;
        const range = options?.range;
        const stream = createReadStream(file, range && {start:range.offset, end:range.offset + range.length - 1});
        return {body:Readable.toWeb(stream), size:info.size};
      }
    }
  };
  return req => worker.fetch(req, env);
}
const fetcher = offline ? await localFetcher() : fetch;
function request(path, options, query = '') {
  const url = new URL(encodePath(path), preview);
  url.search = query;
  return fetcher(new Request(url, {
    redirect:'manual', signal:AbortSignal.timeout(120000), ...options
  }));
}
async function each(items, fn) {
  const queue = items.values();
  await Promise.all(Array.from({length:4}, async () => {
    for (const item of queue) await fn(item);
  }));
}
async function list(relative = '') {
  const result = [];
  for (const d of await readdir(join(staticRoot, relative), {withFileTypes:true})) {
    const path = join(relative, d.name);
    if (d.isDirectory()) result.push(...await list(path));
    else if (d.isFile()) result.push(path);
  }
  return result;
}
const paths = await list();
assert.equal(paths.length, inventory.staticFiles);
const htmlPages = paths.filter(path => path.endsWith('.html'));
await each(paths, async path => {
  const html = path.endsWith('.html');
  const response = await request('/' + path, {method:html || full ? 'GET' : 'HEAD'});
  assert.equal(response.status, 200, path);
  if (html || full) {
    assert.equal(await digest(response.body), await digest(createReadStream(join(staticRoot, path))), path);
  }
});
const homepage = await request('/');
assert.equal(homepage.status, 200);
assert.equal(await digest(homepage.body), await digest(createReadStream(join(staticRoot, 'index.html'))));
await each(Object.entries(routes), async ([path, file]) => {
  const query = path === legacyAtlasPath ? 'edition=c9f219e7094e834a' : '';
  const info = await stat(blobPath(file.key));
  assert.equal(info.size, file.bytes, path);
  assert.equal(await digest(createReadStream(blobPath(file.key))), file.key, path + ' staged media identity');
  const head = await request(path, {method:'HEAD'}, query);
  assert.equal(head.status, 200, path);
  assert.equal(Number(head.headers.get('content-length')), file.bytes, path);
  assert.equal(head.headers.get('content-type'), file.type, path);
  const end = Math.min(file.bytes, 16) - 1;
  const prefix = await request(path, {headers:{Range:'bytes=0-' + end}}, query);
  assert.equal(prefix.status, 206, path + ' range request');
  assert.equal(prefix.headers.get('content-range'), 'bytes 0-' + end + '/' + file.bytes, path);
  assert.deepEqual(Buffer.from(await prefix.arrayBuffer()), await sample(blobPath(file.key), file.bytes), path);
  if (full) {
    const whole = await request(path, {}, query);
    assert.equal(whole.status, 200, path);
    assert.equal(await digest(whole.body), file.key, path + ' full download');
  }
});
assert.equal(new Set(Object.values(routes).map(entry => entry.key)).size, inventory.r2Objects);
const latestAtlas = await request(legacyAtlasPath, {method:'HEAD'});
assert.equal(latestAtlas.status, 307);
assert.equal(new URL(latestAtlas.headers.get('location'), preview).pathname, inventory.currentAtlas);
const missing = await request('/downloads/no-such-future-mississauga-document.pdf');
assert.equal(missing.status, 404);
console.log(JSON.stringify({
  target:offline ? 'local release package' : preview, fullFileDownloads:full,
  staticFiles:paths.length, pagesWithExactBytes:htmlPages.length, mediaPaths:Object.keys(routes).length,
  distinctMediaObjects:inventory.r2Objects, mediaBytes:inventory.r2Bytes, missingFileStatus:missing.status
}, null, 2));
