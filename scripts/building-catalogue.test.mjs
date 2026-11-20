import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {filterBuildings} from '../public/building-catalogue.js';
import {studyMatches} from '../public/study-browser.js';
import {revealUpdateHash} from '../public/updates.js';
import {cityModelStudies} from '../public/city-model-studies.js';

const root = new URL('../public/', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const catalogue = JSON.parse(await read('data/building-catalogue.json'));
const manifest = JSON.parse(await read('data/model-previews.json'));
const districtNames = new Set(JSON.parse(await read('data/districts.json')).map(row => row.name));
const projects = JSON.parse(await read('data/projects.json'));

test('Subject catalogue keeps every public model query and every study hash reachable', async () => {
  const links = new Set(catalogue.entries.flatMap(entry => entry.links.map(link => link.url)));
  assert.equal(new Set(catalogue.entries.map(entry => entry.id)).size, catalogue.entries.length);
  for (const view of manifest.views) assert(links.has(`model.html?model=${view.id}`), view.id);
  for (const [page, kind] of [['review-renders.html', 'render-project'], ['reference-updates.html', 'model-change']]) {
    const html = await read(page);
    for (const match of html.matchAll(new RegExp(`<section class="${kind}" id="([^"]+)"`, 'g'))) assert(links.has(`${page}#${match[1]}`), match[1]);
  }
  for (const entry of catalogue.entries) {
    assert(entry.title && entry.area && entry.links.length);
    assert(districtNames.has(entry.area), 'Area filter follows the registered map districts');
    for (const link of entry.links) assert.match(link.url, /^(model|review-renders|reference-updates|explore)\.html[?#]/);
    if (entry.image && !entry.image.url.startsWith('http')) await access(new URL(entry.image.url, root));
  }
  for (const project of projects) assert(catalogue.entries.some(entry => entry.projectId === project.id), project.id);
  assert.equal(catalogue.entries.find(entry => entry.id === 'alba').links[0].url, 'explore.html?district=cooksville&project=alba');
});

test('Catalogue search combines words, area and available view without conflating a model with a city link', () => {
  const rows = catalogue.entries;
  assert.deepEqual(filterBuildings(rows, {query: 'aldo 1422'}).map(row => row.id), ['aldo-1422-study']);
  assert.equal(filterBuildings(rows, {query: 'ALDO', area: 'Downtown'}).length, 0);
  assert.equal(filterBuildings(rows, {query: 'aldo', kind: 'model'}).length, 0);
  assert(filterBuildings(rows, {query: 'maritz', kind: 'model'})[0].links.some(link => link.kind === 'study'));
  assert.equal(filterBuildings(rows, {query: 'a building that does not exist'}).length, 0);
});

test('Study filtering accepts multiword addresses and exact native area selection', () => {
  const row = {title: '1422 Aldo Drive', area: 'Lorne Park'};
  assert(studyMatches(row, 'DRIVE 1422', 'Lorne Park'));
  assert(!studyMatches(row, '1422', 'Downtown'));
  assert(!studyMatches(row, '1422 lighthouse', ''));
});

test('Accuracy register retains every dated record while allowing area and status filtering', async () => {
  const html = await read('accuracy-review.html');
  const rows = [...html.matchAll(/<tr data-area="[^"]+" data-status="[^"]*" data-refined="[01]" data-search="[^"]*">/g)];
  assert.equal(rows.length, projects.length);
  const ids = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?project=([^"&]+)[\s\S]*?<\/tr>/g)].map(match => match[1]);
  assert.deepEqual(ids.sort(), projects.map(project => project.id).sort(), 'the register covers every public project exactly once');
  assert(html.includes(`${projects.length} public projects in the city map`));
  for (const id of ['projectFilter','evidenceFilter','accuracyArea','accuracyStatus','coverageVersion']) assert(html.includes(`id="${id}"`));
  assert(!html.includes('showAllRecords'));
  assert(html.includes('A ground check on a 25 m grid found 33 unsupported sample points.'));
  assert(html.includes('Retain only with that status visible.'));
  assert(html.includes('id="october-23-east-credit"'));
});

test('Accuracy uses plain city-map categories and preserves the two added studies’ source limits', async () => {
  const html = await read('accuracy-review.html');
  const refinements = cityModelStudies(JSON.parse(await read('data/refinement-models.json')).assets, manifest);
  assert.match(html, /<label>Model detail<select[^>]*id="evidenceFilter"/);
  assert.match(html, /<option value="1">Added model detail<\/option>/);
  assert.match(html, /<option value="0">No added model detail<\/option>/);
  assert.doesNotMatch(html, /Supplemental model registered|No separate refinement asset/);
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match => match[0]);
  for (const project of projects) {
    const row = rows.find(row => row.includes('project='+project.id+'"'));
    assert(row, project.id);
    const hasDetail = refinements.some(asset => asset.projectId === project.id);
    assert(row.includes(`data-refined="${Number(hasDetail)}"`), project.id+' model category follows actual city assets');
  }
  for (const id of ['sgm-maritz-6710','ergocentric-275-superior']) {
    const project = projects.find(project => project.id === id), row = rows.find(row => row.includes('project='+id+'"'));
    const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
    assert(row.includes(escape(project.geometryCoverage)));
    assert(row.includes(escape(project.modelCaveat)));
    assert(row.includes(`${project.sources.filter(source => source.url).length} linked sources`));
    assert(row.includes('data-status="Existing"'));
  }
});

test('Accuracy fragment links reveal the coverage disclosure and entries inside it', async () => {
  const html = await read('accuracy-review.html');
  assert(html.includes('<details class="accuracy-background" id="coverage-notes">'));
  assert(html.indexOf('id="october-23-east-credit"') > html.indexOf('id="coverage-notes"'));
  const calls = [];
  const coverage = {
    tagName: 'DETAILS', open: false, parentElement: null,
    closest: selector => selector === '.accuracy-background' ? coverage : null,
    hasAttribute: () => false, setAttribute() {},
    focus() { assert(coverage.open); },
    scrollIntoView() { calls.push('coverage'); }
  };
  const entry = {
    ...coverage, tagName: 'SECTION', parentElement: coverage,
    scrollIntoView() { calls.push('entry'); }
  };
  const doc = {getElementById: id => ({'coverage-notes':coverage, 'october-23-east-credit':entry})[id]};
  for (const id of ['coverage-notes','october-23-east-credit']) {
    coverage.open = false;
    assert(revealUpdateHash('#'+id, doc));
    assert(coverage.open);
  }
  assert.deepEqual(calls, ['coverage','entry']);
});
