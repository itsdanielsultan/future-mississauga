import {loadEditionPlates,plateCaption} from './edition-pictures.js';
const retryPreview = image => {
  if (image.dataset.retried) return;
  image.dataset.retried = 'true';
  const url = new URL(image.src, document.baseURI);
  url.searchParams.set('retry', '1');
  image.removeAttribute('srcset');
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
  const filtered = area.value !== 'all';
  document.querySelector('.portrait-results')?.classList.toggle('is-filtered',filtered);
  document.querySelector('main h1').textContent=filtered ? area.selectedOptions[0].text+' portraits' : 'Portrait gallery';
  for (const card of cards) {
    card.hidden = area.value !== 'all' && card.dataset.district !== area.value;
    if (!card.hidden) {
      count++;
      const caption=plateCaption(card.dataset.areaTitle,card.dataset.viewTitle,
        card.dataset.plate.split('-').pop().split('.')[0],filtered);
      card.querySelector('.card-copy h3').textContent=caption.title;
      card.querySelector('.media-caption__scenario').textContent=caption.detail;
    }
  }
  for (const group of document.querySelectorAll('.portrait-collection')) {
    group.hidden = !group.querySelector('article:not([hidden])');
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
  if (!card.dataset.originalThumb) card.dataset.originalThumb = image.getAttribute('src');
  image.sizes = '(max-width: 560px) calc(100vw - 32px), (max-width: 900px) 46vw, (max-width: 1440px) 30vw, 430px';
  const small = plate.signedThumbnail || {url:plate.thumbnail,width:512};
  const large = plate.signedPreview || {url:plate.webImage,width:plate.width};
  const master = plate.signedMaster || plate.displayMaster;
  image.srcset = small.url + ' ' + small.width + 'w, ' + large.url + ' ' + large.width + 'w';
  image.src = small.url;
  card.dataset.displayUrl = master.url;
  card.dataset.displayWidth = master.width;
  card.dataset.displayHeight = master.height;
  card.querySelector('.image-link').href = master.url;
  card.querySelector('.save').href = plate.download.url;
  const meta = card.querySelector('[data-render-info]');
  if (meta) meta.textContent = '';
}
