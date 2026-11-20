import {prepareAppearancePreference} from './appearance-preference.js?v=20261113-design2';
prepareAppearancePreference(document.querySelector('#appearanceSelect'));
// Show the exact district while its larger 3D model loads, even if WebGL is unavailable.
const wrap=document.querySelector('#sceneWrap');
const picker=document.querySelector('#districtSelect');
const route=window.fmLocal?.historyURL?.() || new URL(location.href);
const fairview=route.searchParams.get('context')==='fairview';
const selected=picker.querySelector('option[value="'+CSS.escape(route.searchParams.get('district')||'downtown')+'"]') || picker.querySelector('option[value="downtown"]');
function showArea(id,name) {
 const poster=id==='fairview'?'neighbourhood-fairview-after':'wide-'+id+'-future';
 wrap.style.setProperty('--loading-image','url("gallery/edition-20261120/'+poster+'.webp")');
 document.querySelector('#districtTitle').textContent=name;
 const link=document.querySelector('#mapGalleryLink');
 link.href=id==='citywide'?'neighbourhoods.html':'place-'+id+'.html';
 link.firstChild.textContent=id==='citywide'?'Neighbourhoods ':'Explore '+name+' ';
}
if(selected) {picker.value=selected.value;showArea(fairview?'fairview':selected.value,fairview?'Fairview':selected.textContent);}
window.addEventListener('atlas-district-loading',event=>showArea(event.detail.id,event.detail.name));
try {
  await import('./app.js?v=20261120-navigation');
} catch (error) {
  const loading = document.querySelector('#loading');
  loading.hidden = false;
  loading.style.display = 'grid';
  loading.replaceChildren(document.createTextNode('3D is unavailable in this browser. Explore the neighbourhood pictures or try again.'));
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry map';
  retry.addEventListener('click', () => location.reload());
  const gallery = document.createElement('a');
  gallery.href = document.querySelector('#mapGalleryLink').href;
  gallery.textContent = 'Browse pictures';
  loading.append(retry, gallery);
  document.querySelector('#sceneWrap').setAttribute('aria-busy', 'false');
  console.error('Map startup failed', error);
}
