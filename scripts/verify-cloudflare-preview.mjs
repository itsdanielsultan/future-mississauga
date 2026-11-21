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
const args = new Set(process.argv.slice(2));
const versionOption = [...args].find(value=>value.startsWith('--version-url='));
if (versionOption) args.delete(versionOption);
for (const value of args) assert(['--staged', '--full', '--live'].includes(value), 'Unknown argument: ' + value);
const offline = args.has('--staged');
assert([offline,args.has('--live'),!!versionOption].filter(Boolean).length <= 1, 'Select one verification target');
let preview = args.has('--live') ? 'https://futuremississauga.com' : 'https://future-mississauga-preview.thedanielsultan.workers.dev';
if (versionOption) {
  const version = new URL(versionOption.slice('--version-url='.length));
  assert(version.protocol==='https:' && /^[a-z0-9-]+-future-mississauga-preview\.thedanielsultan\.workers\.dev$/.test(version.hostname)
    && !version.username && !version.password && !version.port && version.pathname==='/' && !version.search && !version.hash, 'Expected this project’s Cloudflare version address');
  preview = version.origin;
}
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
        const range=req.headers.get('Range')?.match(/^bytes=(\d+)-(\d+)$/);
        if(range){
          const start=Number(range[1]),end=Number(range[2]);
          assert(start>=0&&end>=start&&end<file.size);
          return new Response(Readable.toWeb(createReadStream(local,{start,end})),{status:206,headers:{'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${file.size}`}});
        }
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
async function request(path, options, query = '') {
  const url = new URL(encodePath(path), preview);
  url.search = query;
  for (let attempt = 0; ; attempt++) {
    let wait = 1 + attempt;
    try {
      const response = await fetcher(new Request(url, {
        redirect:'manual', signal:AbortSignal.timeout(120000), ...options
      }));
      if (offline || attempt >= 2 || ![429,502,503,504].includes(response.status)) return response;
      const retryAfter = Number(response.headers.get('Retry-After'));
      if (retryAfter > 0) wait = Math.min(retryAfter,60);
      await response.body?.cancel();
    } catch (error) {
      if (offline || attempt >= 2) throw new Error('Could not fetch ' + path,{cause:error});
    }
    await new Promise(done => setTimeout(done, wait * 1000));
  }
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
assert.equal(new Set(Object.values(routes).map(entry => entry.key)).size, inventory.mediaObjects ?? inventory.r2Objects);
// Archived aliases can point at a newer file. The digest address stays stable.
const publishedIndex = await readFile(join(release,'published-media.json'),'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
if (publishedIndex) {
  const published = Object.values(JSON.parse(publishedIndex));
  await each(published,async entry => {
    const res = await request('/media/sha256/' + entry.key,{method:'HEAD'});
    assert.equal(res.status,200,'Immutable public file ' + entry.key);
    assert.equal(res.headers.get('ETag'),'"'+entry.key+'"');
    assert.equal(Number(res.headers.get('Content-Length')),entry.bytes);
    assert.match(res.headers.get('Cache-Control') || '',/immutable/);
    // Verify bytes through the live route as well, including superseded objects.
    if (!offline && !Object.values(routes).some(file => file.key === entry.key)) {
      const prefix = await request('/media/sha256/'+entry.key,{headers:{Range:'bytes=0-0'}});
      assert.equal(prefix.status,206);
      assert.equal((await prefix.arrayBuffer()).byteLength,1);
      if (full) {
        const body = await request('/media/sha256/'+entry.key);
        assert.equal(await digest(body.body),entry.key);
      }
    }
  });
}
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
