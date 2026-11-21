import {syncComparisonLinks} from './skyline-scenarios.js?v=20261120-player2';
const player = document.querySelector('.screening-video');
const chapters = document.querySelector('.film-chapters');

if (player && chapters) {
  const buttons = [...chapters.querySelectorAll('[data-second]')];
  const address = () => window.fmLocal?.historyURL() || new URL(document.URL);
  const controls = document.querySelector('.film-controls');
  const play = controls.querySelector('.film-play');
  const scrub = controls.querySelector('.film-seek');
  const clock = controls.querySelector('.film-time');
  const mapLink = document.querySelector('.site-map-action');
  const pictures = document.querySelector('.film-fallback a');
  let pending = null;
  let selectedChapter;

  function markStage() {
    const active = buttons.filter(button => Number(button.dataset.second) <= (pending ?? player.currentTime)).at(-1);
    if (active !== selectedChapter) {
      selectedChapter?.removeAttribute('aria-current');
      active?.setAttribute('aria-current', 'step');
      selectedChapter = active;
      syncComparisonLinks(document, address(), active?.dataset.scenario);
      if (active && pictures) pictures.href = 'index.html?scenario=' + active.dataset.scenario + '#skyline';
      if (active && mapLink) {
        const destination = new URL('explore.html', document.baseURI);
        destination.searchParams.set('district', 'downtown');
        destination.searchParams.set('scenario', active.dataset.scenario);
        destination.searchParams.set('appearance', 'status');
        mapLink.href = destination.href;
      }
    }
    if (Number.isFinite(player.duration)) {
      const time = second => Math.floor(second / 60) + ':' + String(Math.floor(second % 60)).padStart(2, '0');
      scrub.max = player.duration;
      scrub.value = player.currentTime;
      clock.textContent = time(player.currentTime) + ' / ' + time(player.duration);
      scrub.setAttribute('aria-valuetext', time(player.currentTime) + ' of ' + time(player.duration));
      scrub.style.setProperty('--played', (100 * player.currentTime / player.duration) + '%');
    }
  }
  function markPlayback() {
    const playing = !player.paused && !player.ended;
    play.dataset.playing = String(playing);
    const label = playing ? 'Pause film' : player.ended ? 'Replay film' : 'Play film';
    play.title = label;
    play.setAttribute('aria-label', label);
  }
  function togglePlayback() {
    if (player.paused || player.ended) player.play().catch(markPlayback);
    else player.pause();
  }
  function rememberFrame() {
    if (pending !== null || !Number.isFinite(player.duration)) return;
    const url = address();
    const time = Math.round(player.currentTime * 100) / 100;
    if (time) url.searchParams.set('t', String(time));
    else url.searchParams.delete('t');
    if (selectedChapter) url.searchParams.set('stage',selectedChapter.dataset.scenario);
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
    const selected = buttons.find(button => button.dataset.scenario === url.searchParams.get('stage'));
    const value = Number(url.searchParams.get('t') ?? selected?.dataset.second ?? 0);
    pending = Number.isFinite(value) ? value : 0;
    seek();
  }
  for (const button of buttons) button.addEventListener('click', () => {
    pending = Number(button.dataset.second);
    seek();
  });
  play.addEventListener('click', togglePlayback);
  player.addEventListener('click', () => { if (!player.controls) togglePlayback(); });
  scrub.addEventListener('input', () => {
    if (Number.isFinite(player.duration)) player.currentTime = Number(scrub.value);
    markStage();
  });
  for (const event of ['play', 'pause', 'ended']) player.addEventListener(event, markPlayback);
  player.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key.toLowerCase() === 'k' || event.key === ' ') {
      event.preventDefault();
      togglePlayback();
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
    expand.title = expanded ? 'Exit full screen' : 'Enter full screen';
    expand.setAttribute('aria-label', expand.title);
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
    controls.hidden = failed;
    player.controls = failed;
  }
  player.addEventListener('error', showAvailability);
  player.querySelector('source')?.addEventListener('error', () => {
    chapters.hidden = true;
    fallback.hidden = false;
    controls.hidden = true;
    player.controls = true;
  });
  player.addEventListener('loadedmetadata', showAvailability);
  showAvailability();
  restore();
  markStage();
  markPlayback();
}
