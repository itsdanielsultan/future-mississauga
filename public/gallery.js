import {loadEditionPlates,editionPreview,plateCaption} from './edition-pictures.js';
import {createImagePreview} from './image-preview.js?v=20261120-plates';
import {filterGallery} from './gallery-catalogue.js?v=20261113-design2';

const $ = selector => document.querySelector(selector);
const grid = $('#galleryGrid');
const area = $('#galleryArea'), type = $('#galleryView'), search = $('#gallerySearch');
const cards = [...grid.querySelectorAll('.picture-card')].map(card => {
  const link = card.querySelector('[data-open]'), data = card.dataset;
  return {card,link,file:data.file,district:link.dataset.open,area:data.areaTitle,view:link.dataset.view,
    viewTitle:data.viewTitle,type:data.type,scenario:data.scenario};
});
const byLink = new Map(cards.map(row => [row.link,row]));
const titles = {aerial:'Future aerial',portrait:'Future perspective',skyline:'Future skyline',existing:'Existing aerial',
  existingSkyline:'Existing skyline',constructionSkyline:'Construction snapshot',landmark:'Absolute World towers',
  junction:'Hurontario Street at Highway 403'};
const address = () => window.fmLocal?.historyURL() || new URL(location.href);

function showPlace() {
  const selected = area.value !== 'all';
  const name = area.selectedOptions[0].textContent;
  $('#galleryTitle').textContent = selected ? name : 'Image gallery';
  $('#placeDestinations').hidden = !selected;
  const portrait = $('.media-sections a[href^="social.html"]');
  if (portrait) portrait.href = selected ? 'social.html?area='+encodeURIComponent(area.value) : 'social.html';
  if (!selected) return;
  $('#placeMap').href = 'explore.html?district='+encodeURIComponent(area.value);
  const buildings = $('#placeBuildings');
  buildings.hidden = !buildings.dataset.areas.split(' ').includes(area.value);
  buildings.href = 'model.html?area='+encodeURIComponent(name);
  const compare = $('#placeCompare');
  compare.hidden = !['downtown','port-credit','lakeview','clarkson'].includes(area.value);
  compare.href = 'compare.html?area='+encodeURIComponent(area.value);
}
function renderGallery() {
  const {matches} = filterGallery(cards,{area:area.value,view:type.value,search:search.value});
  const visible = new Set(matches), sections = new Set(matches.map(row=>row.type));
  for (const row of cards) {
    row.card.hidden = !visible.has(row);
    if (!row.card.hidden) {
      const caption = plateCaption(row.area,row.viewTitle,row.scenario,area.value!=='all');
      row.card.querySelector('h3').textContent = caption.title;
      row.card.querySelector('.media-caption__scenario').textContent = caption.detail;
    }
  }
  for (const heading of grid.querySelectorAll('[data-gallery-group]')) {
    heading.hidden = area.value!=='all' || sections.size<2 || !sections.has(heading.dataset.galleryGroup);
  }
  showPlace();
  $('#galleryResult').textContent = matches.length+' image'+(matches.length===1?'':'s');
  $('#galleryEmpty').hidden = matches.length>0;
}
function restore() {
  const url = address();
  for (const [control,key] of [[area,'area'],[type,'view']]) {
    const value = url.searchParams.get(key);
    control.value = [...control.options].some(option=>option.value===value) ? value : 'all';
  }
  if (url.hash==='#perspectives') type.value='close';
  search.value = url.searchParams.get('q') || '';
  renderGallery();
}
function remember() {
  const url = address();
  for (const [key,value] of [['area',area.value],['view',type.value],['q',search.value.trim()]]) {
    if (value && (key==='q' || value!=='all')) url.searchParams.set(key,value);
    else url.searchParams.delete(key);
  }
  url.searchParams.delete('all');
  if (url.hash==='#perspectives' && type.value!=='close') url.hash='';
  if (window.fmLocal) window.fmLocal.writeHistory('replaceState',history.state,'',url);
  else history.replaceState(history.state,'',url);
  renderGallery();
}
for (const control of [area,type,search]) control.addEventListener(control===search?'input':'change',remember);
$('#clearGallery').addEventListener('click',()=>{
  area.value='all';type.value='all';search.value='';remember();search.focus();
});
function alignHash() {
  const hash=location.hash;
  if (!['#pictures','#perspectives'].includes(hash)) return;
  Promise.all([document.fonts?.ready,globalThis.fmMediaReady]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(location.hash===hash&&!window.fmGalleryNavigation?.manual) document.querySelector(hash)?.scrollIntoView({block:'start',behavior:'instant'});
  })));
}
window.addEventListener('hashchange',()=>{restore();alignHash();});
window.addEventListener('popstate',restore);
window.addEventListener('fm:media-ready',alignHash);
$('.gallery-filters').hidden=false;
restore();alignHash();

const edition = await loadEditionPlates('data/city-plates-'+grid.dataset.edition+'.json');
if (!cards.length || cards.some(row=>!edition.get('wide/'+row.file)?.signedMaster)) throw Error('Current gallery previews unavailable');
const preview = createImagePreview({views:true});
function showCard(row) {
  const choices = cards.filter(other=>other.district===row.district);
  const showView = view => {
    const selected = choices.find(choice=>choice.view===view);
    if (!selected) return;
    const plate = edition.get('wide/'+selected.file);
    const scenario=selected.file.slice(0,-4).split('-').pop();
    const {area,viewTitle} = selected;
    preview.show({...editionPreview({title:area,area,viewTitle,scenario,attribution:plate.attribution},plate),area,viewTitle,
      explore:'explore.html?district='+selected.district+'&scenario='+scenario+'&appearance=status'},row.link);
  };
  const visible = cards.filter(item=>!item.card.hidden);
  preview.setSequence(visible.length>1 ? direction=>{
    const next = visible[(visible.indexOf(row)+direction+visible.length)%visible.length];
    showCard(next);
  } : null);
  preview.setViews(choices.map(choice=>({value:choice.view,label:titles[choice.view]})),row.view,showView);
  showView(row.view);
}
grid.addEventListener('click',event=>{
  if (event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
  const link=event.target.closest('[data-open]');
  const row=byLink.get(link);
  if (!row) return;
  event.preventDefault();
  showCard(row);
});
