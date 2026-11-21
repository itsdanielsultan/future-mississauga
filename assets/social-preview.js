import {loadEditionPlates,editionPreview} from './edition-pictures.js';
import {createImagePreview,createResolvedPreview} from './image-preview.js?v=20261120-plates';
import {mediaPreviewInfo} from './clean-media.js?v=20261113-design2';
import {resolveMedia} from './media-on-demand.js';
export function installSocialPreview(root=document){
 const preview=createImagePreview(),show=createResolvedPreview(preview);
 const plates = loadEditionPlates();
 for(const link of root.querySelectorAll('.social-grid .image-link')){
  const card=link.closest('article'),thumb=link.querySelector('img');
  const open=async(event,trigger)=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   const visible=[...root.querySelectorAll('.social-grid article:not([hidden]) .image-link')];
   preview.setSequence(visible.length>1?direction=>{
    const index=visible.indexOf(link);
    visible[(index+direction+visible.length)%visible.length].click();
   }:null);
   const viewTitle=card.dataset.viewTitle||card.querySelector('h3')?.textContent||'Picture',area=card.dataset.areaTitle||'';
   show({title:viewTitle,viewTitle,area,src:card.dataset.displayUrl||link.href,download:card.querySelector('.save').href,preview:thumb.currentSrc||thumb.src,width:Number(card.dataset.displayWidth)||3240,height:Number(card.dataset.displayHeight)||4050,osm:card.dataset.osm!=='false'},async()=>{
    const plate = (await plates).get(card.dataset.plate);
    if (plate?.signedMaster) return editionPreview({title:area,viewTitle,area,attribution:plate.attribution},plate);
    const row=await resolveMedia(card.dataset.originalThumb || thumb.src);
    const info = row ? {...mediaPreviewInfo({...row,viewTitle,area}),viewTitle,area} : null;
    return info || plate ? editionPreview(info || {title:viewTitle,viewTitle,area},plate) : null;
   },trigger);
  };
  link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',event=>open(event,link));
 }
 return preview.dialog;
}
