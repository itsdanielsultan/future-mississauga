export function filterBuildings(entries, {query = '', area = '', kind = ''} = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (!area || entry.area === area) && (!kind || entry.links.some(link => link.kind === kind)) && terms.every(term => `${entry.title} ${entry.area} ${entry.address || ''} ${entry.location || ''}`.toLocaleLowerCase().includes(term)));
}

export function installBuildingCatalogue() {
  const chooser = document.querySelector('#modelChooser');
  if (!chooser) return;
  const search = document.querySelector('#buildingSearch'), area = document.querySelector('#buildingArea'), kind = document.querySelector('#buildingKind');
  const grid = document.querySelector('#previewLinks');
  const count = document.querySelector('#choiceStatus');
  const cards = [...grid.querySelectorAll('[data-building]')];
  const entries = cards.map(card => ({
    id: card.dataset.building,
    area: card.dataset.area,
    title: card.dataset.search,
    links: card.dataset.views.split(' ').map(kind => ({kind})),
  }));
  const archivedAreas = JSON.parse(area.dataset.archivedAreas || '[]');
  const areas = [...grid.querySelectorAll('.building-area')];
  const groups = [...grid.querySelectorAll('.building-group')];
  [...new Set(entries.map(entry => entry.area))].sort((a, b) => a.localeCompare(b)).forEach(name => area.add(new Option(name, name)));
  const params = new URL(location.href).searchParams;
  search.value = params.get('q') || '';
  for (const [control, key] of [[area, 'area'], [kind, 'view']]) {
    const value = params.get(key);
    if (!value) continue;
    // Keep a named area from an older bookmark even if it has no featured study.
    if (key === 'area' && ![...area.options].some(option => option.value === value)
      && archivedAreas.includes(value)) area.add(new Option(value, value));
    if ([...control.options].some(option => option.value === value)) control.value = value;
  }
  function rememberFilters() {
    const url = new URL(location.href);
    for (const [key, value] of [['q', search.value], ['area', area.value], ['view', kind.value]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    url.searchParams.delete('all');
    history.replaceState(history.state, '', url);
  }
  function render() {
    const matches = filterBuildings(entries, {query: search.value, area: area.value, kind: kind.value});
    const matchingIds = new Set(matches.map(entry => entry.id));
    const params = new URLSearchParams(location.search);
    for (const card of cards) {
      card.hidden = !matchingIds.has(card.dataset.building);
      const url = new URL('building-' + card.dataset.building + '.html', document.baseURI);
      for (const key of ['q', 'area', 'view']) {
        if (params.has(key)) url.searchParams.set(key, params.get(key));
      }
      card.querySelector('.building-card-link').href = url.href;
    }
    for (const section of [...groups, ...areas]) {
      section.hidden = !section.querySelector('[data-building]:not([hidden])');
    }
    count.textContent = matches.length
      ? matches.length + (matches.length === 1 ? ' building' : ' buildings')
      : 'No buildings match these filters.';
  }
  for (const control of [search, area, kind]) {
    control.addEventListener(control === search ? 'input' : 'change', () => {
      rememberFilters();
      render();
    });
  }
  render();
}
