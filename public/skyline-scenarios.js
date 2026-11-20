// Keep the original select as the fallback and the gallery's source of truth.
const scenarios = [
  {view: 'existingSkyline', key: 'existing', label: 'Today'},
  {view: 'constructionSkyline', key: 'construction', label: 'Construction'},
  {view: 'skyline', key: 'future', label: 'Proposed'}
];

export function installSkylineScenarios(select, mapLink, render) {
  const fallback = select.closest('label');
  const group = document.createElement('fieldset');
  group.className = 'skyline-segments';
  const legend = document.createElement('legend');
  legend.className = 'atlas-sr';
  legend.textContent = 'Downtown aerial scenario';
  group.append(legend);
  for (const {view, label} of scenarios) {
    const option = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'skyline-view';
    radio.value = view;
    radio.setAttribute('aria-controls', 'scenarioImage');
    const text = document.createElement('span');
    text.textContent = label;
    option.append(radio, text);
    group.append(option);
  }
  function apply(key) {
    const scenario = scenarios.find(row => row.key === key) || scenarios[2];
    select.value = scenario.view;
    for (const radio of group.querySelectorAll('input')) radio.checked = radio.value === scenario.view;
    const map = new URL(mapLink.href);
    map.searchParams.set('scenario', scenario.key);
    mapLink.href = map.href;
    render();
  }
  function change(view) {
    const scenario = scenarios.find(row => row.view === view);
    if (!scenario) return;
    const url = new URL(location.href);
    url.searchParams.set('scenario', scenario.key);
    if (url.href !== location.href) history.pushState(history.state, '', url);
    apply(scenario.key);
  }
  group.addEventListener('change', event => change(event.target.value));
  select.addEventListener('change', () => change(select.value));
  fallback.after(group);
  fallback.hidden = true;
  const restore = () => apply(new URL(location.href).searchParams.get('scenario'));
  window.addEventListener('popstate', restore);
  restore();
}

// Switching viewing formats should remember the neighbourhood and divider setting.
export function syncComparisonLinks(root, current) {
  for (const link of root.querySelectorAll('[data-compare-mode]')) {
    const target = new URL(link.href, root.baseURI);
    for (const key of ['area', 'split']) {
      const value = current.searchParams.get(key);
      if (value === null) target.searchParams.delete(key);
      else target.searchParams.set(key, value);
    }
    link.href = target.href;
  }
}
