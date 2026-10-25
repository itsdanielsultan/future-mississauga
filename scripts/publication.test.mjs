import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {minifyJSON, pngChunks, pngPixels, recompressPNG, crc32} from './prepare-publication.mjs';
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(type, 4); data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4); return bytes;
}
function fixture(pixel = 0) {
  const header = Buffer.alloc(13); header.writeUInt32BE(128, 0); header.writeUInt32BE(3, 4); header[8] = 8; header[9] = 2;
  const scanlines = Buffer.alloc((128 * 3 + 1) * 3, 0); scanlines[0] = 0; scanlines[385] = 1; scanlines[770] = 4;
  scanlines[1] = pixel;
  const data = deflateSync(scanlines, {level: 0});
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('tEXt', Buffer.from('Copyright\0Daniel Sultan; source dates retained')),
    chunk('IDAT', data.subarray(0, 20)), chunk('IDAT', data.subarray(20)), chunk('IEND', Buffer.alloc(0))]);
}
test('JSON minification preserves numeric lexemes, escapes and whitespace inside strings', () => {
  const source = '{ "large": 9007199254740993, "minus": -0, "exp": 1e+030, "label": "a \\t \\\" b", "unicode": "\\u0041" }';
  const output = minifyJSON(source);
  assert(output.includes('9007199254740993')); assert(output.includes('1e+030')); assert(output.includes('"minus":-0'));
  assert(output.includes('"\\u0041"')); assert.deepEqual(JSON.parse(output), JSON.parse(source));
});
test('PNG recompression preserves pixels, scanlines and all ancillary metadata', async () => {
  const source = fixture(), result = await recompressPNG(source);
  assert(result.bytes.length < source.length);
  assert(pngPixels(pngChunks(source)).pixels.equals(pngPixels(pngChunks(result.bytes)).pixels));
  assert.deepEqual(pngChunks(source).filter(c => c.type !== 'IDAT').map(c => c.bytes), pngChunks(result.bytes).filter(c => c.type !== 'IDAT').map(c => c.bytes));
  assert(result.proof.decodedPixelsIdentical && result.proof.filteredScanlinesIdentical && result.proof.nonIDATChunksIdentical);
});
test('PNG validation rejects damaged CRCs and trailing data', () => {
  const damaged = fixture(); damaged[50] ^= 1;
  assert.throws(() => pngChunks(damaged), /CRC mismatch/);
  assert.throws(() => pngChunks(Buffer.concat([fixture(), Buffer.from('extra')])), /trailing data/);
});
test('cached PNG with valid CRCs cannot substitute changed pixels', async () => {
  const source = fixture(), different = fixture(7);
  assert.doesNotThrow(() => pngChunks(different));
  await assert.rejects(recompressPNG(source, {bytes: different, method: 'unchanged'}), /Filtered scanlines changed/);
});
