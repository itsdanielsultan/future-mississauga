const panels = [...document.querySelectorAll('.subway-details > details')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const states = new Map();
let active = null;
let frame = 0;
let generation = 0;
let pendingResolve = null;
let revealAnimation = null;
let lastWidth = innerWidth;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = progress => 1 - Math.pow(1 - progress, 3);

function cancelTransition(resolveCancelled = true) {
  cancelAnimationFrame(frame);
  if (resolveCancelled) {
    pendingResolve?.(false);
    pendingResolve = null;
  }
  revealAnimation?.cancel();
  revealAnimation = null;
}

function transition(anchor, animate = true, continuation = false) {
  const shouldCorrectScroll = continuation ? active?.scroll !== false : true;
  cancelTransition(!continuation);
  const version = ++generation;
  const startScroll = scrollY;
  const anchorTop = anchor.getBoundingClientRect().top;
  const start = panels.map(panel => panel.getBoundingClientRect().height);
  const oldMinHeight = document.body.style.minHeight;
  root.classList.add('disclosure-transition');
  // Keep the document from clamping its scroll position while measuring the end state.
  document.body.style.minHeight = `${root.scrollHeight}px`;
  for (const panel of panels) {
    panel.open = true;
    panel.style.height = '';
  }
  const end = panels.map(panel => {
    const state = states.get(panel);
    const style = getComputedStyle(panel);
    return state.expanded ? panel.getBoundingClientRect().height
      : state.summary.getBoundingClientRect().height + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  });
  panels.forEach((panel, index) => { panel.style.height = `${end[index]}px`; });
  document.body.style.minHeight = oldMinHeight;
  const endAnchorTop = anchor.getBoundingClientRect().top + scrollY;
  const endScroll = clamp(endAnchorTop - anchorTop, 0, Math.max(0, root.scrollHeight - innerHeight));
  panels.forEach((panel, index) => { panel.style.height = `${start[index]}px`; });
  scrollTo({ top: startScroll, behavior: 'instant' });
  const duration = animate && !reduceMotion.matches ? 360 : 0;
  const begun = performance.now();
  active = { anchor, scroll: shouldCorrectScroll };
  const finished = pendingResolve ? Promise.resolve(false)
    : new Promise(resolve => { pendingResolve = resolve; });

  function finish() {
    if (version !== generation) return;
    for (const panel of panels) {
      panel.open = states.get(panel).expanded;
      panel.style.height = '';
    }
    if (active?.scroll) scrollTo({ top: endScroll, behavior: 'instant' });
    root.classList.remove('disclosure-transition');
    active = null;
    pendingResolve?.(true);
    pendingResolve = null;
    if (animate && reduceMotion.matches) {
      const expanded = panels.find(panel => states.get(panel).expanded);
      if (expanded) revealAnimation = states.get(expanded).content.animate(
        { opacity: [.55, 1] }, { duration: 120, easing: 'linear' }
      );
    }
  }

  function tick(now) {
    if (version !== generation) return;
    const progress = duration ? clamp((now - begun) / duration, 0, 1) : 1;
    const amount = ease(progress);
    panels.forEach((panel, index) => {
      panel.style.height = `${start[index] + (end[index] - start[index]) * amount}px`;
    });
    if (active?.scroll) scrollTo({ top: startScroll + (endScroll - startScroll) * amount, behavior: 'instant' });
    if (progress < 1) frame = requestAnimationFrame(tick);
    else finish();
  }
  if (duration) frame = requestAnimationFrame(tick);
  else finish();
  return finished;
}

function setExpanded(panel, expanded, animate = true) {
  for (const item of panels) {
    const state = states.get(item);
    const next = item === panel ? expanded : (expanded ? false : state.expanded);
    state.expanded = next;
    item.dataset.expanded = String(next);
    state.summary.setAttribute('aria-expanded', String(next));
    state.content.inert = !next;
    if (!next && state.content.contains(document.activeElement)) state.summary.focus({ preventScroll: true });
  }
  return transition(states.get(panel).summary, animate);
}

for (const panel of panels) {
  const summary = panel.querySelector('summary');
  const content = panel.querySelector('.details-content');
  content.id ||= `${panel.id}-content`;
  summary.setAttribute('aria-controls', content.id);
  summary.setAttribute('aria-expanded', String(panel.open));
  content.inert = !panel.open;
  panel.dataset.expanded = String(panel.open);
  states.set(panel, { summary, content, expanded: panel.open });
  summary.addEventListener('click', event => {
    event.preventDefault();
    setExpanded(panel, !states.get(panel).expanded);
  });
  for (const image of content.querySelectorAll('img[width][height]')) {
    image.style.aspectRatio = `${image.getAttribute('width')} / ${image.getAttribute('height')}`;
  }
}

async function revealFragment(fragment, animate) {
  const target = document.getElementById(fragment.slice(1));
  const panel = target?.closest('.subway-details > details');
  if (!panel) return false;
  if (!await setExpanded(panel, true, animate) || !states.get(panel).expanded) return false;
  target.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  return true;
}

document.querySelectorAll('a[href^="#source-"]').forEach(link => {
  link.addEventListener('click', async event => {
    const fragment = link.getAttribute('href');
    if (!document.querySelector(fragment)?.closest('.subway-details > details')) return;
    event.preventDefault();
    if (!await revealFragment(fragment, true)) return;
    history.pushState(null, '', fragment);
    document.querySelector(fragment)?.querySelector('a')?.focus({ preventScroll: true });
  });
});
addEventListener('hashchange', () => revealFragment(location.hash, false));
if (location.hash) revealFragment(location.hash, false);

// A user's own scrolling always takes priority over the panel's scroll correction.
for (const type of ['wheel', 'touchstart']) addEventListener(type, () => {
  if (active) active.scroll = false;
}, { passive: true });
addEventListener('keydown', event => {
  if (active && ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) active.scroll = false;
});

// Retarget genuine content changes, but do not snap on mobile browser-bar height changes.
let resizeFrame = 0;
const remeasure = () => {
  if (!active) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (active) transition(active.anchor, true, true);
  });
};
const sizes = new WeakMap();
const observer = new ResizeObserver(entries => {
  let changed = false;
  for (const entry of entries) {
    const previous = sizes.get(entry.target);
    const height = entry.contentRect.height;
    sizes.set(entry.target, height);
    if (previous > 0 && height > 0 && Math.abs(previous - height) > 1) changed = true;
  }
  if (changed) remeasure();
});
for (const state of states.values()) observer.observe(state.content);
addEventListener('resize', () => {
  if (Math.abs(innerWidth - lastWidth) > 1) {
    lastWidth = innerWidth;
    remeasure();
  }
});
reduceMotion.addEventListener('change', () => {
  if (active) transition(active.anchor, false, true);
});
