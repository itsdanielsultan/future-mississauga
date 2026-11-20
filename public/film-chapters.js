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
    player.pause();
    pending = Number(button.dataset.second);
    seek();
  });
  player.addEventListener('loadedmetadata', seek);
  player.addEventListener('timeupdate', markStage);
  player.addEventListener('seeked', () => { markStage(); rememberFrame(); });
  player.addEventListener('pause', rememberFrame);
  window.addEventListener('pagehide', rememberFrame);
  window.addEventListener('popstate', restore);
  player.addEventListener('error', () => { chapters.hidden = true; });
  chapters.hidden = Boolean(player.error);
  restore();
  markStage();
}
