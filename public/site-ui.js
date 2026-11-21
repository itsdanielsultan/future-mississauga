const header = document.querySelector('.site-header');
if (header) {
  const toggle = header.querySelector('.site-menu-toggle');
  const nav = header.querySelector('.site-nav');
  const menu = open => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav.toggleAttribute('data-open', open);
  };
  header.dataset.menuReady = '';
  toggle.addEventListener('click', () => menu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) menu(false); });
  const closeWhenOutside = event => {
    if (nav.hasAttribute('data-open') && !header.contains(event.target)) menu(false);
  };
  document.addEventListener('pointerdown', closeWhenOutside);
  document.addEventListener('focusin', closeWhenOutside);
  const compactLayout = window.matchMedia?.('(max-width: 900px)');
  compactLayout?.addEventListener?.('change', () => menu(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      menu(false);
      toggle.focus();
    }
  });
}

// Only a press and release on the actual backdrop dismiss the document.
let pressedBackdrop = null;
function outsideDialog(event) {
  const dialog=event.target;
  if (!dialog.matches?.('dialog.document-preview[open]')) return null;
  const rect=dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom ? dialog : null;
}
document.addEventListener('pointerdown', event => { pressedBackdrop=outsideDialog(event); });
document.addEventListener('pointercancel', () => { pressedBackdrop=null; });
document.addEventListener('click', event => {
  if (pressedBackdrop && pressedBackdrop===outsideDialog(event)) pressedBackdrop.close();
  pressedBackdrop=null;
});

// A district link keeps its place when a reader visits a building and comes back.
const areaLink = document.querySelector('[data-neighbourhood-return]');
if (areaLink && new URLSearchParams(location.search).get('from') === areaLink.dataset.neighbourhoodReturn) {
  const directoryLink = document.querySelector('[data-directory-back]');
  if (directoryLink) {
    directoryLink.href = 'neighbourhoods.html';
    directoryLink.textContent = 'Neighbourhoods';
    directoryLink.removeAttribute('data-directory-back');
  }
}

// The selected rectangle follows the actual item, including wrapped and translated labels.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const trackSelector = '.site-nav, .media-sections, .building-formats, .subject-views, .home-plate-switch, .skyline-segments';
const optionSelector = ':scope > a, :scope > button, :scope > label';
const switchHistoryKey = 'fm.navigation.previous';
const tracks = new Map();

function navigationTarget(address) {
  const url = new URL(address, document.baseURI);
  return url.pathname + url.search;
}
function readPreviousSelection() {
  try {
    const value = JSON.parse(sessionStorage.getItem(switchHistoryKey));
    sessionStorage.removeItem(switchHistoryKey);
    if (value && value.to === navigationTarget(location.href) && Date.now() - value.time < 15000) return value.selected;
  } catch { /* Some local-file browsers do not provide tab storage. */ }
  return {};
}
const previousSelections = readPreviousSelection();

function activeOption(group) {
  return group.querySelector(':scope > [aria-current]:not([aria-current="false"]), :scope > [aria-pressed="true"], :scope > label:has(input:checked)');
}
function trackName(group) {
  return group.getAttribute('aria-label') || group.querySelector('legend')?.textContent || group.id;
}
function markerFrame(box) {
  return { transform: 'translate(' + box.x + 'px,' + box.y + 'px)', width: box.width + 'px', height: box.height + 'px' };
}
function measureOption(group, item) {
  const rail = group.getBoundingClientRect();
  const box = item.getBoundingClientRect();
  return {x: box.left - rail.left - group.clientLeft + group.scrollLeft, y: box.top - rail.top - group.clientTop + group.scrollTop, width: box.width, height: box.height};
}

function mountSwitch(group) {
  if (!group || tracks.has(group)) return;
  const marker = document.createElement('i');
  marker.className = 'switch-indicator';
  marker.setAttribute('aria-hidden', 'true');
  group.append(marker);
  let selected;
  let startIndex = previousSelections[trackName(group)];
  function draw(withMotion) {
    if (!marker.isConnected) group.append(marker);
    const next = activeOption(group);
    if (!next || next.getBoundingClientRect().width === 0) {
      group.removeAttribute('data-switch-ready');
      selected = null;
      return;
    }
    const options = Array.from(group.querySelectorAll(optionSelector));
    const previous = selected || options[startIndex];
    const end = markerFrame(measureOption(group, next));
    const start = previous && previous !== next ? markerFrame(measureOption(group, previous)) : null;
    if (previous !== next || !withMotion) marker.getAnimations().forEach(animation => animation.cancel());
    Object.assign(marker.style, end);
    group.setAttribute('data-switch-ready', '');
    if (start && withMotion && !reducedMotion.matches && previous.getBoundingClientRect().width) {
      marker.animate([start, end], {duration: 180, easing: 'cubic-bezier(.25,.75,.25,1)'});
    }
    selected = next;
    startIndex = undefined;
  }
  tracks.set(group, draw);
  const changes = new MutationObserver(() => draw(true));
  changes.observe(group, {subtree:true, childList:true, attributes:true, attributeFilter:['aria-current','aria-pressed','hidden']});
  group.addEventListener('change', () => draw(true));
  let initialSize = true;
  new ResizeObserver(() => {
    if (!initialSize || !selected) draw(false);
    initialSize = false;
  }).observe(group);
  draw(true);
}

document.querySelectorAll(trackSelector).forEach(mountSwitch);
// The stage controls arrive after the skyline imagery has been read.
const skylineToolbar = document.querySelector('.skyline-toolbar');
if (skylineToolbar && !skylineToolbar.querySelector('.skyline-segments')) {
  const toolbarObserver = new MutationObserver(() => {
    const group = skylineToolbar.querySelector('.skyline-segments');
    if (group) { mountSwitch(group); toolbarObserver.disconnect(); }
  });
  toolbarObserver.observe(skylineToolbar, {childList:true});
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || !link.closest(trackSelector) || link.target || link.hasAttribute('download')) return;
  const selected = {};
  for (const [group] of tracks) {
    const previous = activeOption(group);
    if (previous) selected[trackName(group)] = Array.from(group.querySelectorAll(optionSelector)).indexOf(previous);
  }
  try { sessionStorage.setItem(switchHistoryKey, JSON.stringify({to:navigationTarget(link.href), time:Date.now(), selected})); } catch {}
}, {capture:true});
window.addEventListener('pageshow', event => {
  if (event.persisted) for (const draw of tracks.values()) draw(false);
});
document.fonts?.ready.then(() => { for (const draw of tracks.values()) draw(true); });
