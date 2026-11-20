import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {dirname, resolve, join, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadLocalAssetMap} from './local-asset-map.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
function option(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; }
const base = resolve(root, option('--site', 'public'));
const port = Number(option('--port', '4173'));
const prefix = option('--base', '/').replace(/\/?$/, '/');
const mapPaths=process.argv.flatMap((value,index)=>value==='--asset-map'?[process.argv[index+1]]:[]);
const localAssets=new Map();
for(const mapPath of mapPaths)for(const [url,asset] of await loadLocalAssetMap(mapPath)){if(localAssets.has(url))throw Error('Duplicate staged asset URL.');localAssets.set(url,asset);}
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8'};
function sendFile(request, response, file, size) {
  const headers = {'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'};
  let start = 0, end = size - 1;
  const range = request.method === 'GET' && request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
    } else start = size;
    if (!Number.isSafeInteger(start) || start > end) {
      response.writeHead(416, {'Content-Range': 'bytes */' + size, 'Accept-Ranges': 'bytes'});
      response.end(); return;
    }
    headers['Content-Length'] = end - start + 1;
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  }
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD' || size === 0) response.end();
  else createReadStream(file, {start, end}).on('error', error => response.destroy(error)).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
    const mapped=localAssets.get(path.slice(prefix.length));
    if(mapped){
      sendFile(request, response, mapped.path, mapped.bytes);
      return;
    }
    let file = resolve(base, path.slice(prefix.length) || 'index.html');
    if (file !== base && !file.startsWith(base + sep)) { response.writeHead(403); response.end(); return; }
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    sendFile(request, response, file, info.size);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  console.log('Static preview: ' + url);
  if (process.argv.includes('--open') && process.platform === 'darwin') {
    const browser = spawn('open', [url], {stdio: 'ignore'});
    browser.on('error', () => console.log('Open the preview URL above.'));
  }
});
