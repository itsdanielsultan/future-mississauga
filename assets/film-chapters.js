import {syncComparisonLinks} from './skyline-scenarios.js';
const player = document.querySelector('.screening-video');
const chapters = document.querySelector('.film-chapters');

if (player && chapters) {
  const buttons = [...chapters.querySelectorAll('[data-second]')];
  const address = () => window.fmLocal?.historyURL() || new URL(document.URL);
  let pending = null;

  function markStage() {
    const active = buttons.filter(button => Number(button.dataset.second) <= player.currentTime).at(-1);
    for (const button of buttons) {
      if (button === active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
  }
  function rememberFrame() {
    if (pending !== null || !Number.isFinite(player.duration)) return;
    const url = address();
    const time = Math.round(player.currentTime * 100) / 100;
    if (time) url.searchParams.set('t', String(time));
    else url.searchParams.delete('t');
    if (url.href === address().href) return;
    if (window.fmLocal) window.fmLocal.writeHistory('replaceState', history.state, '', url);
    else history.replaceState(history.state, '', url);
  }
  function seek() {
    if (pending === null || !Number.isFinite(player.duration)) return;
    const second = Math.max(0, Math.min(pending, player.duration));
    pending = null;
    player.currentTime = second;
    markStage();
  }
  function restore() {
    const url = address();
    syncComparisonLinks(document, url);
    const value = Number(url.searchParams.get('t'));
    pending = Number.isFinite(value) ? value : 0;
    seek();
  }
  for (const button of buttons) button.addEventListener('click', () => {
    pending = Number(button.dataset.second);
    seek();
  });
  player.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (player.paused) player.play().catch(() => {});
      else player.pause();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!Number.isFinite(player.duration)) return;
      event.preventDefault();
      player.currentTime = Math.max(0, Math.min(player.duration,
        player.currentTime + (event.key === 'ArrowLeft' ? -1 : 1)));
    }
  });
  // Full-window playback works in embedded browsers that disallow native full screen.
  const film = player.closest('.screening');
  const expand = document.getElementById('expandScreening');
  let inerted = [];
  let previousFocus = null;
  function updateExpansion() {
    const expanded = document.fullscreenElement === film || film.classList.contains('full-window');
    expand.setAttribute('aria-expanded', String(expanded));
    expand.textContent = expanded ? 'Close expanded film' : 'Expand film';
  }
  function setWindow(expanded) {
    film.classList.toggle('full-window', expanded);
    document.documentElement.classList.toggle('film-window-open', expanded);
    if (expanded) {
      film.setAttribute('role', 'dialog');
      film.setAttribute('aria-modal', 'true');
      film.setAttribute('aria-label', 'Expanded Downtown skyline film');
      for (let branch = film; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
        for (const child of branch.parentElement.children) {
          if (child === branch || child.inert || ['SCRIPT','STYLE','LINK'].includes(child.tagName)) continue;
          child.inert = true;
          inerted.push(child);
        }
      }
      expand.focus({preventScroll:true});
    } else {
      film.removeAttribute('role');
      film.removeAttribute('aria-modal');
      film.removeAttribute('aria-label');
      for (const child of inerted) child.inert = false;
      inerted = [];
      previousFocus?.focus({preventScroll:true});
    }
    updateExpansion();
  }
  async function toggleExpansion() {
    if (film.classList.contains('full-window')) { setWindow(false); return; }
    if (document.fullscreenElement === film) { await document.exitFullscreen(); return; }
    previousFocus = document.activeElement;
    try {
      if (film.requestFullscreen && document.fullscreenEnabled) await film.requestFullscreen();
    } catch { /* Use the in-page player when the host refuses full screen. */ }
    if (document.fullscreenElement !== film) setWindow(true);
    else updateExpansion();
  }
  expand.hidden = false;
  expand.addEventListener('click', toggleExpansion);
  document.addEventListener('fullscreenchange', updateExpansion);
  film.addEventListener('keydown', event => {
    if (event.key === 'Escape' && film.classList.contains('full-window')) {
      event.preventDefault(); setWindow(false);
    } else if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault(); toggleExpansion();
    }
  });
  player.addEventListener('loadedmetadata', seek);
  player.addEventListener('timeupdate', markStage);
  player.addEventListener('seeked', () => { markStage(); rememberFrame(); });
  player.addEventListener('pause', rememberFrame);
  window.addEventListener('pagehide', rememberFrame);
  window.addEventListener('popstate', restore);
  const fallback = document.querySelector('.film-fallback');
  function showAvailability() {
    const source = player.querySelector('source');
    const failed = Boolean(player.error || (source && player.networkState === HTMLMediaElement.NETWORK_NO_SOURCE));
    chapters.hidden = failed;
    fallback.hidden = !failed;
  }
  player.addEventListener('error', showAvailability);
  player.querySelector('source')?.addEventListener('error', () => {
    chapters.hidden = true;
    fallback.hidden = false;
  });
  player.addEventListener('loadedmetadata', showAvailability);
  showAvailability();
  restore();
  markStage();
}
