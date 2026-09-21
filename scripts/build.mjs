import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {cp, rm} from 'node:fs/promises';
import {validate} from './validate.mjs';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
await validate(join(root, 'public'));
await rm(join(root, 'dist'), {recursive: true, force: true});
await cp(join(root, 'public'), join(root, 'dist'), {recursive: true, dereference: false});
console.log('Static atlas ready in dist/. No server or API is required.');
