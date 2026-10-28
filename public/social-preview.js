import {createImagePreview} from './image-preview.js?v=20261028-improvements1';
import {pictureProvenance} from './image-provenance.js?v=20261028-improvements1';
import {resolveMedia} from './media-catalog.js?v=20261023-usability1';
export function installSocialPreview(root=document){
 const preview=createImagePreview();
 for(const link of root.querySelectorAll('.social-grid .image-link')){
  const card=link.closest('article'),thumb=link.querySelector('img');
  const open=async(event,trigger)=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();const row=await resolveMedia(thumb.src);
   preview.show({title:card.querySelector('h2')?.textContent||'Picture',...pictureProvenance(row?.renderInfo,row?.download.width||3240),src:row?.displayMaster.url||card.dataset.displayUrl,download:row?.download.url||card.querySelector('.save').href,preview:thumb.currentSrc||thumb.src,width:row?.displayMaster.width||3240,height:row?.displayMaster.height||4050,osm:row?.sourceAttribution.openStreetMap??card.dataset.osm!=='false'},trigger);
  };
  link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',event=>open(event,link));
 }
 return preview.dialog;
}
