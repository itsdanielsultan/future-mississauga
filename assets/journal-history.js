// Old shared links land on the same paragraph in its dated story.
function forwardHistoricalLink() {
  if (!location.hash) return;
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id)?.dataset.storyJump;
  if (target) location.replace(new URL(target, location.href).href);
}

const list = document.querySelector('.journal-index');
if (list) {
  forwardHistoricalLink();
  window.addEventListener('hashchange', forwardHistoricalLink);
  list.addEventListener('click', event => {
    const card = event.target.closest('.journal-card');
    if (!card || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const row = card.closest('.journal-day');
    const position = {id:row.id, offset:row.getBoundingClientRect().top, anchored:location.hash === '#' + row.id};
    try {
      history.replaceState({...history.state, journalReturn:position}, '');
      // Native focus restoration can centre the card after pageshow. This
      // history entry owns its return position, so restore it relative to the row.
      history.scrollRestoration = 'manual';
    } catch { /* A static file still has a working dated fallback link. */ }
  });
  window.addEventListener('pageshow', event => {
    const position = history.state?.journalReturn;
    if (!position || !(event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward')) return;
    const row = document.getElementById(position.id);
    if (!row) return;
    const restore = () => {
      if (position.anchored) row.scrollIntoView({block:'start', behavior:'instant'});
      else if (Number.isFinite(position.offset)) window.scrollBy({top:row.getBoundingClientRect().top - position.offset, behavior:'instant'});
    };
    // Use the final font metrics and the browser's completed history traversal.
    // Manual scrolling by the reader always takes precedence over late layout.
    let moved = false;
    const stop = () => { moved = true; };
    const events = ['wheel','touchstart','pointerdown','keydown'];
    for (const type of events) window.addEventListener(type, stop, {capture:true,passive:true});
    restore();
    Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!moved) restore();
      for (const type of events) window.removeEventListener(type, stop, true);
    })));
  });
}

const back = document.querySelector('[data-updates-back]');
// Historical redirects replace the index history entry and retain a fragment.
// Their Back to updates link must open the dated row directly.
if (back && !location.hash && document.referrer) {
  const from = new URL(document.referrer);
  const index = new URL(back.href);
  if (from.origin === index.origin && from.pathname === index.pathname && history.length > 1) {
    back.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.back();
    });
  }
}
