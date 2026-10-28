import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDocumentPreviews} from './validate-document-previews.mjs';

const SITE = 'https://futuremississauga.com/';
const MANIFEST = 'data/citywide-media-20261028.json';
const PROOF = 'data/citywide-media-20261028-public-proof.json';
const DOCUMENTS = 'data/document-previews-20261028.json';
const TEXT = 'document-page-text-20261028.txt';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = async (root, path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const key = value => { const url = new URL(value, SITE); return url.origin + url.pathname; };

function publicContent(value, label) {
  if (typeof value === 'string') {
    assert(!/\/Users\/|\/private\/|\/home\/|\/var\/|\/tmp\/|file:\/\/|[a-z]:\\|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value), `${label}: private path or secret`);
    if (/^https?:\/\//.test(value)) {
      const url = new URL(value);
      assert(!url.username && !url.password, `${label}: URL credentials`);
    }
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      assert(!/^(publicHTTPVerified|publicBytesVerified|publicHashesVerified|published|githubDigest|providerDigest)$/i.test(name), `${label}: public verification belongs in separate publication evidence`);
      publicContent(child, `${label}.${name}`);
    }
  }
}

function localFile(value) {
  assert(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value), 'Asset must use a plain relative local path');
  assert(value.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe local asset path');
  return value;
}

function identity(asset, label) {
  assert(asset && /^[a-f0-9]{64}$/.test(asset.sha256), `${label}: SHA256 missing`);
  assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, `${label}: byte count missing`);
}

function date(value, label) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value, `${label}: invalid calendar date`);
}

function oldURLs(value, result = new Set(), field = '') {
  if (typeof value === 'string' && ['url', 'preview', 'aliases'].includes(field)) result.add(key(value));
  else if (Array.isArray(value)) value.forEach(child => oldURLs(child, result, field));
  else if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) oldURLs(child, result, name);
  return result;
}

function avifDimensions(bytes) {
  assert(bytes.length >= 20 && bytes.toString('ascii', 4, 8) === 'ftyp', 'Invalid AVIF header');
  const extents = [];
  let avifBrand = false;
  function boxes(start, end) {
    for (let position = start; position < end;) {
      assert(position + 8 <= end, 'Truncated AVIF box');
      let size = bytes.readUInt32BE(position), header = 8;
      const type = bytes.toString('ascii', position + 4, position + 8);
      if (size === 1) {
        assert(position + 16 <= end, 'Truncated AVIF large box');
        size = Number(bytes.readBigUInt64BE(position + 8)); header = 16;
      }
      if (size === 0) size = end - position;
      assert(Number.isSafeInteger(size) && size >= header && position + size <= end, 'Malformed AVIF box');
      if (type === 'ftyp') avifBrand = bytes.subarray(position + header, position + size).includes(Buffer.from('avif'));
      if (type === 'ispe') {
        assert(size >= header + 12, 'Invalid AVIF dimensions');
        extents.push([bytes.readUInt32BE(position + header + 4), bytes.readUInt32BE(position + header + 8)]);
      }
      if (['meta', 'iprp', 'ipco'].includes(type)) boxes(position + header + (type === 'meta' ? 4 : 0), position + size);
      position += size;
    }
  }
  boxes(0, bytes.length);
  assert(avifBrand && extents.length, 'AVIF dimensions missing');
  assert(extents.every(size => size.join(',') === extents[0].join(',')), 'Conflicting AVIF dimensions');
  return extents[0];
}

function imageDimensions(bytes, type) {
  if (type === 'image/avif') return avifDimensions(bytes);
  assert(bytes.length >= 33 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Invalid PNG header');
  assert.equal(bytes.readUInt32BE(8), 13, 'Invalid PNG IHDR length');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'PNG IHDR missing');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function decodeText(bytes) {
  const encoded = bytes.toString('utf8').trim();
  const compressed = Buffer.from(encoded, 'base64');
  assert.equal(compressed.toString('base64'), encoded, 'Invalid document text encoding');
  return JSON.parse(gunzipSync(compressed, {maxOutputLength: 2_000_000}));
}

export async function validateCurrentCitywideMedia(root) {
  // This also verifies the immutable original catalogue, text and compact proof pins.
  const historical = await validateDocumentPreviews(root);
  const [manifest, proof, catalog, oldCatalog, oldTextBytes, newTextBytes, pictures, labelled] = await Promise.all([
    readJSON(root, MANIFEST), readJSON(root, PROOF), readJSON(root, DOCUMENTS),
    readJSON(root, 'data/document-previews.json'), readFile(join(root, 'document-page-text.txt')),
    readFile(join(root, TEXT)), readJSON(root, 'data/picture-assets.json'), readJSON(root, 'data/labelled-image-assets.json'),
  ]);
  assert.equal(manifest.schema, 'future-mississauga-current-citywide-media/v1');
  assert.equal(proof.schema, 'future-mississauga-current-citywide-media-public-proof/v1');
  assert.equal(proof.status, 'LOCAL_BYTES_VERIFIED');
  publicContent(manifest, 'media'); publicContent(proof, 'proof'); publicContent(catalog, 'documents');
  const row = manifest.image;
  assert.equal(row?.kind, 'wide'); assert.equal(row.file, 'citywide-future.png');
  assert.deepEqual(row.aliases, [], 'Current pixels cannot alias historical images');
  const info = row.renderInfo;
  assert.equal(info?.sourceModelDate, null, 'Mixed source dates cannot become one model date');
  assert.equal(info.sourceDatesMixed, true);
  assert(typeof info.state === 'string' && info.state && !['retained-earlier', 'camera-reframed'].includes(info.state), 'New source assembly must not claim old pixels or a camera-only change');
  date(info.renderDate, 'Render date');
  if (info.renderTimestampUTC) {
    assert(!Number.isNaN(Date.parse(info.renderTimestampUTC)), 'Invalid render timestamp');
    if (info.renderDateTimezone) {
      const renderedDate = new Intl.DateTimeFormat('en-CA', {timeZone: info.renderDateTimezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(info.renderTimestampUTC));
      assert.equal(renderedDate, info.renderDate, 'Render timestamp/date mismatch');
    }
  }
  assert.equal(typeof row.sourceAttribution?.openStreetMap, 'boolean', 'Explicit map source attribution required');
  const native = row.nativeOriginal || row.nativeSource;
  identity(native, 'Native source');
  assert.deepEqual([native.width, native.height], [3840, 2400], 'Native source must remain full-size 4K');
  const nativeDate = native.renderDate || native.renderInfo?.renderDate;
  if (nativeDate) assert.equal(nativeDate, info.renderDate, 'Native render date mismatch');
  if (row.nativeOriginal && row.nativeSource) for (const field of ['sha256', 'bytes', 'width', 'height']) assert.equal(row.nativeOriginal[field], row.nativeSource[field], 'Conflicting raw source identity');

  const historicalURLs = oldURLs([pictures, labelled, oldCatalog]);
  const expected = new Map();
  function expect(file, type, asset = {}) {
    localFile(file);
    assert(!historicalURLs.has(key(file)), `New asset collides with historical URL: ${file}`);
    const entry = {file, type};
    for (const field of ['bytes', 'sha256', 'width', 'height']) if (asset[field] !== undefined) entry[field] = asset[field];
    if (expected.has(file)) assert.deepEqual(expected.get(file), entry, 'Conflicting asset bindings');
    expected.set(file, entry);
  }
  function image(asset, dimensions, type, label) {
    identity(asset, label);
    assert.deepEqual([asset.width, asset.height], dimensions, `${label}: wrong dimensions`);
    if (asset.format) assert([type, type.split('/')[1]].includes(asset.format), `${label}: wrong format`);
    expect(asset.url, type, asset);
  }
  image(row.preview, [1200, 750], 'image/avif', 'Preview');
  image(row.responsive, [3200, 2000], 'image/avif', 'Responsive preview');
  image(row.displayMaster, [3840, 2400], 'image/png', 'Display master');
  image(row.download, [3840, 2400], 'image/png', 'Download');
  if (native.url) image(native, [3840, 2400], 'image/png', 'Native original');
  for (const asset of [row.preview, row.responsive]) assert.equal(asset.sourceSHA256, row.displayMaster.sha256, 'Preview bound to wrong display pixels');
  for (const asset of [row.displayMaster, row.download]) assert.equal(asset.nativeSourceSHA256, native.sha256, 'PNG bound to wrong native render');

  assert.equal(catalog.base, oldCatalog.base, 'Historical preview base changed');
  assert.equal(catalog.documents?.length, oldCatalog.documents.length + 1, 'Append exactly one new Atlas');
  assert.deepEqual(catalog.documents.slice(0, oldCatalog.documents.length), oldCatalog.documents, 'Historical document records changed');
  const allText = decodeText(newTextBytes), oldText = decodeText(oldTextBytes);
  assert(Array.isArray(allText) && allText.length === catalog.documents.length, 'Document text bindings differ');
  assert.deepEqual(allText.slice(0, oldText.length), oldText, 'Historical page text changed');
  publicContent(allText, 'pageText');
  const atlas = catalog.documents.at(-1), atlasText = allText.at(-1);
  localFile(atlas.url);
  assert(/^downloads\/Future-Mississauga-Atlas-\d{8}-[a-f0-9]{12}\.pdf$/.test(atlas.url), 'New Atlas requires a versioned PDF pathname');
  assert.equal(new Set(catalog.documents.map(doc => key(doc.url))).size, catalog.documents.length, 'PDF pathnames must identify distinct editions');
  assert(typeof atlas.title === 'string' && atlas.title.trim(), 'Atlas title missing');
  assert(Number.isInteger(atlas.pages) && atlas.pages > 0, 'Atlas page count missing');
  assert(Array.isArray(atlasText) && atlasText.length === atlas.pages, 'New Atlas page text count differs');
  assert(atlasText.every(page => typeof page === 'string' && page.trim()), 'New Atlas page text missing');
  assert(typeof atlas.base === 'string' && atlas.base.endsWith('/'), 'New Atlas needs its own local page base');
  localFile(atlas.base.slice(0, -1));
  assert(/^[a-z0-9-]+-[a-f0-9]{12}-$/.test(atlas.prefix), 'Unsafe Atlas page prefix');
  if (atlas.sizes) assert.equal(atlas.sizes.length, atlas.pages, 'Atlas page dimensions missing');
  expect(atlas.url, 'application/pdf');
  for (let page = 1; page <= atlas.pages; page++) {
    const [width, height] = atlas.sizes?.[page - 1] || [atlas.width, atlas.height];
    assert(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0, 'Invalid Atlas page dimensions');
    expect(atlas.base + atlas.prefix + String(page).padStart(2, '0') + '.avif', 'image/avif', {width, height});
  }

  assert(Array.isArray(proof.assets) && proof.assets.length === expected.size, 'Proof must cover exactly the new media assets');
  const proofFiles = new Set();
  const publicRoot = await realpath(root);
  for (const asset of proof.assets) {
    localFile(asset.file); identity(asset, asset.file);
    assert(!proofFiles.has(asset.file), 'Duplicate proof asset'); proofFiles.add(asset.file);
    const binding = expected.get(asset.file); assert(binding, `Unexpected proof asset: ${asset.file}`);
    for (const [field, value] of Object.entries(binding)) assert.equal(asset[field], value, `${asset.file}: binding differs for ${field}`);
    const extensions = {'image/png': '.png', 'image/avif': '.avif', 'application/pdf': '.pdf'};
    assert(asset.file.endsWith(extensions[asset.type]), 'Asset type/extension mismatch');
    const path = await realpath(join(root, asset.file));
    assert(path.startsWith(publicRoot + sep), 'Asset resolves outside public root');
    const bytes = await readFile(path);
    assert.equal(bytes.length, asset.bytes, `${asset.file}: bytes differ`);
    assert.equal(digest(bytes), asset.sha256, `${asset.file}: SHA256 differs`);
    if (asset.type === 'application/pdf') {
      if (atlas.sourceSHA256 !== undefined) assert.equal(atlas.sourceSHA256, asset.sha256, 'Atlas source PDF hash differs');
      assert(bytes.toString('ascii', 0, 5) === '%PDF-' && bytes.subarray(-1024).includes(Buffer.from('%%EOF')), 'Invalid PDF file');
    } else assert.deepEqual(imageDimensions(bytes, asset.type), [asset.width, asset.height], `${asset.file}: image header dimensions differ`);
  }
  return {
    status: 'LOCAL_BYTES_VERIFIED', publicationEvidence: 'NOT_CHECKED_BY_LOCAL_STRUCTURE_PREFLIGHT',
    currentImages: 1, newAssets: expected.size, newAtlasPages: atlas.pages,
    historicalDocumentsPreserved: historical.sourceDocuments, historicalPagesPreserved: historical.pagePreviews,
    rawMasterPublished: Boolean(native.url), mixedSourceDates: true,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await validateCurrentCitywideMedia(resolve(process.argv[2] || 'public')), null, 2));
}
