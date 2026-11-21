// Timeline positions match the three named skyline chapters.
const scenarios = [
  {key: 'existing', second: 0},
  {key: 'construction', second: 4},
  {key: 'future', second: 8}
];

// Switching viewing formats should remember the neighbourhood and divider setting.
export function syncComparisonLinks(root, current, selectedStage) {
  const stage = scenarios.find(row => row.key === (selectedStage || current.searchParams.get('scenario') || current.searchParams.get('stage')));
  for (const link of root.querySelectorAll('[data-compare-mode]')) {
    const target = new URL(link.href, root.baseURI);
    for (const key of ['area', 'split']) {
      const value = current.searchParams.get(key);
      if (value === null) target.searchParams.delete(key);
      else target.searchParams.set(key, value);
    }
    const mode = link.dataset.compareMode;
    for (const key of ['stage','scenario']) target.searchParams.delete(key);
    if (mode === 'film' && !current.pathname.endsWith('/film.html')) target.searchParams.delete('t');
    if (stage) {
      target.searchParams.set(mode === 'stages' ? 'scenario' : 'stage', stage.key);
      if (mode === 'film' && !current.pathname.endsWith('/film.html')) target.searchParams.set('t', String(stage.second));
    }
    link.href = target.href;
  }
}
