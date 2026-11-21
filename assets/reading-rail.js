// Native fragment links remain usable when JavaScript or motion is unavailable.
function attachReadingRail(rail) {
  const viewport = rail.querySelector('[data-rail-viewport]');
  const track = rail.querySelector('[data-rail-track]');
  if (!viewport || !track) return;
  const entries = Array.from(track.querySelectorAll('a[href^="#"]'), link => ({
    link, section: document.getElementById(decodeURIComponent(link.hash.slice(1)))
  })).filter(item => item.section);
  if (!entries.length) return;

  const compact = matchMedia('(max-width: 740px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const label = rail.dataset.railLabel || 'Section';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reading-rail-toggle';
  const caption = document.createElement('span');
  caption.textContent = label;
  const value = document.createElement('strong');
  const chevron = document.createElement('i');
  chevron.setAttribute('aria-hidden','true');
  button.append(caption, value, chevron);
  viewport.id ||= (track.closest('main')?.id || 'page') + '-reading-menu';
  button.setAttribute('aria-controls',viewport.id);
  const marker = document.createElement('span');
  marker.className = 'reading-rail-marker';
  marker.setAttribute('aria-hidden','true');
  track.prepend(marker);
  rail.prepend(button);
  rail.dataset.railReady = '';
  for (const {section} of entries) section.dataset.railSection = '';
  const header = document.querySelector('.site-header');

  let active, expanded = false, queued = false, lastClick;
  const labelFor = link => link.dataset.railTitle || link.getAttribute('aria-label') || link.textContent.trim();
  function placeMarker() {
    if (!active || (compact.matches && !expanded)) return;
    const bounds = active.link.getBoundingClientRect();
    const host = track.getBoundingClientRect();
    marker.style.setProperty('--marker-x', (bounds.left - host.left) + 'px');
    marker.style.setProperty('--marker-y', (bounds.top - host.top) + 'px');
    marker.style.setProperty('--marker-width', bounds.width + 'px');
    marker.style.setProperty('--marker-height', bounds.height + 'px');
    if (!track.hasAttribute('data-marker-ready')) {
      // Paint the initial position before enabling transitions.
      marker.getBoundingClientRect();
      track.setAttribute('data-marker-ready','');
    }
  }
  function revealLink(instant) {
    if (!active || (compact.matches && !expanded)) return;
    const bounds = active.link.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    const delta = bounds.top < frame.top ? bounds.top - frame.top
      : bounds.bottom > frame.bottom ? bounds.bottom - frame.bottom : 0;
    if (delta) viewport.scrollBy({top:delta, behavior: instant || reducedMotion.matches ? 'instant' : 'smooth'});
  }
  function select(entry, instant = false) {
    if (!entry) return;
    const changed = active !== entry;
    if (changed) {
      active?.link.removeAttribute('aria-current');
      active = entry;
      entry.link.setAttribute('aria-current','location');
      const title = labelFor(entry.link);
      value.textContent = title;
      button.setAttribute('aria-label',label + ': ' + title);
    }
    if (changed || instant) {
      placeMarker();
      revealLink(instant);
    }
  }
  function measure() {
    queued = false;
    const root = document.scrollingElement || document.documentElement;
    const padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || header?.offsetHeight || 0;
    const margin = parseFloat(getComputedStyle(entries[0].section).scrollMarginTop) || 0;
    const line = padding + margin + 2;
    let current = entries[0];
    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top > line) break;
      current = entry;
    }
    if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
      current = lastClick && lastClick.section.getBoundingClientRect().top >= line - 3 ? lastClick : entries.at(-1);
    }
    select(current);
  }
  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(measure);
    }
  }
  function menu(open) {
    expanded = compact.matches && open;
    rail.toggleAttribute('data-rail-open', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    if (expanded) {
      placeMarker();
      revealLink(true);
    }
  }
  function resize() {
    if (!compact.matches && expanded) menu(false);
    measure();
    placeMarker();
    revealLink(true);
  }
  button.addEventListener('click', () => menu(!expanded));
  button.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      menu(true);
      active?.link.focus({preventScroll:true});
    }
  });
  rail.addEventListener('keydown', event => {
    if (expanded && event.key === 'Escape') {
      menu(false);
      button.focus({preventScroll:true});
    }
  });
  track.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    lastClick = entries.find(entry => entry.link === link);
    if (expanded) menu(false);
    select(lastClick);
  });
  for (const type of ['pointerdown','focusin']) document.addEventListener(type, event => {
    if (expanded && !rail.contains(event.target)) menu(false);
  });
  for (const type of ['wheel','touchstart','keydown']) window.addEventListener(type, event => {
    if (!rail.contains(event.target)) lastClick = null;
  }, {passive:true});
  for (const type of ['scroll','hashchange','pageshow','load']) window.addEventListener(type,schedule,{passive:true});
  window.addEventListener('resize', resize, {passive:true});
  document.fonts?.ready.then(resize);
  menu(false);
  measure();
}
document.querySelectorAll('[data-reading-rail]').forEach(attachReadingRail);
