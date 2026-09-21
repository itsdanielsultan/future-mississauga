import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {dirname, resolve, join, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
function option(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; }
const base = resolve(root, option('--site', 'public'));
const port = Number(option('--port', '4173'));
const prefix = option('--base', '/').replace(/\/?$/, '/');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8'};
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
    let file = resolve(base, path.slice(prefix.length) || 'index.html');
    if (file !== base && !file.startsWith(base + sep)) { response.writeHead(403); response.end(); return; }
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    response.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache'});
    // .json.gz is intentionally served as a binary gzip file. The browser app
    // uses DecompressionStream itself; an HTTP Content-Encoding would decode it twice.
    if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Static preview: http://127.0.0.1:${port}${prefix}`));
