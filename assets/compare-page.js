import {loadEditionPlates,editionPreview} from './edition-pictures.js';
import {downtownAerial} from './downtown-aerial.js?v=20261120-tone';
import {installSkylineScenarios,syncComparisonLinks} from './skyline-scenarios.js?v=20261120-plates';
import {createImagePreview,presentationCaption,updateCleanImageCaption} from './image-preview.js?v=20261120-plates';
import {bindComparison} from './comparison.js?v=20261023-usability1';
import {assetURL} from './asset-delivery.js?v=20261113-delivery2';
import {comparisonPair} from './clean-media.js?v=20261113-design2';
import {refreshPictureAssets} from './media-catalog.js?v=20261113-design2';
const $ = selector => document.querySelector(selector);
const url = new URL(location.href);
syncComparisonLinks(document, url);
const stages = url.searchParams.get('mode') === 'stages' || url.searchParams.has('scenario') || location.hash === '#skyline' || location.hash.startsWith('#?scenario');
for(const panel of document.querySelectorAll('[data-compare-panel]'))panel.hidden = (panel.dataset.comparePanel === 'stages') !== stages;
for (const link of document.querySelectorAll('[data-compare-mode]')) {
  if (link.dataset.compareMode === (stages ? 'stages' : 'pair')) link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
}
if(stages){
const plates = await loadEditionPlates();
const frames = Object.fromEntries(Object.entries(downtownAerial).map(([key,frame]) => {
  const plate = plates.get('wide/downtown-skyline-' + frame.scenario + '.png');
  return [key, plate ? {...editionPreview(frame,plate), responsive:plate.displayMaster.url, previewWidth:plate.width} : frame];
}));
const preview = createImagePreview({views:true});
 const button = document.querySelector('[data-aerial-feature]');
 button.addEventListener('click',()=>{
const labels = {existingSkyline:'Today', constructionSkyline:'Construction', skyline:'Proposed'};
   const show = key => {
     const frame = frames[key];
     preview.show({...frame, explore:'explore.html?district=downtown&scenario=' + frame.scenario}, button);
   };
   preview.setSequence(direction=>{
     const keys=Object.keys(labels),select=preview.dialog.querySelector('.media-preview__view select');
     select.value=keys[(keys.indexOf(select.value)+direction+keys.length)%keys.length];select.dispatchEvent(new Event('change'));
   });
   preview.setViews(Object.entries(labels).map(([value,label]) => ({value,label})), button.dataset.view, show);
   show(button.dataset.view);
 });
function showSkyline() {
 const view = $('#skylineScenario').value;
 const frame = frames[view];
 const figure = $('.hero'), image = figure.querySelector('img'), button = figure.querySelector('button');
 const label = {existingSkyline:'Existing buildings', constructionSkyline:'Construction snapshot', skyline:'Proposed development'}[view];
 button.dataset.view = view;
 button.setAttribute('aria-label', 'Expand Downtown aerial · ' + label);
 image.srcset = frame.preview + ' ' + (frame.previewWidth || 1200) + 'w, ' + frame.responsive + ' ' + (frame.previewWidth ? frame.width : 3200) + 'w';
 image.src = frame.preview;
 image.alt = frame.alt;
 const caption = figure.querySelector('figcaption'), download = caption.querySelector('a[download]');
 download.href = frame.download;
 download.setAttribute('aria-label', 'Download Downtown aerial · ' + label + ' (credited PNG)');
 const [creator, key] = presentationCaption(frame);
 const byline = document.createElement('div');
 byline.className = 'aerial-byline';
 byline.append(creator);
 caption.className = 'aerial-caption';
 caption.replaceChildren(byline, key, download);
}
installSkylineScenarios($('#skylineScenario'), $('#skylineMapLink'), showSkyline);


}else{
let districts = [], pictures = null, edition = new Map();
const selector = $('#comparisonDistrict');
function splitValue(address) {
  const raw = address.searchParams.get('split');
  const number = Number(raw);
  return raw !== null && raw.trim() && Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 50;
}
const divider = bindComparison({
  panel: $('#pictureCompare'), clickToJump: true, handle: $('#compareDivider'), input: $('#pictureSlider'),
  initial: splitValue(url),
  onChange: value => { $('#beforePicture').style.clipPath = `inset(0 ${100 - value}% 0 0)`; },
  onCommit: value => {
    const next = new URL(location.href);
    next.searchParams.set('split', String(Math.round(value * 10) / 10));
    history.replaceState(history.state, '', next);
    syncComparisonLinks(document, next);
  }
});
function showComparison(id){
 if (id === 'downtown') {
   for (const [selector, state] of [['#pictureCompare > img','future'], ['#beforePicture img','existing']]) {
     const image = $(selector);
     const url = 'gallery/city-plates/downtown-' + state + '-2560.webp';
     image.srcset = url + ' 1x';
     image.src = url;
     image.alt = 'Square One, ' + (state === 'future' ? 'with proposed developments' : 'existing buildings');
   }
   const caption=$('.media-caption--comparison');
   if(caption)caption.hidden=true;
   return;
 }
 if (!pictures) {
   for (const [image, mode] of [[$('#pictureCompare > img'), 'future'], [$('#beforePicture img'), 'existing']]) {
     const preview = 'gallery/edition-20261120/wide-' + id + '-' + mode + '.webp';
     image.removeAttribute('srcset');
     image.src = preview;
     image.alt = selector.selectedOptions[0].textContent + (mode === 'future' ? ' with proposals' : ' existing buildings');
   }
   return;
 }
 const pair=comparisonPair(pictures,id);if(!pair)return;const name=districts.find(d=>d.id===id).name;
 const assign = (image, row, label, mode) => {
   const plate = edition.get('wide/' + id + '-' + mode + '.png');
   const source = plate?.webImage || (row.cleanPresentation ? row.responsive.url : row.display.url);
   const url = assetURL(source);
   image.removeAttribute('sizes');
   image.srcset = url + ' 1x';
   image.src = url;
   image.alt = label;
   updateCleanImageCaption(image, row);
 };
 const caption = $('.media-caption--comparison');
 if (caption) caption.hidden = false;
 assign($('#pictureCompare > img'), pair[1], name + ' future scenario', 'future');
 assign($('#beforePicture img'), pair[0], name + ' existing context', 'existing');
}
$('#comparisonDistrict').addEventListener('change', () => {
  const next = new URL(location.href);
  next.searchParams.set('area', $('#comparisonDistrict').value);
  history.replaceState(history.state, '', next);
  syncComparisonLinks(document, next);
  selectPlace();
});
function selectPlace() {
  const id = $('#comparisonDistrict').value;
  const place = $('#comparisonPlace');
  place.href = 'place-' + encodeURIComponent(id) + '.html';
  place.textContent = 'Explore ' + $('#comparisonDistrict').selectedOptions[0].textContent;
  $('#comparisonMap').href = 'explore.html?district=' + encodeURIComponent(id);
  $('#skylineMapLink').href = $('#comparisonMap').href;
  showComparison(id);
}
function restoreComparison() {
  const address = new URL(location.href);
  const requested = address.searchParams.get('area');
  selector.value = [...selector.options].some(option => option.value === requested) ? requested : 'downtown';
  divider.set(splitValue(address));
  syncComparisonLinks(document, address);
  selectPlace();
}
window.addEventListener('popstate', restoreComparison);
restoreComparison();

async function loadComparisonPictures() {
  const [areas, assets, plates] = await Promise.all([
    fetch('data/districts.json').then(response => response.json()),
    fetch('data/picture-assets.json').then(response => response.json()),
    loadEditionPlates()
  ]);
  await refreshPictureAssets(assets);
  districts = areas; pictures = assets; edition = plates;
  selectPlace();
}
// Each permitted area already has a local pair of edition images.
loadComparisonPictures().catch(() => {});
}

const share = $('[data-share-view]');
const field = $('[data-share-field]');
let copiedTimer;
share.addEventListener('click', async () => {
  const current = new URL(location.href);
  const link = current.protocol === 'file:' ? new URL('https://futuremississauga.com/compare.html') : current;
  link.search = current.search;
  link.hash = current.hash;
  field.value = link.href;
  try {
    await navigator.clipboard.writeText(link.href);
    field.hidden = true;
    share.textContent = 'Link copied';
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { share.textContent = 'Copy comparison link'; }, 1800);
  } catch {
    field.hidden = false;
    field.focus();
    field.select();
  }
});
