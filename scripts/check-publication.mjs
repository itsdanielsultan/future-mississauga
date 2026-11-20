import {fileURLToPath} from 'node:url';
import {offloadReleaseImages,validateReleaseImageDelivery} from './release-image-delivery.mjs';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {preparePublication, validatePublicationDerivatives} from './prepare-publication.mjs';
import {validate} from './validate.mjs';
import {offloadValidatedAssets} from './offload-assets.mjs';
const stage = await mkdtemp(join(tmpdir(), 'future-mississauga-check-'));
try {
  await validateReleaseImageDelivery(fileURLToPath(new URL('../public/',import.meta.url)));
  await preparePublication(stage);
  const report = await validate(stage, {enforcePublicationSize:false});
  const publicationDerivatives = await validatePublicationDerivatives(stage);
  const releaseImageDelivery = await offloadReleaseImages(stage);
  const assetDelivery = await offloadValidatedAssets(stage);
  console.log(JSON.stringify({publicationDerivatives, assetDelivery, releaseImageDelivery, strictSizeGate:assetDelivery.publishedBytes < 1_000_000_000}, null, 2));
} finally { await rm(stage, {recursive: true, force: true}); }
