import {createImagePreview,createResolvedPreview} from './image-preview.js?v=20261112-ui1';
import {mediaPreviewInfo} from './clean-media.js?v=20261109-feedback1';
import {resolveMedia} from './media-catalog.js?v=20261109-delivery1';
export function installSocialPreview(root=document){
 const preview=createImagePreview(),show=createResolvedPreview(preview);
 for(const link of root.querySelectorAll('.social-grid .image-link')){
  const card=link.closest('article'),thumb=link.querySelector('img');
  const open=async(event,trigger)=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   show({title:card.querySelector('h2')?.textContent||'Picture',src:card.dataset.displayUrl||link.href,download:card.querySelector('.save').href,preview:thumb.currentSrc||thumb.src,width:Number(card.dataset.displayWidth)||3240,height:Number(card.dataset.displayHeight)||4050,osm:card.dataset.osm!=='false'},async()=>{
    const row=await resolveMedia(thumb.src);
    return row?mediaPreviewInfo(row):null;
   },trigger);
  };
  link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',event=>open(event,link));
 }
 return preview.dialog;
}
