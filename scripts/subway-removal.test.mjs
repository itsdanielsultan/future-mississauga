import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';

const publicRoot = new URL('../public/', import.meta.url);
const absent = async path => {
  await assert.rejects(access(new URL(path, publicRoot)), {code: 'ENOENT'}, path);
};

test('the retired Subway page and exclusive presentation files are absent', async () => {
  for (const path of [
    'subway.html', 'subway.js', 'subway.css', 'subway-accordions.js',
    'data/subway-map.json', 'data/subway-sources.json', 'data/subway-transit-context.json',
    'assets/subway/subway-corridor-context.metadata.json',
    'assets/subway/2001-city-centre-original.png', 'assets/subway/2001-kipling-dixie-original.png',
    'assets/subway/dundas-subway-alternatives-original.png', 'assets/subway/downtown-context.png',
    'assets/subway/subway-corridor-context.png',
  ]) await absent(path);
});

test('navigation, page content and sitemap no longer send visitors to the removed page', async () => {
  for (const name of await readdir(publicRoot)) {
    if (!name.endsWith('.html') && name !== 'sitemap.xml') continue;
    const text = await readFile(new URL(name, publicRoot), 'utf8');
    assert.doesNotMatch(text, /(?:href|src)=["'][^"']*(?:subway\.html|subway\.js|subway-accordions\.js|subway\.css|assets\/subway\/|data\/subway-(?:map|sources|transit-context)\.json)/i, name);
    if (name === 'sitemap.xml') assert.doesNotMatch(text, /subway\.html/, name);
  }
});

test('archived Toronto context retains its source licence metadata and delivery records', async () => {
  const credits = await readFile(new URL('licenses/CREDITS.md', publicRoot), 'utf8');
  assert.match(credits, /Open Government Licence – Toronto/);
  assert.match(credits, /\.\.\/data\/subway-toronto-context\.json/);
  await access(new URL('data/subway-toronto-context.json', publicRoot));
  const policy = JSON.parse(await readFile(new URL('../scripts/asset-delivery-policy.json', publicRoot), 'utf8'));
  for (const name of ['subway-coastal-water', 'subway-milton-go-context', 'subway-toronto-context', 'subway-toronto-massing']) {
    assert.ok(policy.assets.some(row => row.path === `models/${name}.glb`), name);
    await access(new URL(`models/${name}.glb`, publicRoot));
  }
});
