import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {mkdtemp, rename, rm, writeFile} from 'node:fs/promises';
import {validate} from './validate.mjs';
import {offloadValidatedAssets} from './offload-assets.mjs';
import {preparePublication, validatePublicationDerivatives, inventory} from './prepare-publication.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stage = await mkdtemp(join(root, '.publication-stage-'));
try {
  await preparePublication(stage);
  const report = await validate(stage, {enforcePublicationSize:false});
  const derivatives = await validatePublicationDerivatives(stage);
  const assetDelivery = await offloadValidatedAssets(stage);
  const output = await inventory(stage);
  await rm(join(root, 'dist'), {recursive: true, force: true});
  await rename(stage, join(root, 'dist'));
  await writeFile(join(root, 'PUBLICATION-MANIFEST.json'), JSON.stringify({schema: 'future-mississauga-publication-inventory/v1',
    publicationAuthorized: false, sourceAssetsUnchanged: true, historicalExportManifest: 'EXPORT-MANIFEST.json',
    output: 'dist', strictMaximumExclusive: 1_000_000_000, validation: {...report, completeReviewBytes:report.publishedBytes, publishedBytes:output.bytes}, derivatives, assetDelivery, ...output}, null, 2) + '\n');
  console.log('Validated publication ready in dist/. Source public/ remains unchanged. Publish dist/ only after approval.');
} finally {await rm(stage, {recursive: true, force: true});}
