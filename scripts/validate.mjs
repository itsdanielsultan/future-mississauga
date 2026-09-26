import {readFile, readdir, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve, relative, extname, sep, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const forbidden = /(?:^|\/)(?:\.git|\.openai|node_modules|backups?|scenes|work|raw|source-archive)(?:\/|$)|correspondence|private|\.blend\d*$|(?:^|\/)\.env/i;
const DISTRICT_IDS = ['citywide','downtown','port-credit','lakeview','clarkson','cooksville','uptown','erin-mills','streetsville','meadowvale','malton','dixie-applewood','erindale','airport-corporate','heartland'];
export function validateDistrictMetadata(districts) {
  assert(Array.isArray(districts) && districts.length === 15, 'Expected exactly 15 public district records.');
  assert.deepEqual(districts.map(d => d.id).sort(), [...DISTRICT_IDS].sort(), 'Public district IDs are missing, duplicated or unexpected.');
  const finite = values => values.every(x => typeof x === 'number' && Number.isFinite(x));
  for (const d of districts) {
    assert(Array.isArray(d.bounds) && d.bounds.length === 4 && finite(d.bounds), d.id + ': public bounds must be flat [xmin,zmin,xmax,zmax], never nested 3D mesh bounds.');
    const [xmin,zmin,xmax,zmax] = d.bounds;
    assert(xmin < xmax && zmin < zmax && finite([xmax-xmin,zmax-zmin]), d.id + ': bounds must have finite positive width and depth.');
    assert(Array.isArray(d.center) && d.center.length === 3 && finite(d.center), d.id + ': center must contain three finite coordinates.');
    assert(typeof d.radius === 'number' && Number.isFinite(d.radius) && d.radius > 0, d.id + ': radius must be finite and positive.');
    const [x,y,z] = d.center, r = d.radius;
    assert(x >= xmin && x <= xmax && z >= zmin && z <= zmax, d.id + ': center falls outside its public rectangle.');
    assert(finite([x+r*1.18,y+r*1.35,z+r*1.52,y+65,Math.max(12000,r*4)]), d.id + ': reset camera or shadow calculations are non-finite.');
  }
  // Reproduce the citywide fit used by app.js, for narrow and wide viewports.
  const b = districts.find(d => d.id === 'citywide').bounds;
  const target = [(b[0]+b[2])/2,120,(b[1]+b[3])/2];
  const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
  const normalized = a => {const length=Math.hypot(...a);assert(Number.isFinite(length) && length>0);return a.map(x=>x/length);};
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const direction=normalized([1.18,1.35,1.52]), right=normalized(cross([0,1,0],direction)), up=normalized(cross(direction,right));
  const tan=Math.tan(35*Math.PI/360), cameras=[];
  for (const aspect of [.5,.75,1,16/9,2.4]) {
    let distance=0;
    for (const x of [b[0],b[2]]) for (const z of [b[1],b[3]]) for (const y of [0,450]) {
      const q=[x-target[0],y-target[1],z-target[2]], depth=dot(q,direction);
      distance=Math.max(distance,Math.abs(dot(q,right))/(tan*aspect)+depth,Math.abs(dot(q,up))/tan+depth);
    }
    const position=target.map((x,i)=>x+direction[i]*distance*1.035);
    assert(distance>0 && finite([...target,...position,distance]), 'Citywide fitted camera is non-finite.');
    cameras.push({aspect,distance:distance*1.035,position});
  }
  return {publicDistricts:districts.length,flatBoundsVerified:true,centersAndRadiiVerified:true,citywideFitCameras:cameras};
}
export function validateRefinementBounds(manifest) {
  assert(Array.isArray(manifest.assets), 'Refinement manifest must provide an assets array.');
  for (const [index, asset] of manifest.assets.entries()) {
    const label = asset?.id || `asset ${index}`, bounds = asset?.bounds;
    assert(Array.isArray(bounds) && bounds.length === 2 && bounds.every(row => Array.isArray(row) && row.length === 3 && row.every(value => typeof value === 'number' && Number.isFinite(value))), label + ': refinement bounds must be finite 2x3 [minXYZ,maxXYZ] coordinates. Missing bounds would load the asset in every district.');
    assert(bounds[0].every((value, axis) => value <= bounds[1][axis] && Number.isFinite(bounds[1][axis] - value)), label + ': refinement bounds must be ordered with finite extents on every axis.');
  }
  return {assets: manifest.assets.length, finiteOrderedBoundsVerified: true};
}
async function walk(folder) {
  const result = [];
  for (const entry of await readdir(folder, {withFileTypes: true})) {
    const path = join(folder, entry.name);
    assert(!entry.isSymbolicLink(), 'Published content must not contain symbolic links: ' + path);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
async function sha(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
function localReference(site, names, file, ref, kind) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return false;
  const path = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/\\([() ])/g, '$1');
  if (!path) return false;
  assert(!path.startsWith('/'), 'Root-relative asset fails project-path hosting: ' + ref);
  let resolved = resolve(dirname(file), path);
  assert(resolved.startsWith(site + sep) || resolved === site, 'Link escapes static site: ' + ref);
  if (path.endsWith('/')) resolved = join(resolved, 'index.html');
  assert(names.has(relative(site, resolved).split(sep).join('/')), 'Missing ' + kind + ' dependency: ' + relative(site, file) + ' -> ' + ref);
  return true;
}
function markdownReferences(text) {
  // Ignore code examples; validate inline/image links plus reference definitions.
  text = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, '').replace(/(`+)[\s\S]*?\1/g, '');
  const refs = [];
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*/g)) {
    let i = match.index + match[0].length, value = '', depth = 0;
    if (text[i] === '<') { const end = text.indexOf('>', i + 1); if (end >= 0) refs.push(text.slice(i + 1, end)); continue; }
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '\\' && i + 1 < text.length) { value += c + text[++i]; continue; }
      if (c === '(') depth++;
      if (c === ')') { if (depth === 0) break; depth--; }
      if (/\s/.test(c) && depth === 0) break;
      value += c;
    }
    if (value) refs.push(value);
  }
  for (const m of text.matchAll(/^ {0,3}\[(?!\^)[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm)) refs.push(m[1] || m[2]);
  for (const m of text.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/g)) refs.push(m[1]);
  return refs;
}
export async function validateDocumentLinks(site = join(ROOT, 'public')) {
  site = resolve(site);
  const files = await walk(site), names = new Set(files.map(p => relative(site, p).split(sep).join('/')));
  const report = {markdownFiles: 0, markdownLocalLinks: 0, cssFiles: 0, cssLocalDependencies: 0};
  for (const file of files) {
    const extension = extname(file);
    if (!['.md', '.css'].includes(extension)) continue;
    const text = await readFile(file, 'utf8');
    if (extension === '.md') {
      report.markdownFiles++;
      for (const ref of markdownReferences(text)) if (localReference(site, names, file, ref, 'Markdown')) report.markdownLocalLinks++;
    } else {
      report.cssFiles++;
      const refs = [...text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)].map(m => m[1]);
      refs.push(...[...text.matchAll(/@import\s*["']([^"']+)["']/g)].map(m => m[1]));
      for (const ref of refs) {
        assert(!/^(?:https?:|\/\/)/i.test(ref), 'External stylesheet/font/image runtime dependency: ' + relative(site, file) + ' -> ' + ref);
        if (localReference(site, names, file, ref, 'CSS')) report.cssLocalDependencies++;
      }
    }
  }
  return report;
}
export async function validate(site = join(ROOT, 'public')) {
  site = resolve(site);
  const files = await walk(site);
  let bytes = 0;
  const names = new Set(files.map(p => relative(site, p).split(sep).join('/')));
  for (const required of ['index.html', 'explore.html', 'social.html', 'social.css', 'social.js', 'subway.html', 'app.js', 'gallery.js', 'data/picture-assets.json', 'data/social-pictures.json', 'data/districts.json', 'downloads/Future-Mississauga-Atlas.pdf', 'downloads/project-register.csv', 'licenses/CREDITS.md']) assert(names.has(required), 'Missing public dependency: ' + required);
  const districtMetadata = validateDistrictMetadata(JSON.parse(await readFile(join(site,'data/districts.json'),'utf8')));
  for (const file of files) {
    const name = relative(site, file).split(sep).join('/');
    assert(!forbidden.test(name), 'Forbidden private/raw file in published output: ' + name);
    const size = (await stat(file)).size;
    bytes += size;
    assert(size < 100_000_000, 'File exceeds conservative 100 MB Git threshold: ' + name);
    if (!['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.csv'].includes(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    assert(!/["'`]\s*\/media\/|https?:\/\/[^/\s"'<>]*(?:chatgpt|openai|oaiusercontent)[^/\s"'<>]*\/media\//i.test(text), 'Host-specific media dependency remains: ' + name);
    assert(!text.includes('/Users/'), 'Private absolute filesystem path found: ' + name);
    assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{30,}/.test(text), 'Credential-like material found: ' + name);
    if (['.html', '.css', '.js', '.mjs'].includes(extname(file))) {
      assert(!/https?:\/\/[^\s"'<>]*(?:openai|chatgpt|oaiusercontent|sites-runtime)[^\s"'<>]*/i.test(text), 'Hosted runtime dependency remains: ' + name);
      assert(!/["'`]\/(?:api|auth|media)\//.test(text), 'Server-dependent request remains: ' + name);
    }
    if (extname(file) === '.html') {
      assert(!/(?:src|poster)\s*=\s*["']gallery\/originals\//.test(text), 'Full-size original used as a displayed HTML image: ' + name);
      const refs = [...text.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
      for (const ref of refs) {
        localReference(site, names, file, ref, 'HTML');
      }
    }
  }
  assert(bytes < 1_000_000_000, 'Published output exceeds conservative 1 GB limit.');
  let modelDownloads = 0, refinementBounds = null;
  for (const manifestName of ['refinement-models', 'transit-layer-manifest', 'landscape-layer-manifest']) {
    if (!names.has('data/' + manifestName + '.json')) continue;
    const manifest = JSON.parse(await readFile(join(site, 'data', manifestName + '.json'), 'utf8'));
    if (manifestName === 'refinement-models') refinementBounds = validateRefinementBounds(manifest);
    for (const asset of manifest.assets || []) {
      if (!asset.url) continue;
      assert(asset.url.startsWith('models/') && !asset.url.includes('..'), 'Nonlocal model URL in ' + manifestName);
      assert(names.has(asset.url), 'Missing model download: ' + asset.url);
      if (asset.downloadSHA256) assert.equal(await sha(join(site, asset.url)), asset.downloadSHA256, 'Published model checksum mismatch: ' + asset.url);
      modelDownloads++;
    }
  }
  const pictures = JSON.parse(await readFile(join(site, 'data/picture-assets.json'), 'utf8'));
  const entries = Object.entries(pictures.images || {});
  assert.equal(entries.length, 33, 'Expected the 33 final original PNGs.');
  for (const [name, picture] of entries) {
    assert.equal(picture.url, 'gallery/originals/' + name);
    const path = join(site, picture.url);
    assert.equal((await stat(path)).size, picture.bytes, 'PNG byte count mismatch: ' + name);
    assert.equal(await sha(path), picture.sha256, 'Original PNG checksum mismatch: ' + name);
    const header = await readFile(path);
    assert.equal(header.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(header.readUInt32BE(16), picture.width);
    assert.equal(header.readUInt32BE(20), picture.height);
    assert.equal(picture.width, 3840, 'Expected original 4K width: ' + name);
    const preview = picture.display;
    assert(preview, 'Missing half-size display picture: ' + name);
    assert.equal(preview.url, `gallery/previews/${picture.sha256.slice(0,16)}/${name}`);
    assert.equal(preview.sourceSHA256, picture.sha256, 'Display picture refers to a stale master: ' + name);
    assert.equal(preview.scale, 0.5);
    assert.equal(preview.width, picture.width / 2, 'Display width must be exactly half: ' + name);
    assert.equal(preview.height, picture.height / 2, 'Display height must be exactly half: ' + name);
    const displayPath = join(site, preview.url);
    assert.equal((await stat(displayPath)).size, preview.bytes, 'Display PNG byte count mismatch: ' + name);
    assert.equal(await sha(displayPath), preview.sha256, 'Display PNG checksum mismatch: ' + name);
    const displayHeader = await readFile(displayPath);
    assert.equal(displayHeader.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(displayHeader.readUInt32BE(16), preview.width);
    assert.equal(displayHeader.readUInt32BE(20), preview.height);
  }
  const social = JSON.parse(await readFile(join(site, 'data/social-pictures.json'), 'utf8'));
  assert.equal(social.nativePortraitRendering, true);
  assert.equal(social.ratio, '4:5');
  assert.equal(social.images.length, 33, 'Expected all 33 native portrait records.');
  assert.deepEqual(social.images.map(x => x.file).sort(), entries.map(([name]) => name).sort(), 'Portrait and wide view inventories differ.');
  const socialPage = await readFile(join(site, 'social.html'), 'utf8');
  const portraitPrefix = 'https://github.com/itsdanielsultan/future-mississauga/releases/download/community-images-2026-09-26/';
  for (const picture of social.images) {
    assert.equal(picture.width, 1080);
    assert.equal(picture.height, 1350);
    assert.match(picture.sha256, /^[a-f0-9]{64}$/);
    assert.equal(picture.url, portraitPrefix + picture.file, 'Unexpected portrait download host/tag.');
    assert.equal(picture.preview, 'gallery/social/previews/' + picture.file);
    assert(names.has(picture.preview), 'Missing portrait preview: ' + picture.file);
    const header = await readFile(join(site, picture.preview));
    assert.equal(header.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(header.readUInt32BE(16), 540);
    assert.equal(header.readUInt32BE(20), 675);
    assert.equal(socialPage.split('href="' + picture.url + '"').length - 1, 2, 'Portrait card download links differ from the source register.');
    assert(socialPage.includes('src="' + picture.preview + '"'), 'Portrait card preview differs from the source register.');
  }
  const portraitGallery = {nativePortraitRecords: 33, localHalfSizePreviews: 33, dimensionsVerified: true, remoteDownloadSHA256Recorded: 33, remoteDownloadBytesVerifiedByThisStaticCheck: false};
  const documentLinks = await validateDocumentLinks(site);
  const report = {files: files.length, publishedBytes: bytes, originalPNGs: entries.length, halfSizeDisplayPNGs: entries.length, portraitGallery, modelDownloads, refinementBounds, ...documentLinks, districtMetadata, PNGchecksumsVerified: true, noHostedRuntime: true, noPrivateArtifacts: true};
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.indexOf('--site');
  const site = arg < 0 ? undefined : resolve(process.argv[arg + 1]);
  if (process.argv.includes('--documents-only')) console.log(JSON.stringify(await validateDocumentLinks(site), null, 2));
  else await validate(site);
}
