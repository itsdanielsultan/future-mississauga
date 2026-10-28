import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';
import test from 'node:test';
import {validateCurrentCitywideMedia} from './validate-current-citywide-media.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baseline = new URL('../public/', import.meta.url);
// Small container fixtures exercise header/binding checks; they are never published.
function png(width, height) {
  const bytes = Buffer.alloc(45);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
  bytes.writeUInt32BE(13, 8); bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  bytes.write('IEND', 37); return bytes;
}
function box(type, payload) {
  const bytes = Buffer.alloc(payload.length + 8);
  bytes.writeUInt32BE(bytes.length); bytes.write(type, 4); payload.copy(bytes, 8); return bytes;
}
function avif(width, height) {
  const extent = Buffer.alloc(12); extent.writeUInt32BE(width, 4); extent.writeUInt32BE(height, 8);
  return Buffer.concat([
    box('ftyp', Buffer.concat([Buffer.from('avif'), Buffer.alloc(4), Buffer.from('avif')])),
    box('meta', Buffer.concat([Buffer.alloc(4), box('iprp', box('ipco', box('ispe', extent)))])),
  ]);
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'citywide-media-validator-'));
  const json = async (path, value) => writeFile(join(root, path), JSON.stringify(value));
  try {
    for (const file of ['data/document-previews.json', 'document-page-text.txt', 'data/document-proof.json', 'data/picture-assets.json', 'data/labelled-image-assets.json']) {
      await mkdir(dirname(join(root, file)), {recursive: true});
      await copyFile(new URL(file, baseline), join(root, file));
    }
    const assets = [];
    async function asset(file, bytes, type, width, height) {
      await mkdir(dirname(join(root, file)), {recursive: true}); await writeFile(join(root, file), bytes);
      const record = {file, bytes: bytes.length, sha256: sha(bytes), type};
      if (width) Object.assign(record, {width, height});
      assets.push(record);
      return {url: file, bytes: record.bytes, sha256: record.sha256, format: type, ...(width ? {width, height} : {})};
    }
    const nativeBytes = png(3840, 2400);
    const nativeSource = {sha256: sha(nativeBytes), bytes: nativeBytes.length, width: 3840, height: 2400, renderDate: '2026-10-28'};
    const displayMaster = await asset('gallery/current/display-citywide-20261028.png', nativeBytes, 'image/png', 3840, 2400);
    const download = await asset('gallery/current/citywide-20261028.png', nativeBytes, 'image/png', 3840, 2400);
    const preview = await asset('gallery/current/citywide-1200.avif', avif(1200, 750), 'image/avif', 1200, 750);
    const responsive = await asset('gallery/current/citywide-3200.avif', avif(3200, 2000), 'image/avif', 3200, 2000);
    for (const row of [displayMaster, download]) row.nativeSourceSHA256 = nativeSource.sha256;
    for (const row of [preview, responsive]) row.sourceSHA256 = displayMaster.sha256;
    const manifest = {schema: 'future-mississauga-current-citywide-media/v1', image: {
      kind: 'wide', file: 'citywide-future.png', aliases: [], nativeSource,
      displayMaster, download, preview, responsive,
      renderInfo: {state: 'new-source-assembly', sourceModelDate: null, sourceDatesMixed: true, renderDate: '2026-10-28'},
      sourceAttribution: {openStreetMap: true},
    }};
    const catalog = JSON.parse(await readFile(join(root, 'data/document-previews.json'), 'utf8'));
    const atlas = {url: 'downloads/Future-Mississauga-Atlas-20261028-012345abcdef.pdf', title: 'Picture atlas', pages: 2,
      base: 'gallery/atlas-20261028/', prefix: 'future-mississauga-atlas-012345abcdef-', sizes: [[2400, 1600], [2400, 1800]]};
    catalog.documents.push(atlas);
    await asset(atlas.url, Buffer.from('%PDF-1.7\nfixture\n%%EOF'), 'application/pdf');
    for (const [page, [width, height]] of atlas.sizes.entries()) await asset(
      atlas.base + atlas.prefix + String(page + 1).padStart(2, '0') + '.avif', avif(width, height), 'image/avif', width, height);
    const text = JSON.parse(gunzipSync(Buffer.from(await readFile(join(root, 'document-page-text.txt'), 'utf8'), 'base64')));
    text.push(['Current Citywide view. Model sources vary by date.', 'Other district images retain their individual dates.']);
    const proof = {schema: 'future-mississauga-current-citywide-media-public-proof/v1', status: 'LOCAL_BYTES_VERIFIED', assets};
    async function save() {
      await json('data/citywide-media-20261028.json', manifest);
      await json('data/citywide-media-20261028-public-proof.json', proof);
      await json('data/document-previews-20261028.json', catalog);
      await writeFile(join(root, 'document-page-text-20261028.txt'), gzipSync(JSON.stringify(text)).toString('base64'));
    }
    await save(); await run({root, manifest, catalog, text, proof, save, asset});
  } finally { await rm(root, {recursive: true, force: true}); }
}

test('new local package passes with a private raw master and preserves all historical document bindings', async () => fixture(async ({root}) => {
  const result = await validateCurrentCitywideMedia(root);
  assert.deepEqual(result, {status: 'LOCAL_BYTES_VERIFIED', publicationEvidence: 'NOT_CHECKED_BY_LOCAL_STRUCTURE_PREFLIGHT',
    currentImages: 1, newAssets: 7, newAtlasPages: 2, historicalDocumentsPreserved: 13, historicalPagesPreserved: 61,
    rawMasterPublished: false, mixedSourceDates: true});
}));

test('an optional published raw master is checked and included in the exact asset union', async () => fixture(async f => {
  f.manifest.image.nativeOriginal = await f.asset('gallery/current/native-citywide-20261028.png', png(3840, 2400), 'image/png', 3840, 2400);
  await f.save();
  const result = await validateCurrentCitywideMedia(f.root);
  assert.equal(result.newAssets, 8); assert.equal(result.rawMasterPublished, true);
}));

test('rewriting an older document or page text fails even if the new Atlas is valid', async () => fixture(async f => {
  const original = f.catalog.documents[0].title;
  f.catalog.documents[0].title = 'Changed older study'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /Historical document records changed/);
  f.catalog.documents[0].title = original; f.text[0][0] = 'Rewritten historical page'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /Historical page text changed/);
}));

test('a query-only Atlas edition cannot replace the historical PDF', async () => fixture(async f => {
  f.catalog.documents.at(-1).url = 'downloads/Future-Mississauga-Atlas.pdf?edition=new'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /plain relative local path/);
}));

test('an optional Atlas source hash must identify the actual verified PDF', async () => fixture(async f => {
  const atlas = f.catalog.documents.at(-1);
  atlas.sourceSHA256 = f.proof.assets.find(asset => asset.file === atlas.url).sha256;
  await f.save();
  await validateCurrentCitywideMedia(f.root);
  atlas.sourceSHA256 = '0'.repeat(64); await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /Atlas source PDF hash differs/);
}));

test('render date and mixed source dates cannot be substituted for one another', async () => fixture(async f => {
  f.manifest.image.renderInfo.sourceModelDate = '2026-10-28'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /Mixed source dates/);
  f.manifest.image.renderInfo.sourceModelDate = null;
  f.manifest.image.renderInfo.renderDate = '2026-02-30'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /invalid calendar date/);
}));

test('all published bytes and image header dimensions must match the proof', async () => fixture(async f => {
  const file = f.manifest.image.download.url;
  await writeFile(join(f.root, file), png(1920, 1200));
  await assert.rejects(validateCurrentCitywideMedia(f.root), /SHA256 differs/);
  const bytes = await readFile(join(f.root, file));
  f.manifest.image.download.sha256 = sha(bytes);
  f.proof.assets.find(asset => asset.file === file).sha256 = sha(bytes);
  await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /image header dimensions differ/);
}));

test('preview lineage and historical pixel URLs cannot be rebound', async () => fixture(async f => {
  const original = f.manifest.image.preview.sourceSHA256;
  f.manifest.image.preview.sourceSHA256 = '0'.repeat(64); await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /wrong display pixels/);
  f.manifest.image.preview.sourceSHA256 = original;
  const historical = JSON.parse(await readFile(join(f.root, 'data/labelled-image-assets.json'), 'utf8'));
  f.manifest.image.preview.url = historical.images[0].aliases.find(value => !value.startsWith('http'));
  await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /collides with historical URL/);
}));

test('unsafe paths, private provenance and invented publication claims fail', async () => fixture(async f => {
  const original = f.manifest.image.preview.url;
  f.manifest.image.preview.url = '../outside.avif'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /plain relative local path|Unsafe local asset path/);
  f.manifest.image.preview.url = original;
  f.proof.provenance = '/Users/example/private-source.blend'; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /private path/);
  delete f.proof.provenance; f.proof.publicHTTPVerified = true; await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /separate publication evidence/);
}));

test('missing or unrelated assets cannot be smuggled into the reviewed proof', async () => fixture(async f => {
  const removed = f.proof.assets.pop(); await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /exactly the new media assets/);
  f.proof.assets.push({...removed, file: 'gallery/unrelated.avif'}); await f.save();
  await assert.rejects(validateCurrentCitywideMedia(f.root), /Unexpected proof asset/);
}));
