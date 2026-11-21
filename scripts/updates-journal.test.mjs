import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);
const read = path => readFileSync(new URL(path, publicRoot), 'utf8');
const index = read('updates.html');
const historyScript = read('journal-history.js');
const days = JSON.parse(readFileSync(new URL('editions/updates/days.json', import.meta.url), 'utf8'));

test('every dated update is in the index, in the rail and on its own readable page', () => {
  const dates = days.map(day => day.date).sort().reverse();
  assert.deepEqual([...index.matchAll(/class="journal-day" id="day-([\d-]+)"/g)].map(match => match[1]), dates);
  assert.deepEqual([...index.matchAll(/href="#day-([\d-]+)"/g)].map(match => match[1]), dates);
  for (const date of dates) {
    const page = 'update-' + date + '.html';
    const story = read(page);
    assert.ok(index.includes('class="journal-card" href="' + page + '"'), date);
    assert.ok(story.includes('data-updates-back href="updates.html#day-' + date + '"'), date);
    assert.ok(story.includes('<time datetime="' + date + '">'), date);
    assert.ok(story.includes('data-section="updates" aria-current="location"'), date);
  }
});

test('old update fragments resolve to existing sections in the correct story', () => {
  for (const [,filename,id] of index.matchAll(/data-story-jump="([^"#]+)#([^"]+)"/g)) {
    assert.ok(read(filename).includes('id="' + id + '"'), filename + '#' + id);
  }
});

test('links between daily updates land on the named paragraph', () => {
  for (const day of days) {
    const filename = 'update-' + day.date + '.html';
    const story = read(filename);
    for (const [, target, id] of story.matchAll(/href="(update-[\d-]+\.html)?#([\w-]+)"/g)) {
      const destination = target ? read(target) : story;
      assert.ok(destination.includes('id="' + id + '"'), filename + ' → ' + (target || filename) + '#' + id);
    }
  }
});

function backHandler(hash, referrer) {
  const origin = 'https://futuremississauga.com/';
  let handler;
  let traversals = 0;
  const back = {
    href:origin + 'updates.html#day-2026-11-01',
    addEventListener(type, fn) { if (type === 'click') handler = fn; },
  };
  const document = {referrer, querySelector:selector => selector === '[data-updates-back]' ? back : null};
  const history = {length:3, back() { traversals++; }};
  vm.runInNewContext(historyScript, {document, history, location:{hash}, URL});
  handler?.({button:0, preventDefault() {}});
  return traversals;
}

test('Back restores the index after a card click and opens a dated row after a legacy redirect', () => {
  const indexUrl = 'https://futuremississauga.com/updates.html';
  assert.equal(backHandler('', indexUrl), 1);
  assert.equal(backHandler('#november-1-m-city', indexUrl), 0);
  assert.equal(backHandler('', 'https://futuremississauga.com/index.html'), 0);
});
