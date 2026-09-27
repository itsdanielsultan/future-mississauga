const panels = [...document.querySelectorAll('.subway-details > details')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const states = new Map();

function animatePanel(panel, expanded, animate = true) {
  const state = states.get(panel);
  const startHeight = panel.getBoundingClientRect().height;
  state.animation?.cancel();
  state.resolve?.();
  state.animation = null;
  state.resolve = null;
  state.expanded = expanded;
  panel.dataset.expanded = String(expanded);
  state.summary.setAttribute('aria-expanded', String(expanded));
  if (!expanded && state.content.contains(document.activeElement)) {
    state.summary.focus({ preventScroll: true });
  }
  state.content.inert = !expanded;
  panel.open = true;
  panel.style.height = '';
  const style = getComputedStyle(panel);
  const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const endHeight = expanded ? panel.getBoundingClientRect().height
    : state.summary.getBoundingClientRect().height + borderHeight;

  const finish = () => {
    panel.open = state.expanded;
    panel.style.height = '';
    state.animation = null;
    state.resolve?.();
    state.resolve = null;
  };
  if (!animate || reduceMotion.matches || Math.abs(startHeight - endHeight) < 1) {
    finish();
    return Promise.resolve();
  }
  panel.style.height = `${startHeight}px`;
  const duration = Math.min(320, Math.max(180, Math.abs(endHeight - startHeight) * .22));
  const animation = panel.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, {
    duration, easing: 'cubic-bezier(.22,.61,.36,1)'
  });
  state.animation = animation;
  const complete = new Promise(resolve => { state.resolve = resolve; });
  animation.onfinish = () => {
    if (state.animation === animation) finish();
  };
  return complete;
}

function setExpanded(panel, expanded, animate = true) {
  if (expanded) {
    for (const other of panels) {
      if (other !== panel && (states.get(other).expanded || other.open)) {
        animatePanel(other, false, animate);
      }
    }
  }
  return animatePanel(panel, expanded, animate);
}

for (const panel of panels) {
  const summary = panel.querySelector('summary');
  const content = panel.querySelector('.details-content');
  content.id ||= `${panel.id}-content`;
  summary.setAttribute('aria-controls', content.id);
  summary.setAttribute('aria-expanded', String(panel.open));
  content.inert = !panel.open;
  panel.dataset.expanded = String(panel.open);
  states.set(panel, { summary, content, expanded: panel.open, animation: null, resolve: null });
  summary.addEventListener('click', event => {
    event.preventDefault();
    setExpanded(panel, !states.get(panel).expanded);
  });
}

async function revealFragment(fragment, animate) {
  const target = document.getElementById(fragment.slice(1));
  const panel = target?.closest('.subway-details > details');
  if (!panel) return false;
  await setExpanded(panel, true, animate);
  if (!states.get(panel).expanded) return false;
  target.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  return true;
}

document.querySelectorAll('a[href^="#source-"]').forEach(link => {
  link.addEventListener('click', async event => {
    event.preventDefault();
    const fragment = link.getAttribute('href');
    if (!await revealFragment(fragment, true)) return;
    history.pushState(null, '', fragment);
    document.querySelector(fragment)?.querySelector('a')?.focus({ preventScroll: true });
  });
});
addEventListener('hashchange', () => revealFragment(location.hash, false));
if (location.hash) revealFragment(location.hash, false);

// A viewport or motion-preference change settles ongoing animation at its requested state.
const settle = () => {
  for (const panel of panels) {
    const state = states.get(panel);
    if (state.animation) animatePanel(panel, state.expanded, false);
  }
};
addEventListener('resize', settle);
reduceMotion.addEventListener('change', settle);
