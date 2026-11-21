import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {nextMapLocation} from '../public/map-location.js';

const site = new URL('../public/', import.meta.url);
const read = file => readFile(new URL(file, site), 'utf8');
const base = 'https://futuremississauga.com/';
test('a skyline scenario survives a map selection and a district change clears the old building', () => {
  const map = new URL('explore.html?district=downtown&scenario=construction', base);
  const building = nextMapLocation(map, {district:'downtown', project:'mcity-1-2'});
  assert.equal(building.searchParams.get('scenario'), 'construction');
  assert.equal(building.searchParams.get('project'), 'mcity-1-2');
  const district = nextMapLocation(building, {district:'port-credit'});
  assert.equal(district.searchParams.get('project'), null);
  assert.equal(district.searchParams.get('scenario'), 'construction');
  assert.equal(map.searchParams.get('project'), null);
});
test('every link in the building directory resolves to its own model, study or city project', async () => {
  const {entries} = JSON.parse(await read('data/building-catalogue.json'));
  const pages = new Map();
  for (const entry of entries) {
    for (const link of entry.links) {
      const url = new URL(link.url, base);
      assert.equal(url.origin, new URL(base).origin);
      if (link.kind === 'model') assert.equal(url.searchParams.get('model'), entry.id);
      if (link.kind === 'city' && entry.projectId && url.searchParams.has('project')) assert.equal(url.searchParams.get('project'), entry.projectId);
      if (link.kind === 'study') {
        assert.equal(url.hash.slice(1), entry.id);
        if (!pages.has(url.pathname)) pages.set(url.pathname,await read(url.pathname.slice(1)));
        assert.ok(pages.get(url.pathname).includes('id="' + entry.id + '"'));
      }
    }
  }
});
test('all public page headers share the main destinations and the same interface stylesheet', async () => {
  const pages = (await readdir(site)).filter(name => name.endsWith('.html'));
  const sitemap = await read('sitemap.xml');
  for (const page of pages) {
    const html = await read(page);
    const nav = html.match(/<nav class="site-nav"[^>]*>(.*?)<\/nav>/s);
    assert.ok(nav, page);
    assert.deepEqual([...nav[1].matchAll(/href="([^"]+)"/g)].map(m=>m[1]), ['neighbourhoods.html','model.html','compare.html','gallery.html','updates.html','downloads.html','sources.html','contact.html']);
    const footer = html.match(/<footer class="compact-footer"[^>]*>(.*?)<\/footer>/s)?.[1];
    assert.ok(footer, page);
    assert.doesNotMatch(footer, /<nav|href="(?:about|suggestions|downloads|sources)\.html/, page);
    assert.match(footer, /class="footer-identity"/, page);
    assert.doesNotMatch(footer, /footer-attribution/, page);
    const canonical = base + (page === 'index.html' ? '' : page);
    const declared = html.match(/<link\b(?=[^>]*rel="canonical")[^>]*>/i)?.[0].match(/href="([^"]+)"/)?.[1];
    const isPrivate = /<meta\b(?=[^>]*name="robots")(?=[^>]*content="[^"]*noindex)[^>]*>/i.test(html);
    assert.equal(sitemap.includes('<loc>'+canonical+'</loc>'), declared===canonical && !isPrivate, page);
    assert.match(html, /<main\b(?=[^>]*id="main")(?=[^>]*tabindex="-1")[^>]*>/, page);
    const header = html.match(/<header class="site-header"[^>]*>(.*?)<\/header>/s)[1];
    assert.match(header, /class="site-brand" href="index.html"/);
    assert.match(header, /class="site-map-action" href="explore\.html(?:[?][^"]*)?"/);
    assert.match(html,/href="atlas-interface\.css\?v=/);
  }
});

test('a copied camera keeps the complete local view and produces a portable address for the Mac edition', async () => {
  const {sharedMapURL,readMapFrame} = await import('../public/map-location.js');
  const view={district:'downtown',project:'mcity-1-2',building:'mcity-m1',scenario:'comparison',split:.32,
    target:[-5584.3,85,415.74],position:[-5420,275.1,698.3]};
  const url=sharedMapURL('file:///example/explore.html',view);
  assert.equal(url.origin, new URL(base).origin);
  assert.deepEqual(readMapFrame(url.searchParams.get('view')),{target:view.target,position:view.position});
  assert.equal(url.searchParams.get('building'),'mcity-m1');
  assert.equal(url.searchParams.get('split'),'32');
  const replay=nextMapLocation(url,{district:'downtown',project:'mcity-1-2',building:'mcity-m1'});
  assert.equal(replay.searchParams.get('view'),url.searchParams.get('view'));
  const changed=nextMapLocation(url,{district:'lakeview'});
  assert.equal(changed.searchParams.has('view'),false);
  assert.equal(changed.searchParams.has('building'),false);
  for(const invalid of [null,'1,2,3,4,5','1,2,3,4,-10,5','1,2,3,4,1e100,6','1,2,3,4,260000,5']){
    assert.equal(readMapFrame(invalid),null);
  }
});
