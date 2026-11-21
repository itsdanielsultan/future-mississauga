import './updates.js?v=20261102-coherent1';
import {projectStatus,projectStatusDetail,publicModelCaveat,publicProjectLinks} from './project-cards.js?v=20261121-sources';
const search = document.querySelector('#projectFilter'), evidence = document.querySelector('#evidenceFilter'), area = document.querySelector('#accuracyArea'), status = document.querySelector('#accuracyStatus');
const rows = [...document.querySelectorAll('#projectRows tr')];
const namesByRow = new Map(rows.map(row => [row, row.cells[0].querySelector('a').textContent.toLocaleLowerCase()]));
const readable = value => value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
for (const id of [...new Set(rows.map(row => row.dataset.area))].sort()) area.add(new Option(id === 'citywide' ? 'Across Mississauga' : readable(id), id));
function populateStatuses() {
  const selected = status.value;
  status.replaceChildren(new Option('All statuses', ''));
  for (const value of [...new Set(rows.map(row => row.dataset.statusGroup || row.dataset.status))].sort()) status.add(new Option(value, value));
  status.value = [...status.options].some(option => option.value === selected) ? selected : '';
}
populateStatuses();
function update() {
  const query = search.value.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const matches = rows.filter(row => {
    const words = `${row.dataset.search} ${row.dataset.status} ${row.dataset.statusGroup || ''}`.toLocaleLowerCase();
    const matchesSearch = terms.every(term => /^\d+$/.test(term)
      ? words.match(/\d+/g)?.includes(term)
      : words.includes(term));
    return matchesSearch && (evidence.value === 'all' || row.dataset.refined === evidence.value) && (!area.value || row.dataset.area === area.value) && (!status.value || (row.dataset.statusGroup || row.dataset.status) === status.value);
  });
  if (query) {
    const rank = row => {
      const name = namesByRow.get(row);
      if (name === query) return 3;
      if (name.includes(query)) return 2;
      return Number(row.dataset.search.includes(query));
    };
    matches.sort((a, b) => rank(b) - rank(a));
  }
  document.querySelector('#projectRows').replaceChildren(...matches);
  document.querySelector('#matchCount').textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'record' : 'records'}` : 'No projects match these filters.';
}
for (const control of [search, evidence, area, status]) control.addEventListener(control === search ? 'input' : 'change', update);
search.value = new URLSearchParams(location.search).get('q') || ''; update();
// Status text can change the height of 150 rows above a deep link on a phone.
const coverage = document.querySelector('#coverage-notes');
const initialTarget = document.getElementById(location.hash.slice(1));
let pendingAnchor = initialTarget && coverage.contains(initialTarget) ? initialTarget : null;
if (pendingAnchor) {
  const cancel = () => { pendingAnchor = null; };
  for (const input of ['wheel','pointerdown','touchstart','keydown','hashchange']) {
    window.addEventListener(input, cancel, {once:true, passive:true});
  }
}
function evidenceLink(source, compact) {
  const link = document.createElement('a');
  const url = new URL(source.url);
  // Earlier City citations name individual case files but link a ward-wide list.
  if (url.hostname === 'services6.arcgis.com' && /\/Site_Plan_Applications\/FeatureServer\/0\/query$/i.test(url.pathname)
      && /^WARD\s+IN\b/i.test(url.searchParams.get('where') || '')) {
    const cases = [...new Set((source.title || '').match(/\bSP\s+\d{2}\/\d{1,4}(?:\s+W\d+)?\b/gi) || [])];
    if (cases.length) url.searchParams.set('where', 'APP_FILE_NO IN (' + cases.map(id => "'" + id.toUpperCase() + "'").join(',') + ')');
  }
  link.href = url.href;
  const title = source.title && !/^https?:/i.test(source.title) ? source.title : new URL(source.url).hostname.replace(/^www\./, '');
  link.textContent = compact ? 'View source ↗' : title;
  link.title = title;
  link.className = 'accuracy-source';
  if (compact) link.setAttribute('aria-label', 'View source: ' + title);
  return link;
}

function showSources(row, project, review, register) {
  const links = publicProjectLinks(project);
  const byURL = new Map(links.map(source => [source.url, source]));
  const alternatives = (review?.sourceChecks || []).flatMap(key =>
    (register.sourceChecks[key]?.followUp?.references || []).filter(source => source.project === project.id));
  const preferred = [...(review?.additionalEvidence || []).map(url => ({url})), ...alternatives];
  const ordered = new Map();
  for (const source of [...preferred, ...links]) {
    if (!/^https?:\/\//i.test(source.url) || ordered.has(source.url)) continue;
    ordered.set(source.url, byURL.get(source.url) || source);
  }
  const sources = [...ordered.values()];
  if (!sources.length) return;
  const cell = row.querySelector('[data-label="Sources"]');
  const more = row.querySelector('[data-label="Model notes"] details');
  const note = cell.querySelector('small');
  // The primary source is available directly from the filtered register.
  cell.replaceChildren(evidenceLink(sources[0], true));
  if (note) cell.append(note);
  if (sources.length > 1 && more) {
    const heading = document.createElement('p');
    heading.textContent = 'More sources';
    heading.className = 'accuracy-source-heading';
    const list = document.createElement('ul');
    list.className = 'accuracy-source-list';
    for (const source of sources.slice(1)) {
      const item = document.createElement('li');
      item.append(evidenceLink(source, false));
      list.append(item);
    }
    more.append(heading, list);
  }
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load ' + url);
  return response.json();
}

Promise.all([readJSON('data/projects.json'), readJSON('data/building-catalogue.json'), readJSON('data/project-lifecycle-20261121.json').catch(() => null)]).then(([projects, catalogue, register]) => {
  const projectById = new Map(projects.map(project => [project.id, project]));
  const reviews = new Map((register?.projects || []).map(review => [review.id, review]));
  const entryById = new Map(catalogue.entries.map(entry => [entry.projectId, entry]));
  const names = new Map();
  for (const row of rows) {
    const id = new URL(row.querySelector('a').href).searchParams.get('project'), project = projectById.get(id), entry = entryById.get(id);
    if(project) {
      const label=projectStatus(project).label,detail=projectStatusDetail(project),cell=row.querySelector('[data-label="Status"]');
      const group = register?.taxonomy[reviews.get(id)?.lifecycle] || label;
      row.dataset.statusGroup = group;
      cell.replaceChildren(document.createTextNode(group));
      if (detail && detail.toLowerCase() !== group.toLowerCase()) {
        const note = document.createElement('small');
        note.textContent = detail;
        cell.append(note);
      }
      for(const note of row.querySelectorAll('[data-label="Model notes"] p'))if(note.textContent===project.modelCaveat)note.textContent=publicModelCaveat(project);
      showSources(row, project, reviews.get(id), register);
    }
    if(entry) {row.dataset.area = entry.areaId; names.set(entry.areaId, entry.area);}
  }
  const selected = area.value; area.replaceChildren(new Option('All areas',''));
  [...names].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([id,name])=>area.add(new Option(name,id)));
  area.value = [...area.options].some(option => option.value === selected) ? selected : '';
  populateStatuses(); update();
  if (pendingAnchor) requestAnimationFrame(() => {
    pendingAnchor?.scrollIntoView({block:'start', behavior:'instant'});
    pendingAnchor = null;
  });
}).catch(()=>{});
document.querySelector('#coverageVersion').addEventListener('change', event => {document.querySelector('#coverageMap').src = event.target.value === 'current' ? 'assets/local-coverage-map.svg' : 'assets/coverage-before-20261021.svg';});
