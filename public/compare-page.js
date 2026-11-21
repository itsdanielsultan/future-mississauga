import {setPairImage, stageFrame, setStageImage} from './compare-frames.js';
import {loadEditionPlates} from './edition-pictures.js';
import {downtownAerial} from './downtown-aerial.js?v=20261120-tone';
import {installSkylineScenarios, syncComparisonLinks} from './skyline-scenarios.js?v=20261120-plates';
import {createImagePreview} from './image-preview.js?v=20261120-plates';
import {bindComparison} from './comparison.js?v=20261023-usability1';

const url = new URL(location.href);
const isStages = url.searchParams.get('mode') === 'stages' || url.searchParams.has('scenario')
  || location.hash === '#skyline' || location.hash.startsWith('#?scenario');
const activeMode = isStages ? 'stages' : 'pair';

for (const panel of document.querySelectorAll('[data-compare-panel]')) {
  panel.hidden = panel.dataset.comparePanel !== activeMode;
}
for (const link of document.querySelectorAll('[data-compare-mode]')) {
  if (link.dataset.compareMode === activeMode) link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
}
syncComparisonLinks(document, url);

async function showStages() {
  const plates = await loadEditionPlates();
  const frames = Object.fromEntries(Object.entries(downtownAerial).map(([key, source]) => {
    const plate = plates.get('wide/downtown-skyline-' + source.scenario + '.png');
    return [key, stageFrame(source, plate)];
  }));
  const select = document.getElementById('skylineScenario');
  const opener = document.querySelector('[data-aerial-feature]');
  const image = document.getElementById('scenarioImage');
  const download = opener.closest('figure').querySelector('a[download]');
  const labels = {existingSkyline:'Existing buildings', constructionSkyline:'Under construction', skyline:'With proposals'};
  const preview = createImagePreview({views:true});
  opener.addEventListener('click', () => {
    const show = view => {
      const frame = frames[view];
      preview.show({...frame, explore:'explore.html?district=downtown&scenario=' + frame.scenario}, opener);
    };
    preview.setSequence(direction => {
      const keys = Object.keys(labels);
      const field = preview.dialog.querySelector('.media-preview__view select');
      field.value = keys[(keys.indexOf(field.value) + direction + keys.length) % keys.length];
      field.dispatchEvent(new Event('change'));
    });
    preview.setViews(Object.entries(labels).map(([value,label]) => ({value,label})), select.value, show);
    show(select.value);
  });
  installSkylineScenarios(select, document.getElementById('skylineMapLink'), () => {
    const view = select.value;
    const frame = frames[view];
    setStageImage({image, opener, download}, view, frame, labels[view]);
  });
}

function showPair() {
  const picker = document.getElementById('comparisonDistrict');
  const panel = document.getElementById('pictureCompare');
  const before = document.getElementById('beforePicture');
  const map = document.getElementById('comparisonMap');
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
    document.getElementById('skylineMapLink').href = map.href;
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

if (isStages) await showStages();
else showPair();
