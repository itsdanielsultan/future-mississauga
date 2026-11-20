import {loadEditionPlates,editionPreview} from './edition-pictures.js';
import {assetURL} from './asset-delivery.js?v=20261113-delivery2';
import {createImagePreview,updateCleanImageCaption} from './image-preview.js?v=20261120-plates';
import {mediaPreviewInfo} from './clean-media.js?v=20261113-design2';
import {refreshPictureAssets} from './media-catalog.js?v=20261113-design2';
import {buildGalleryCatalogue,filterGallery,galleryViews} from './gallery-catalogue.js?v=20261113-design2';
const $=s=>document.querySelector(s);
const [districts,pictures]=await Promise.all(['districts','picture-assets'].map(x=>fetch('data/'+x+'.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Pictures unavailable');return r.json();})));
const [edition] = await Promise.all([loadEditionPlates(), refreshPictureAssets(pictures)]);
const plateFor = name => edition.get('wide/' + name);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const original=name=>assetURL(plateFor(name)?.download.url || pictures.images[name].download?.url || pictures.images[name].url);
const display=name=>assetURL(plateFor(name)?.webImage || pictures.images[name].display.url);
const downloadIcon='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg>';
const catalogue=buildGalleryCatalogue(districts,pictures.images),grid=$('#galleryGrid');
const area=$('#galleryArea'),viewFilter=$('#galleryView'),search=$('#gallerySearch');
for(const district of districts.filter(d=>catalogue.some(row=>row.district===d.id)).sort((a,b)=>a.name.localeCompare(b.name))){
 const option=document.createElement('option');option.value=district.id;option.textContent=district.name;area.append(option);
}
const entryURL = new URL(location.href);
for (const [control, key] of [[area, 'area'], [viewFilter, 'view']]) {
  const value = entryURL.searchParams.get(key);
  if (value && [...control.options].some(option => option.value === value)) control.value = value;
}
search.value = entryURL.searchParams.get('q') || '';

function rememberGallery() {
  const url = new URL(location.href);
  for (const [key, value] of [['area', area.value], ['view', viewFilter.value], ['q', search.value.trim()]]) {
    if (value && (!['area', 'view'].includes(key) || value !== 'all')) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  url.searchParams.delete('all');
  if (url.hash === '#perspectives' && viewFilter.value !== 'close') url.hash = '';
  history.replaceState(history.state, '', url);
}
function updatePlaceLinks() {
  const district = districts.find(item => item.id === area.value);
  const links = $('#placeDestinations');
  links.hidden = !district;
  $('#galleryTitle').textContent = district ? district.name : 'Image gallery';
  const portraitLink = document.querySelector('.media-sections a[href^="social.html"]');
  if (portraitLink) portraitLink.href = district ? 'social.html?area=' + encodeURIComponent(district.id) : 'social.html';
  if (!district) return;
  $('#placeMap').href = 'explore.html?district=' + encodeURIComponent(district.id);
  $('#placeBuildings').hidden = !($('#placeBuildings').dataset.areas || '').split(' ').includes(district.id);
  $('#placeBuildings').href = 'model.html?area=' + encodeURIComponent(district.name);
  const compare = $('#placeCompare');
  compare.hidden = !['downtown', 'port-credit', 'lakeview', 'clarkson'].includes(district.id);
  if (!compare.hidden) compare.href = 'compare.html?area=' + encodeURIComponent(district.id);
}
function renderGallery(){
 updatePlaceLinks();
 const {matches,visible}=filterGallery(catalogue,{area:area.value,view:viewFilter.value,search:search.value});
 const card = row => `<article class="picture-card" data-view-title="${escape(row.viewTitle)}" data-area-title="${escape(row.area)}" data-file="${escape(row.file)}"><button data-open="${escape(row.district)}" data-view="${row.view}" aria-label="Preview ${escape(row.area+' '+row.viewTitle+' '+row.scenario)}"><img src="${escape(display(row.file))}" alt="${escape(row.area+' · '+row.viewTitle+' · '+row.scenario)}" loading="lazy" decoding="async" width="1600" height="1000"></button><div class="card-caption"><div><span class="media-caption__area">${escape(row.area)}</span><h3>${escape(row.viewTitle)}</h3><span class="media-caption__scenario">${row.scenario}</span></div><a href="${escape(original(row.file))}" download class="icon-button ui-button" aria-label="Download ${escape(row.area+' '+row.viewTitle+' '+row.scenario)} PNG" data-variant="ghost" data-size="icon" title="Download PNG">${downloadIcon}</a></div></article>`;
 const collections = [
   ['close', 'Landmarks and closer views'],
   ['aerial', 'Neighbourhood aerials'],
   ['skyline', 'Skylines']
 ];
 const groups = collections.map(([type, title]) => ({
   title, cards: visible.filter(row => row.type === type)
 })).filter(group => group.cards.length);
 grid.innerHTML = groups.map(group => {
   const heading = groups.length > 1 ? '<h2 class="gallery-collection-title">' + group.title + '</h2>' : '';
   return heading + group.cards.map(card).join('');
 }).join('');
 for(const image of grid.querySelectorAll('img')){const row=pictures.images[image.closest('article').dataset.file];updateCleanImageCaption(image,row);}
 $('#galleryResult').textContent=`${matches.length} image${matches.length===1?'':'s'}`;
 $('#galleryEmpty').hidden=matches.length>0;
}
for(const control of [area,viewFilter,search])control.addEventListener(control===search?'input':'change',()=>{rememberGallery();renderGallery();});
$('#clearGallery').addEventListener('click', () => {
  area.value = 'all'; viewFilter.value = 'all'; search.value = '';
  rememberGallery(); renderGallery(); search.focus();
});
function alignGalleryHash(){
 const hash=location.hash;if(!['#pictures','#perspectives'].includes(hash))return;
 Promise.all([document.fonts?.ready,globalThis.fmMediaReady]).then(()=>{
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(location.hash===hash&&!window.fmGalleryNavigation?.manual)document.querySelector(hash)?.scrollIntoView({block:'start',behavior:'instant'});
  }));
 });
}
function applyHash(){if(location.hash==='#perspectives'){viewFilter.value='close';renderGallery();}alignGalleryHash();}
window.addEventListener('hashchange',applyHash);
window.addEventListener('fm:media-ready',alignGalleryHash);
renderGallery();applyHash();

const preview=createImagePreview({views:true});let openDistrict=null,opener=null;
const viewFiles=Object.fromEntries(Object.entries(galleryViews).map(([key,value])=>[key,value.suffix]));
const viewNames={aerial:'Future aerial',portrait:'Future perspective',skyline:'Future skyline',existing:'Existing aerial',existingSkyline:'Existing skyline',constructionSkyline:'Construction snapshot',landmark:'Absolute World',junction:'City Centre interchange'};
function showPicture(view){
 const d=openDistrict,file=d.id+viewFiles[view],info=pictures.images[file];
 const viewTitle=info.caption?.subtitle||viewNames[view],area=info.caption?.area||d.name;
 const scenario = info.caption?.scenario;
 const suffix = ['existing','construction','future'].includes(scenario) ? '&scenario=' + scenario : '';
 preview.show({...editionPreview(mediaPreviewInfo({...info,viewTitle,area}),plateFor(file)),viewTitle,area,explore:'explore.html?district='+d.id+suffix},opener);
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-open]');if(!button||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const shown=[...grid.querySelectorAll('button[data-open]')];
 preview.setSequence(shown.length>1?direction=>{
  const index=shown.indexOf(button);
  shown[(index+direction+shown.length)%shown.length].click();
 }:null);
 opener=button;openDistrict=districts.find(d=>d.id===button.dataset.open);if(!openDistrict)return;
 const available=Object.keys(viewFiles).filter(view=>pictures.images[openDistrict.id+viewFiles[view]]);
 const view=available.includes(button.dataset.view)?button.dataset.view:'aerial';
 preview.setViews(available.map(value=>({value,label:viewNames[value]})),view,showPicture);showPicture(view);
});
