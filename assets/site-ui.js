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
