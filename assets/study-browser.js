export function studyMatches(row, query, area) {
  return (!area || row.area === area) && query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(term => `${row.title} ${row.area}`.toLocaleLowerCase().includes(term));
}

const browser = typeof document === 'undefined' ? null : document.querySelector('[data-study-browser]');
if (browser) {
  const sections = [...document.querySelectorAll('.render-project,.model-change')];
  const rows = sections.map(section => ({section, id: section.id, title: section.querySelector('h2')?.textContent.trim() || section.id, area: section.dataset.area || (section.querySelector('.eyebrow')?.textContent.trim().split(' · ')[0] || 'Mississauga').replace(/^City Centre$/, 'Downtown')}));
  const search = browser.querySelector('[type="search"]'), area = browser.querySelector('[data-study-area]'), choice = browser.querySelector('[data-study-choice]'), count = browser.querySelector('[role="status"]');
  const previous = browser.querySelector('[data-study-previous]'), next = browser.querySelector('[data-study-next]');
  function linkedStudy() {
    if (!location.hash) return rows.find(row => !row.section.hasAttribute('data-archive-study'))?.id;
    let anchor;
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    const target = document.getElementById(anchor);
    return target?.closest('.render-project,.model-change')?.id || null;
  }
  let selected = linkedStudy();
  [...new Set(rows.filter(row => !row.section.hasAttribute('data-archive-study')).map(row => row.area))].sort((a, b) => a.localeCompare(b)).forEach(name => area.add(new Option(name, name)));
  function render({historyMode, missingLink = false} = {}) {
    const matches = rows.filter(row => (!row.section.hasAttribute('data-archive-study') || (row.id === selected && location.hash === '#' + row.id)) && studyMatches(row, search.value, area.value));
    if (!missingLink && !matches.some(row => row.id === selected)) selected = matches[0]?.id;
    choice.replaceChildren(...matches.map(row => new Option(row.title, row.id)));
    if (missingLink) choice.prepend(new Option('Choose a study', ''));
    choice.value = selected || ''; choice.disabled = !matches.length;
    for (const row of rows) row.section.hidden = row.id !== selected;
    const index = matches.findIndex(row => row.id === selected);
    previous.disabled = index <= 0; next.disabled = index < 0 || index >= matches.length - 1;
    count.textContent = matches.length ? `Study ${index + 1} of ${matches.length}` : 'No studies match. Try a different name or area.';
    if (missingLink) count.textContent = 'This study link is unavailable. Choose a study above.';
    if (historyMode && selected && location.hash !== '#' + encodeURIComponent(selected)) history[historyMode](history.state, '', '#' + encodeURIComponent(selected));
  }
  search.addEventListener('input', () => render({historyMode: 'replaceState'}));
  area.addEventListener('change', () => render({historyMode: 'replaceState'}));
  choice.addEventListener('change', () => {selected = choice.value; render({historyMode: 'pushState'});});
  for (const [button, direction] of [[previous, -1], [next, 1]]) button.addEventListener('click', () => {const options = [...choice.options], i = options.findIndex(option => option.value === selected); selected = options[i + direction]?.value || selected; render({historyMode: 'pushState'});});
  addEventListener('hashchange', () => { search.value = ''; area.value = ''; selected = linkedStudy(); render({missingLink: !selected}); });
  browser.addEventListener('submit', event => event.preventDefault());
  render({missingLink: !selected});
}
