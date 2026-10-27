import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {preparePublication, validatePublicationDerivatives} from './prepare-publication.mjs';
import {validate} from './validate.mjs';
import {offloadValidatedAssets} from './offload-assets.mjs';
const stage = await mkdtemp(join(tmpdir(), 'future-mississauga-check-'));
try {
  await preparePublication(stage);
  const report = await validate(stage, {enforcePublicationSize:false});
  const publicationDerivatives = await validatePublicationDerivatives(stage);
  const assetDelivery = await offloadValidatedAssets(stage);
  console.log(JSON.stringify({publicationDerivatives, assetDelivery, strictSizeGate:assetDelivery.publishedBytes < 1_000_000_000}, null, 2));
} finally { await rm(stage, {recursive: true, force: true}); }
