// Build-only encoding changes: source assets and historical byte proofs stay untouched.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp, readFile, writeFile, readdir, mkdir, rename} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {dirname, join, relative, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflate, inflateSync, constants as zlibConstants} from 'node:zlib';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
const compress = promisify(deflate);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const crcTable = Array.from({length: 256}, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function pngChunks(bytes) {
  assert(bytes.subarray(0, 8).equals(signature), 'Invalid PNG signature');
  const chunks = []; let p = 8;
  while (p < bytes.length) {
    assert(p + 12 <= bytes.length, 'Truncated PNG chunk');
    const size = bytes.readUInt32BE(p), end = p + size + 12;
    assert(end <= bytes.length, 'Truncated PNG payload');
    const type = bytes.toString('ascii', p + 4, p + 8), data = bytes.subarray(p + 8, end - 4);
    assert.equal(crc32(bytes.subarray(p + 4, end - 4)), bytes.readUInt32BE(end - 4), 'PNG CRC mismatch');
    chunks.push({type, data, bytes: bytes.subarray(p, end)}); p = end;
    if (type === 'IEND') break;
  }
  assert.equal(p, bytes.length, 'PNG trailing data');
  assert.equal(chunks[0]?.type, 'IHDR'); assert.equal(chunks.at(-1)?.type, 'IEND');
  assert(chunks.some(c => c.type === 'IDAT'));
  return chunks;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
export function pngPixels(chunks) {
  const h = chunks[0].data, width = h.readUInt32BE(0), height = h.readUInt32BE(4);
  // This reviewed inventory consists of non-interlaced 8-bit RGB/RGBA previews.
  assert.equal(h[8], 8); assert([2, 6].includes(h[9]));
  assert.deepEqual([...h.subarray(10)], [0, 0, 0]);
  const channels = h[9] === 2 ? 3 : 4, stride = width * channels;
  const filtered = inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  assert.equal(filtered.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)]; assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x < channels ? 0 : pixels[i - channels];
      const b = y === 0 ? 0 : pixels[i - stride], c = y === 0 || x < channels ? 0 : pixels[i - stride - channels];
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      pixels[i] = (filtered[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return {width, height, channels, filtered, pixels};
}
const nonIDAT = chunks => Buffer.concat(chunks.filter(c => c.type !== 'IDAT').map(c => c.bytes));
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length);
  result.write(type, 4, 'ascii'); data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4);
  return result;
}
export async function recompressPNG(source, cached = null, strategies = [zlibConstants.Z_DEFAULT_STRATEGY, zlibConstants.Z_FILTERED, zlibConstants.Z_RLE]) {
  const chunks = pngChunks(source), before = pngPixels(chunks);
  const originalIDAT = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  let best = originalIDAT, method = 'unchanged';
  for (const strategy of cached ? [] : strategies) {
    const candidate = await compress(before.filtered, {level: 9, memLevel: 9, strategy});
    if (candidate.length < best.length) {best = candidate; method = `zlib-level9-mem9-strategy${strategy}`;}
  }
  let bytes = cached?.bytes ?? source;
  if (cached) {assert(cached.bytes.length <= source.length); method = cached.method;}
  if (best !== originalIDAT) {
    let written = false;
    bytes = Buffer.concat([signature, ...chunks.flatMap(c => {
      if (c.type !== 'IDAT') return [c.bytes];
      if (written) return []; written = true; return [chunk('IDAT', best)];
    })]);
    if (bytes.length >= source.length) {bytes = source; method = 'unchanged';}
  }
  const afterChunks = pngChunks(bytes), after = pngPixels(afterChunks);
  assert(before.filtered.equals(after.filtered), 'Filtered scanlines changed');
  assert(before.pixels.equals(after.pixels), 'Decoded pixels changed');
  assert(nonIDAT(chunks).equals(nonIDAT(afterChunks)), 'PNG metadata changed');
  return {bytes, proof: {method, sourceBytes: source.length, sourceSHA256: sha(source), bytes: bytes.length, sha256: sha(bytes), width: before.width, height: before.height,
    decodedPixelSHA256: sha(before.pixels), filteredScanlineSHA256: sha(before.filtered), nonIDATChunksSHA256: sha(nonIDAT(chunks)),
    decodedPixelsIdentical: true, filteredScanlinesIdentical: true, nonIDATChunksIdentical: true}};
}
export function minifyJSON(text) {
  // Preserve number tokens, escape sequences, property order and all string bytes.
  let result = '', quoted = false, escaped = false;
  for (const character of text) {
    if (quoted) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {quoted = true; result += character;}
    else if (!/[\t\r\n ]/.test(character)) result += character;
  }
  assert.deepEqual(JSON.parse(result), JSON.parse(text));
  return result;
}
export async function walk(folder) {
  const result = [];
  for (const entry of await readdir(folder, {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), 'Publication source must not contain symlinks');
    const file = join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file)); else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}
export async function inventory(folder) {
  const files = [];
  for (const path of await walk(folder)) {
    const bytes = await readFile(path); files.push({file: relative(folder, path).split('\\').join('/'), bytes: bytes.length, sha256: sha(bytes)});
  }
  return {files, bytes: files.reduce((n, file) => n + file.bytes, 0)};
}
export async function preparePublication(destination, source = join(root, 'public')) {
  assert(destination !== source, 'Never transform public source files');
  const policy = JSON.parse(await readFile(join(root, 'scripts/publication-policy.json'), 'utf8'));
  const before = await inventory(source);
  await cp(source, destination, {recursive: true, dereference: false, mode: fsConstants.COPYFILE_FICLONE});
  const texts = [];
  for (const directory of [source, join(root, 'scripts'), join(root, 'docs')]) for (const path of await walk(directory)) {
    if (path.endsWith('publication-policy.json') || !['.json', '.md', '.txt', '.csv', '.html', '.js', '.mjs', '.css', '.py'].includes(extname(path))) continue;
    texts.push({path, text: await readFile(path, 'utf8')});
  }
  const json = [], skippedPinnedJSON = [];
  for (const file of policy.jsonWhitespaceOnlyPaths) {
    const path = join(source, file), original = await readFile(path), hash = sha(original);
    if (texts.some(row => row.path !== path && row.text.includes(hash))) {skippedPinnedJSON.push(file); continue;}
    const compact = Buffer.from(minifyJSON(original.toString('utf8')));
    if (compact.length >= original.length) continue;
    await writeFile(join(destination, file), compact);
    json.push({file, sourceBytes: original.length, sourceSHA256: hash, bytes: compact.length, sha256: sha(compact), operation: 'JSON whitespace removal only; all tokens retained'});
  }
  const images = new Array(policy.legacyPNGs.length); let next = 0;
  // Cached bytes only save deflate work; pixels, scanlines, metadata and hashes
  // are independently verified on every use. The cache is never published.
  const cache = join(tmpdir(), `future-mississauga-png-v1-${process.versions.zlib}`);
  await mkdir(cache, {recursive: true});
  await Promise.all(Array.from({length: 4}, async () => {
    for (;;) {
      const index = next++; if (index >= images.length) return;
      const item = policy.legacyPNGs[index], original = await readFile(join(source, item.file));
      assert.equal(original.length, item.bytes, 'Pinned PNG size changed: ' + item.file);
      assert.equal(sha(original), item.sha256, 'Pinned PNG hash changed: ' + item.file);
      const cachePNG = join(cache, item.sha256 + '.png'), cacheJSON = join(cache, item.sha256 + '.json');
      let cached = null;
      try {
        const proof = JSON.parse(await readFile(cacheJSON, 'utf8')), bytes = await readFile(cachePNG);
        assert.equal(sha(bytes), proof.sha256); cached = {bytes, method: proof.method};
      } catch (error) {if (error.code !== 'ENOENT') throw error;}
      // The pinned-source review already measured the best strategy per file.
      // Rerun that encoding only; a different zlib result must still pass all
      // byte-equality checks and the final unchanged publication-size gate.
      const result = await recompressPNG(original, cached, item.compressionStrategy === null ? [] : [item.compressionStrategy]);
      if (!cached) {
        const temporary = cachePNG + '.' + process.pid + '.tmp';
        await writeFile(temporary, result.bytes); await rename(temporary, cachePNG);
        await writeFile(cacheJSON, JSON.stringify(result.proof));
      }
      if (result.proof.method !== 'unchanged') await writeFile(join(destination, item.file), result.bytes);
      images[index] = {file: item.file, ...result.proof,
        sourceRecoveryURL: `https://raw.githubusercontent.com/itsdanielsultan/future-mississauga/${policy.baselineCommit}/public/${item.file}`};
    }
  }));
  const manifest = {schema: 'future-mississauga-publication-derivatives/v1', state: 'prepared-local-publication',
    policy: 'Legacy preview URLs are retained. Changed PNGs are lossless encoding derivatives, not the originally verified source bytes. Historical source/nativeOriginal/upload records keep their original hashes and dates. Exact original files remain in public/ and the pinned baseline; recovery URLs are locators, not new remote-byte verification. Release download masters and their URLs are unchanged.',
    baselineCommit: policy.baselineCommit, runtime: {node: process.version, zlib: process.versions.zlib},
    pngTransform: 'Only IDAT deflate encoding changes. Decoded pixels, filtered scanlines, and every non-IDAT chunk are compared byte-for-byte.',
    sourcePublicBytes: before.bytes, sourceFiles: before.files.length, json, skippedPinnedJSON, images};
  await writeFile(join(destination, 'data/publication-derivatives.json'), JSON.stringify(manifest) + '\n');
  assert.deepEqual(await inventory(source), before, 'Public source changed during publication preparation');
  return manifest;
}
export async function validatePublicationDerivatives(site, source = join(root, 'public')) {
  const manifest = JSON.parse(await readFile(join(site, 'data/publication-derivatives.json'), 'utf8'));
  assert.equal(manifest.state, 'prepared-local-publication');
  const policy = JSON.parse(await readFile(join(root, 'scripts/publication-policy.json'), 'utf8'));
  assert.equal(manifest.images.length, policy.legacyPNGs.length);
  assert.equal(new Set(manifest.images.map(row => row.file)).size, policy.legacyPNGs.length);
  for (const item of policy.legacyPNGs) {
    const row = manifest.images.find(row => row.file === item.file); assert(row);
    const original = await readFile(join(source, item.file)), actual = await readFile(join(site, item.file));
    assert.equal(sha(original), item.sha256); assert.equal(row.sourceSHA256, item.sha256);
    assert.equal(original.length, row.sourceBytes); assert.equal(actual.length, row.bytes); assert.equal(sha(actual), row.sha256);
    const sourceChunks = pngChunks(original), actualChunks = pngChunks(actual), a = pngPixels(sourceChunks), b = pngPixels(actualChunks);
    assert(a.pixels.equals(b.pixels)); assert(a.filtered.equals(b.filtered)); assert(nonIDAT(sourceChunks).equals(nonIDAT(actualChunks)));
    assert.equal(sha(b.pixels), row.decodedPixelSHA256); assert.equal(sha(b.filtered), row.filteredScanlineSHA256);
    assert.equal(sha(nonIDAT(actualChunks)), row.nonIDATChunksSHA256);
  }
  for (const row of manifest.json) {
    assert(policy.jsonWhitespaceOnlyPaths.includes(row.file));
    const original = await readFile(join(source, row.file)), actual = await readFile(join(site, row.file));
    assert.equal(sha(original), row.sourceSHA256); assert.equal(sha(actual), row.sha256);
    assert.equal(actual.toString(), minifyJSON(original.toString()));
  }
  return {legacyPNGFilesVerified: manifest.images.length, changedLegacyPNGs: manifest.images.filter(row => row.sourceSHA256 !== row.sha256).length,
    jsonWhitespaceFilesVerified: manifest.json.length, originalSourceFilesRetained: true, decodedPixelsAndMetadataVerified: true};
}
