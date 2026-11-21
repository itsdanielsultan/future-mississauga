import {requestedStage} from './skyline-route.js';

// Swapping the complete plate keeps the caption, north arrow and files together.
export function selectHomePlate(figure, selection) {
  const button = figure.parentElement.querySelector('[data-plate-state="' + selection + '"]');
  if (!button) return;
  const map = figure.parentElement.querySelector('[data-home-map]');
  if (map) map.href = 'explore.html?district=downtown&scenario=' + selection + '&appearance=status';
  const image = figure.querySelector('#heroImage');
  image.srcset = button.dataset.small + ' 1200w, ' + button.dataset.large + ' 2560w';
  image.src = button.dataset.small;
  image.alt = button.dataset.description;
  const open = figure.querySelector('.plate-open');
  open.href = button.dataset.original;
  open.dataset.previewDownload = button.dataset.original;
  open.dataset.previewTitle = button.dataset.title;
  open.setAttribute('aria-label','Enlarge ' + button.dataset.title);
  figure.querySelector('[data-plate-download]').href = button.dataset.original;
  figure.querySelector('[data-plate-print]').href = button.dataset.print;
  figure.querySelector('[data-plate-caption]').textContent = button.dataset.title;
  for (const option of figure.parentElement.querySelectorAll('[data-plate-state]')) {
    option.setAttribute('aria-pressed',String(option === button));
  }
}
const plate = document.querySelector('.city-plate');
if (plate) {
  const group = plate.parentElement.querySelector('.home-plate-switch');
  if (group) {
    const address = () => window.fmLocal?.historyURL() || new URL(location.href);
    function returnToComparison(url, stage) {
      for (const link of document.querySelectorAll('a[href^="compare.html"]')) {
        const dest = new URL(link.getAttribute('href'), document.baseURI);
        if (dest.searchParams.has('mode')) continue;
        for (const key of ['area','split']) {
          if (url.searchParams.has(key)) dest.searchParams.set(key, url.searchParams.get(key));
          else dest.searchParams.delete(key);
        }
        if (stage) dest.searchParams.set('stage', stage);
        else dest.searchParams.delete('stage');
        link.setAttribute('href', 'compare.html' + dest.search + dest.hash);
      }
    }
    function restore() {
      const url = address();
      const stage = requestedStage(url);
      selectHomePlate(plate, stage || 'future');
      returnToComparison(url, stage);
    }
    group.hidden = false;
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-plate-state]');
      if (!button) return;
      const stage = button.dataset.plateState;
      const url = address();
      url.searchParams.set('scenario',stage);
      if (window.fmLocal) window.fmLocal.writeHistory('replaceState',history.state,'',url);
      else history.replaceState(history.state,'',url);
      selectHomePlate(plate,stage);
      returnToComparison(url, stage);
    });
    window.addEventListener('popstate',restore);
    restore();
  }
}
