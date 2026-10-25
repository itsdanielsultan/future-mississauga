import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {preparePublication, validatePublicationDerivatives} from './prepare-publication.mjs';
import {validate} from './validate.mjs';
const stage = await mkdtemp(join(tmpdir(), 'future-mississauga-check-'));
try {
  await preparePublication(stage);
  const report = await validate(stage);
  console.log(JSON.stringify({publicationDerivatives: await validatePublicationDerivatives(stage), strictSizeGate: report.publishedBytes < 1_000_000_000}, null, 2));
} finally { await rm(stage, {recursive: true, force: true}); }
