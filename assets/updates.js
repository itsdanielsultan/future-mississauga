// Reveal links into the dated Updates archive and the Accuracy coverage notes.
export function revealUpdateHash(hash, doc = document) {
  if (!hash || hash === '#') return false;
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return false; }
  const target = doc.getElementById(id);
  if (!target || !(target.closest('.recent-updates') || target.closest('.accuracy-background'))) return false;
  const ancestors = [];
  for (let element = target; element; element = element.parentElement) {
    if (element.tagName === 'DETAILS') ancestors.unshift(element);
  }
  for (const details of ancestors) details.open = true;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({preventScroll: true});
  target.scrollIntoView({block: 'start', behavior: 'instant'});
  return true;
}

if (typeof document !== 'undefined') {
  const reveal = () => revealUpdateHash(location.hash);
  reveal();
  window.addEventListener('hashchange', reveal);
  // Reload/BFCache scroll restoration runs after initial module execution.
  // Reapply the fragment in the next frame, after that browser restoration.
  window.addEventListener('pageshow', () => requestAnimationFrame(reveal));
  // Clicking a link to the current hash does not produce a hashchange event.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash === location.hash && revealUpdateHash(url.hash)) event.preventDefault();
  });
}

// Keep the visible reading section marked as the visitor follows or scrolls past it.
if (typeof document !== 'undefined' && document.querySelector) {
  const index = document.querySelector('.publication-index');
  if (index) {
    const entries = Array.from(index.querySelectorAll('a[href^="#"]'), link => ({
      link, section:document.getElementById(link.hash.slice(1))
    })).filter(entry => entry.section);
    const header = document.querySelector('.site-header');
    let queued = false;
    function markSection() {
      queued = false;
      if (!entries.length) return;
      const root = document.scrollingElement || document.documentElement;
      const inset = parseFloat(getComputedStyle(root).scrollPaddingTop) || header?.getBoundingClientRect().height || 0;
      let current = entries[0];
      for (const entry of entries) {
        const margin = parseFloat(getComputedStyle(entry.section).scrollMarginTop) || 0;
        if (entry.section.getBoundingClientRect().top <= inset + margin + 2) current = entry;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) current = entries[entries.length - 1];
      for (const {link} of entries) {
        if (link === current.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    function scheduleMark() {
      if (!queued) {
        queued = true;
        requestAnimationFrame(markSection);
      }
    }
    markSection();
    window.addEventListener('scroll', scheduleMark, {passive:true});
    window.addEventListener('resize', scheduleMark);
    window.addEventListener('pageshow', scheduleMark);
    window.addEventListener('load', scheduleMark);
  }
}
