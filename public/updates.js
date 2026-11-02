// Existing entry URLs remain usable when their dated archive is collapsed.
export function revealUpdateHash(hash, doc = document) {
  if (!hash || hash === '#') return false;
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return false; }
  const target = doc.getElementById(id);
  if (!target || !target.closest('.recent-updates')) return false;
  const ancestors = [];
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') ancestors.unshift(parent);
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
