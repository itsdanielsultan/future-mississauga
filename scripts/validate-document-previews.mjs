import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// These pins bind the independently reviewed 13-document, 61-page package.
const CATALOG_SHA256 = 'f7ba640d8799bba3211be0d475f865f85739fbeb3a604e30d724d0614efa55ce';
const TEXT_SHA256 = '0fd144cde35d7c12c586bc45874815ca1cd8ff79497b6119cdf4b6e1c0a8d879';
const ASSET_LIST_SHA256 = 'cfd6c8797da771363e61d2ee6da46a0277eeeab8bd376512da83fb25a394db50';
const BASE = 'https://github.com/itsdanielsultan/future-mississauga/releases/download/document-previews-2026-10-23/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function validateDocumentPreviews(root, {structureOnly = false} = {}) {
  const [catalogBytes, textBytes] = await Promise.all([
    readFile(join(root, 'data/document-previews.json')),
    readFile(join(root, 'document-page-text.txt')),
  ]);
  assert.equal(sha(catalogBytes), CATALOG_SHA256, 'Document catalog differs from the independently reviewed package.');
  assert.equal(sha(textBytes), TEXT_SHA256, 'Accessible document text differs from the reviewed extraction.');
  const catalog = JSON.parse(catalogBytes);
  assert.equal(catalog.base, BASE);
  assert.equal(catalog.documents.length, 13);
  assert.equal(new Set(catalog.documents.map(doc => doc.url)).size, 13, 'Duplicate source PDF.');
  assert.equal(new Set(catalog.documents.map(doc => doc.prefix)).size, 13, 'Duplicate document page prefix.');

  const pageURLs = new Set();
  let reviewDocuments = 0, termsDocuments = 0, atlasDocuments = 0;
  for (const doc of catalog.documents) {
    assert(typeof doc.title === 'string' && doc.title.trim(), 'Document title is missing.');
    assert(/^[a-z0-9-]+-[a-f0-9]{12}-$/.test(doc.prefix), 'Unsafe document page prefix.');
    assert(Number.isInteger(doc.pages) && doc.pages > 0);
    if (doc.url === 'downloads/City-of-Mississauga-Open-Data-Terms.pdf') {
      termsDocuments++;
      assert.equal(doc.pages, 4);
      assert.equal(doc.height, 3106);
    } else if (doc.url === 'downloads/Future-Mississauga-Atlas.pdf?edition=c9f219e7094e834a') {
      atlasDocuments++;
      assert.equal(doc.pages, 35);
      assert.equal(doc.sizes?.length, doc.pages);
    } else {
      reviewDocuments++;
      assert(/^https:\/\/github\.com\/itsdanielsultan\/future-mississauga\/releases\/download\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/.test(doc.url), 'Unexpected source PDF URL.');
      assert.equal(doc.pages, 2);
      assert.equal(doc.height, 1697);
    }
    if (doc.sizes) assert.equal(doc.sizes.length, doc.pages);
    for (let page = 0; page < doc.pages; page++) {
      const dimensions = doc.sizes ? doc.sizes[page] : [doc.width, doc.height];
      assert(Array.isArray(dimensions) && dimensions.length === 2);
      const [width, height] = dimensions;
      assert.equal(width, 2400);
      assert(Number.isInteger(height) && height > 0 && height <= 4000);
      const url = BASE + doc.prefix + String(page + 1).padStart(2, '0') + '.avif';
      assert.equal(new URL(url).origin, 'https://github.com');
      assert(!pageURLs.has(url), 'Duplicate page preview URL.');
      pageURLs.add(url);
    }
  }
  assert.equal(reviewDocuments, 11);
  assert.equal(termsDocuments, 1);
  assert.equal(atlasDocuments, 1);
  assert.equal(pageURLs.size, 61);

  const base64 = textBytes.toString('utf8').trim();
  assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64), 'Document text must be valid base64.');
  const compressed = Buffer.from(base64, 'base64');
  assert.equal(compressed.toString('base64'), base64);
  const text = JSON.parse(gunzipSync(compressed, {maxOutputLength: 1_000_000}));
  assert(Array.isArray(text) && text.length === catalog.documents.length);
  let textPages = 0;
  for (const [index, pages] of text.entries()) {
    assert(Array.isArray(pages) && pages.length === catalog.documents[index].pages, 'Accessible text page count differs from the document.');
    for (const page of pages) {
      assert(typeof page === 'string' && page.trim(), 'Accessible page text is empty.');
      assert(!/\/Users\/|\/private\/|file:\/\/|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(page), 'Private material in document text.');
      textPages++;
    }
  }
  assert.equal(textPages, 61);

  if (!structureOnly) {
    const proofBytes = await readFile(join(root, 'data/document-proof.json'));
    assert(proofBytes.length < 500, 'Document proof exceeds its compact size budget.');
    const proof = JSON.parse(proofBytes);
    assert.equal(proof.schema, 'future-mississauga-document-previews-public-proof/v1');
    assert.equal(proof.status, 'PASS');
    assert.equal(proof.manifestSHA256, sha(catalogBytes));
    assert.equal(proof.textSHA256, sha(textBytes));
    assert.equal(proof.pagesVerified, 61);
    assert.equal(proof.sourceDocuments, 13);
    assert.equal(proof.assetListSHA256, ASSET_LIST_SHA256, 'Public page proof differs from the exact 61 reviewed asset hashes and dimensions.');
  }
  return {sourceDocuments: 13, pagePreviews: 61, accessibleTextPages: textPages,
    exactCatalogAndTextVerified: true, all61URLDimensionsVerified: true,
    reviewedAssetListSHA256: ASSET_LIST_SHA256, publicBytesVerified: !structureOnly};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await validateDocumentPreviews(resolve(process.argv[2] || 'public'), {
    structureOnly: process.argv.includes('--structure-only'),
  }), null, 2));
}
