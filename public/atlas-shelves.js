// Browsers handle trackpad swipes, touch, keyboard focus and horizontal scrolling natively.
for (const track of document.querySelectorAll('[data-picture-shelf]')) {
  const section = track.closest('section');
  const toolbar = document.createElement('div');
  toolbar.className = 'shelf-controls';
  const heading = section.querySelector('h2');
  const buttons = [-1, 1].map(direction => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = direction < 0 ? '←' : '→';
    button.setAttribute('aria-label', (direction < 0 ? 'Previous' : 'Next') + ' ' + heading.textContent.toLowerCase());
    button.addEventListener('click', () => {
      const first = track.firstElementChild;
      const stride = first.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
      track.scrollBy({left:direction * stride * Math.max(1, Math.floor(track.clientWidth / stride)),
        behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    });
    toolbar.append(button);
    return button;
  });
  const header = section.querySelector(':scope > header');
  if (header) header.append(toolbar);
  else {
    const row = document.createElement('header');
    row.className = 'shelf-heading';
    heading.before(row);
    row.append(heading, toolbar);
  }
  function sync() {
    const last = track.scrollWidth - track.clientWidth;
    toolbar.hidden = last < 2;
    buttons[0].disabled = track.scrollLeft < 2;
    buttons[1].disabled = track.scrollLeft >= last - 2;
  }
  track.addEventListener('scroll', sync, {passive:true});
  new ResizeObserver(sync).observe(track);
  sync();
}

const directory = document.querySelector('.place-directory');
directory?.addEventListener('click', event => {
  const chosen = event.target.closest('.place-card');
  if (chosen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    history.replaceState({...history.state, placeReturn:{id:chosen.id, top:chosen.getBoundingClientRect().top}}, '');
  }
});
if (directory) window.addEventListener('pageshow', () => {
  const entry = history.state?.placeReturn;
  const link = entry && document.getElementById(entry.id);
  if (!link) return;
  const offset = link.getBoundingClientRect().top - entry.top;
  if (Math.abs(offset) > 1) window.scrollBy({top:offset, behavior:'instant'});
  link.focus({preventScroll:true});
  const {placeReturn, ...other} = history.state;
  history.replaceState(other, '');
});

const back = document.querySelector('[data-back-to-region]');
if (back && document.referrer) {
  const previous = new URL(document.referrer);
  const target = new URL(back.href);
  if (previous.origin === target.origin && previous.pathname === target.pathname && history.length > 1) {
    back.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      history.back();
    });
  }
}
