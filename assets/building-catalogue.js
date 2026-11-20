import {assetURL} from './asset-delivery.js?v=20261113-delivery2';

export function filterBuildings(entries, {query = '', area = '', kind = ''} = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (!area || entry.area === area) && (!kind || entry.links.some(link => link.kind === kind)) && terms.every(term => `${entry.title} ${entry.area} ${entry.address || ''} ${entry.location || ''}`.toLocaleLowerCase().includes(term)));
}

export async function installBuildingCatalogue() {
  const chooser = document.querySelector('#modelChooser');
  if (!chooser) return;
  const [catalogue, features] = await Promise.all(['building-catalogue', 'building-features'].map(async name => {
    const response = await fetch('data/' + name + '.json?v=20261120-buildings', {cache: 'no-store'});
    if (!response.ok) throw new Error('Building catalogue unavailable');
    return response.json();
  }));
  const entries = catalogue.entries.filter(entry => Object.hasOwn(features, entry.id));
  const search = document.querySelector('#buildingSearch'), area = document.querySelector('#buildingArea'), kind = document.querySelector('#buildingKind');
  const grid = document.querySelector('#previewLinks'), count = document.querySelector('#choiceStatus'), more = document.querySelector('#showAllBuildings');
  const featured = [...grid.querySelectorAll('[data-featured]')].map(card => card.dataset.featured);
  let expanded = false;
  [...new Set(entries.map(entry => entry.area))].sort((a, b) => a.localeCompare(b)).forEach(name => area.add(new Option(name, name)));
  const params = new URL(location.href).searchParams;
  search.value = params.get('q') || '';
  for (const [control, key] of [[area, 'area'], [kind, 'view']]) {
    const value = params.get(key);
    if (!value) continue;
    // Keep a named area from an older bookmark even if it has no featured study.
    if (key === 'area' && ![...area.options].some(option => option.value === value)
      && catalogue.entries.some(entry => entry.area === value)) area.add(new Option(value, value));
    if ([...control.options].some(option => option.value === value)) control.value = value;
  }
  expanded = params.get('all') === '1';
  function rememberFilters() {
    const url = new URL(location.href);
    for (const [key, value] of [['q', search.value], ['area', area.value], ['view', kind.value], ['all', expanded ? '1' : '']]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
  }
  function card(entry, level) {
    const article = document.createElement('article');
    article.className = 'building-card';
    const link = document.createElement('a');
    link.className = 'building-card-link';
    const url = new URL('building-' + entry.id + '.html', document.baseURI);
    for (const [key, value] of [['area', area.value], ['q', search.value], ['view', kind.value], ['all', expanded ? '1' : '']]) {
      if (value) url.searchParams.set(key, value);
    }
    link.href = url.href;
    const picture = features[entry.id].displayImage || entry.image;
    const frame = document.createElement('span');
    frame.className = 'building-card-image';
    const img = document.createElement('img');
    img.src = assetURL(picture.url);
    img.width = picture.width;
    img.height = picture.height;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    frame.append(img);
    const title = document.createElement(level);
    title.textContent = features[entry.id].displayName || entry.title;
    link.append(frame, title);
    if (level === 'h2') {
      const location = document.createElement('span');
      location.className = 'building-card-area';
      location.textContent = entry.area;
      link.append(location);
    }
    article.append(link);
    if (entry.credit) {
      const credit = document.createElement('a');
      credit.className = 'study-card-credit';
      credit.href = entry.credit.url;
      credit.textContent = entry.credit.label;
      article.append(credit);
    }
    return article;
  }
  const families = [
    {title: 'M City', ids: ['mcity-pair', 'mcity-m1', 'mcity-m2', 'mcity-m5']},
    {title: 'Edge Towers', ids: ['edge-1', 'edge-2', 'oro']},
    {title: 'Avia', ids: ['avia-1', 'avia-2']},
  ];
  function cardRow(items, level) {
    const row = document.createElement('div');
    row.className = 'building-row';
    row.append(...items.map(entry => card(entry, level)));
    return row;
  }
  function neighbourhood(name, items) {
    const section = document.createElement('section');
    section.className = 'building-area';
    const heading = document.createElement('h2');
    heading.className = 'area-heading';
    heading.textContent = name;
    section.append(heading);
    const singles = new Set(items);
    for (const family of families) {
      const members = family.ids.map(id => items.find(entry => entry.id === id)).filter(Boolean);
      if (members.length < 2) continue;
      const title = document.createElement('h3');
      title.className = 'project-heading';
      title.textContent = family.title;
      section.append(title, cardRow(members, 'h4'));
      members.forEach(entry => singles.delete(entry));
    }
    if (singles.size) section.append(cardRow([...singles], 'h3'));
    return section;
  }
  function render() {
    const matches = filterBuildings(entries, {query: search.value, area: area.value, kind: kind.value});
    const grouped = Boolean(expanded || search.value || area.value || kind.value);
    grid.classList.toggle('is-grouped', grouped);
    if (grouped) {
      const byArea = new Map();
      for (const entry of [...matches].sort((a,b) => a.title.localeCompare(b.title, undefined, {numeric:true}))) {
        if (!byArea.has(entry.area)) byArea.set(entry.area, []);
        byArea.get(entry.area).push(entry);
      }
      grid.replaceChildren(...[...byArea.keys()].sort((a,b)=>a.localeCompare(b)).map(name => neighbourhood(name, byArea.get(name))));
    } else {
      const shown = featured.map(id => entries.find(entry => entry.id === id)).filter(Boolean);
      grid.replaceChildren(...shown.map(entry => card(entry, 'h2')));
    }
    count.textContent = !matches.length ? 'No featured buildings match this search.' : grouped
      ? matches.length + (matches.length === 1 ? ' building' : ' buildings') : 'Featured buildings';
    more.hidden = grouped || matches.length <= featured.length;
    more.textContent = 'See all ' + entries.length + ' buildings';
  }
  for (const control of [search, area, kind]) control.addEventListener(control === search ? 'input' : 'change', () => {expanded = false; rememberFilters(); render();});
  more.addEventListener('click', () => {
    expanded = true;
    rememberFilters();
    render();
    const first = grid.querySelector('.area-heading');
    if (first) { first.tabIndex = -1; first.focus(); }
  });
  render();
}
