import './updates.js?v=20261102-coherent1';
import {projectStatus,projectStatusDetail,publicModelCaveat} from './project-cards.js?v=20261113-design2';
const search = document.querySelector('#projectFilter'), evidence = document.querySelector('#evidenceFilter'), area = document.querySelector('#accuracyArea'), status = document.querySelector('#accuracyStatus');
const rows = [...document.querySelectorAll('#projectRows tr')];
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
  const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = rows.filter(row => terms.every(term => `${row.dataset.search} ${row.dataset.status}`.toLocaleLowerCase().includes(term)) && (evidence.value === 'all' || row.dataset.refined === evidence.value) && (!area.value || row.dataset.area === area.value) && (!status.value || (row.dataset.statusGroup || row.dataset.status) === status.value));
  document.querySelector('#projectRows').replaceChildren(...matches);
  document.querySelector('#matchCount').textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'record' : 'records'}` : 'No projects match these filters.';
}
for (const control of [search, evidence, area, status]) control.addEventListener(control === search ? 'input' : 'change', update);
search.value = new URLSearchParams(location.search).get('q') || ''; update();
// Reuse the public map's existing short status labels. Exact dated qualifications
// remain visible in each record; the filter does not reinterpret project facts.
Promise.all([fetch('data/projects.json').then(response => response.ok ? response.json() : Promise.reject()), fetch('data/building-catalogue.json?v=20261112-design1').then(response => response.ok ? response.json() : Promise.reject())]).then(([projects, catalogue]) => {
  const projectById = new Map(projects.map(project => [project.id, project]));
  const entryById = new Map(catalogue.entries.map(entry => [entry.projectId, entry]));
  const names = new Map();
  for (const row of rows) {
    const id = new URL(row.querySelector('a').href).searchParams.get('project'), project = projectById.get(id), entry = entryById.get(id);
    if(project) {
      const label=projectStatus(project).label,detail=projectStatusDetail(project),cell=row.querySelector('[data-label="Status"]');
      row.dataset.statusGroup=label;cell.replaceChildren(document.createTextNode(label));
      if(detail&&detail!==label){const note=document.createElement('small');note.textContent=detail;cell.append(note);}
      for(const note of row.querySelectorAll('[data-label="Model notes"] p'))if(note.textContent===project.modelCaveat)note.textContent=publicModelCaveat(project);
    }
    if(entry) {row.dataset.area = entry.areaId; names.set(entry.areaId, entry.area);}
  }
  const selected = area.value; area.replaceChildren(new Option('All areas',''));
  [...names].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([id,name])=>area.add(new Option(name,id)));
  area.value = [...area.options].some(option => option.value === selected) ? selected : '';
  populateStatuses(); update();
}).catch(()=>{});
document.querySelector('#coverageVersion').addEventListener('change', event => {document.querySelector('#coverageMap').src = event.target.value === 'current' ? 'assets/local-coverage-map.svg' : 'assets/coverage-before-20261021.svg';});
