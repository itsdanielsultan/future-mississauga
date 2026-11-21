import {setPairImage} from './compare-frames.js';
import {syncComparisonLinks} from './skyline-scenarios.js?v=20261120-player2';
import {legacyStageHome} from './skyline-route.js';
import {bindComparison} from './comparison.js?v=20261023-usability1';

function showPair() {
  const picker = document.getElementById('comparisonDistrict');
  const panel = document.getElementById('pictureCompare');
  const before = document.getElementById('beforePicture');
  const map = document.getElementById('skylineMapLink');
  const place = document.getElementById('comparisonPlace');
  const range = bindComparison({
    panel, clickToJump:true,
    handle:document.getElementById('compareDivider'),
    input:document.getElementById('pictureSlider'),
    onChange:value => { before.style.clipPath = 'inset(0 ' + (100 - value) + '% 0 0)'; },
    onCommit:value => {
      const next = new URL(location.href);
      next.searchParams.set('split', String(Math.round(value * 10) / 10));
      history.replaceState(history.state, '', next);
      syncComparisonLinks(document, next);
    }
  });
  function showArea() {
    const id = picker.value;
    const name = picker.selectedOptions[0].textContent;
    place.href = 'place-' + id + '.html';
    place.textContent = 'Explore ' + name;
    map.href = 'explore.html?district=' + id;
    for (const [image, state] of [[panel.querySelector('img'), 'future'], [before.querySelector('img'), 'existing']]) {
      setPairImage(image, id, name, state);
    }
  }
  function restore() {
    const current = new URL(location.href);
    const area = current.searchParams.get('area');
    picker.value = [...picker.options].some(option => option.value === area) ? area : 'downtown';
    const saved = current.searchParams.get('split');
    const split = Number(saved);
    range.set(saved?.trim() && Number.isFinite(split) ? Math.min(100, Math.max(0, split)) : 50);
    syncComparisonLinks(document, current);
    showArea();
  }
  picker.addEventListener('change', () => {
    const next = new URL(location.href);
    next.searchParams.set('area', picker.value);
    history.replaceState(history.state, '', next);
    syncComparisonLinks(document, next);
    showArea();
  });
  window.addEventListener('popstate', restore);
  restore();
}

const oldView = legacyStageHome(window.fmLocal?.historyURL() || new URL(location.href));
if (oldView) location.replace(oldView.href);
else showPair();
