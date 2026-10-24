import {createImagePreview,shortResolution,shortDate} from './image-preview.js?v=20261023-usability1';
import {resolveMedia} from './media-catalog.js?v=20261023-usability1';
export function installSocialPreview(root=document){
 const preview=createImagePreview();
 for(const link of root.querySelectorAll('.social-grid .image-link')){
  const card=link.closest('article'),thumb=link.querySelector('img'),button=card.querySelector('.picture-open');
  const open=async(event,trigger)=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();const row=await resolveMedia(thumb.src);
   const date=shortDate(row?.renderInfo?.renderDate);
   preview.show({title:card.querySelector('h2')?.textContent||'Picture',meta:[date?'Rendered '+date:'',shortResolution(row?.download.width||3240)].filter(Boolean).join(' · '),src:row?.displayMaster.url||card.dataset.displayUrl,download:row?.download.url||card.querySelector('.save').href,preview:thumb.currentSrc||thumb.src,width:row?.displayMaster.width||3240,height:row?.displayMaster.height||4050,osm:row?.sourceAttribution.openStreetMap??card.dataset.osm!=='false'},trigger);
  };
  link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',event=>open(event,link));
  if(button){button.hidden=false;button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',event=>open(event,button));}
 }
 return preview.dialog;
}
