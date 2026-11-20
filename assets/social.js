import {loadEditionPlates} from './edition-pictures.js';
const retryPreview = image => {
  if (image.dataset.retried) return;
  image.dataset.retried = 'true';
  const url = new URL(image.src, document.baseURI);
  url.searchParams.set('retry', '1');
  image.src = url.href;
};
const cards=[...document.querySelectorAll('.social-grid article')];
for(const card of cards){
 const image=card.querySelector('img');
 image.addEventListener('error',()=>retryPreview(image));
 if(image.complete&&image.currentSrc&&!image.naturalWidth)retryPreview(image);
}
const area = document.querySelector('#areaFilter');
const landscape = document.querySelector('.media-sections a[href^="gallery.html"]');
const countLabel = document.querySelector('#resultCount');
const empty = document.querySelector('#portraitEmpty');
const currentURL = () => window.fmLocal?.historyURL() || new URL(document.URL);
function updatePortraits() {
  let count = 0;
  for (const card of cards) {
    card.hidden = area.value !== 'all' && card.dataset.district !== area.value;
    if (!card.hidden) count++;
  }
  countLabel.textContent = count + (count === 1 ? ' portrait' : ' portraits');
  empty.hidden = count !== 0;
  landscape.href = area.value === 'all' ? 'gallery.html' : 'gallery.html?area=' + encodeURIComponent(area.value);
}
function restore() {
  const id = currentURL().searchParams.get('area');
  area.value = [...area.options].some(option => option.value === id) ? id : 'all';
  updatePortraits();
}
function changeArea() {
  const url = currentURL();
  if (area.value === 'all') url.searchParams.delete('area');
  else url.searchParams.set('area', area.value);
  if (window.fmLocal) window.fmLocal.writeHistory('replaceState', history.state, '', url);
  else history.replaceState(history.state, '', url);
  updatePortraits();
}
area.addEventListener('change', changeArea);
document.querySelector('#clearPortraits').addEventListener('click', () => {
  area.value = 'all';
  changeArea();
  area.focus();
});
window.addEventListener('popstate', restore);
restore();

const plates = await loadEditionPlates();
for (const card of cards) {
  const plate = plates.get(card.dataset.plate);
  if (!plate) continue;
  const image = card.querySelector('img');
  card.dataset.originalThumb = image.getAttribute('src');
  image.removeAttribute('srcset');
  image.src = plate.webImage;
  card.dataset.displayUrl = plate.displayMaster.url;
  card.dataset.displayWidth = plate.displayMaster.width;
  card.dataset.displayHeight = plate.displayMaster.height;
  card.querySelector('.image-link').href = plate.displayMaster.url;
  card.querySelector('.save').href = plate.download.url;
  const meta = card.querySelector('[data-render-info]');
  if (meta) meta.textContent = '';
}
