export function studyMatches(row, query, area) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [row.title, row.area, row.address].filter(Boolean).join(' ').toLocaleLowerCase();
  return (!area || row.area === area) && words.every(word => text.includes(word));
}

function installStudyDirectory(form) {
  const main = form.closest('main');
  const directory = main.querySelector('.study-list');
  const search = form.querySelector('[type="search"]');
  const area = form.querySelector('[data-study-area]');
  const status = form.querySelector('[role="status"]');
  const sections = [...main.querySelectorAll('.render-project, .model-change')];
  const groups = [...directory.querySelectorAll('.study-directory-group')];
  const items = [...directory.querySelectorAll('[data-study-link]')].map(link => ({
    id: link.dataset.studyLink, link, area: link.dataset.area,
    title: link.querySelector('span').textContent, address: link.dataset.address
  }));
  for (const name of [...new Set(items.map(item => item.area))].sort((a,b) => a.localeCompare(b))) {
    area.add(new Option(name, name));
  }
  const getSection = () => {
    let anchor;
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    return anchor ? document.getElementById(anchor)?.closest('.render-project, .model-change') : null;
  };

  function filter() {
    const query = search.value;
    const matches = items.filter(item => {
      const visible = studyMatches(item, query, area.value);
      item.link.parentElement.hidden = !visible;
      return visible;
    });
    for (const group of groups) group.hidden = !group.querySelector('li:not([hidden])');
    status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' study' : ' studies') : 'No studies match. Try another name or area.';
  }

  function show() {
    const selected = getSection();
    main.classList.toggle('study-open', Boolean(selected));
    directory.hidden = form.hidden = Boolean(selected);
    for (const section of sections) section.hidden = section !== selected;
    if (!selected) {
      const url = new URL(location.href);
      search.value = url.searchParams.get('q') || '';
      area.value = url.searchParams.get('area') || '';
      filter();
    }
    return selected;
  }

  function changeFilter() {
    const url = new URL(location.href);
    for (const [key,value] of [['q',search.value],['area',area.value]]) {
      if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
    }
    history.replaceState(history.state,'',url);
    filter();
  }
  function focusCard() {
    const saved = history.state?.studyIndex;
    const card = items.find(item => item.id === saved?.id)?.link;
    if (!card || card.parentElement.hidden) return;
    card.focus({preventScroll:true});
    window.scrollBy({top:card.getBoundingClientRect().top - saved.top,behavior:'instant'});
  }

  form.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', changeFilter);
  area.addEventListener('change', changeFilter);
  directory.addEventListener('click', event => {
    const link = event.target.closest('[data-study-link]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const current = new URL(location.href);
    history.replaceState({...history.state, studyIndex:{id:link.dataset.studyLink, top:link.getBoundingClientRect().top}},'',current);
    current.hash = link.hash;
    history.pushState({studyFromDirectory:true},'',current);
    const selected = show();
    const heading = selected.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    selected.scrollIntoView({block:'start',behavior:'instant'});
  });
  main.addEventListener('click', event => {
    if (!event.target.closest('[data-study-back]') || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (history.state?.studyFromDirectory) {
      event.preventDefault();
      history.back();
    }
  });
  window.addEventListener('popstate', () => {
    if (!show()) requestAnimationFrame(focusCard);
  });
  window.addEventListener('hashchange', show);
  show();
}

const form = typeof document !== 'undefined' && document.querySelector('[data-study-browser]');
if (form) installStudyDirectory(form);
