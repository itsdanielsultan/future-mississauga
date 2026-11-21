import {installSocialPreview} from './social-preview.js?v=20261120-plates';
import {installDocumentPreviews} from './document-preview.js?v=20261120-reader';
import {installImagePreviews,updateCleanImageCaption,previewDownloadURL} from './image-preview.js?v=20261120-plates';
import {mediaPreviewInfo} from './clean-media.js?v=20261113-design2';
import {resolveStudyImage} from './neighbourhood-media.js?v=20261113-design2';
import {resolveMedia,installResponsiveImages} from './media-on-demand.js';
import {loadEditionPlates,editionPreview} from './edition-pictures.js';
installImagePreviews(async(image,anchor)=>{
  if(anchor?.dataset.editionPlate){
    const plate=(await loadEditionPlates()).get(anchor.dataset.editionPlate);
    return plate && editionPreview({creator:'Daniel Sultan',attribution:plate.attribution},plate);
  }
  const row=await resolveMedia(image?.src||anchor.href);
  if(row)return mediaPreviewInfo(row);
  const imageTarget=anchor&&/\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(anchor.href)?anchor.href:image?.currentSrc||image?.src;
  const study=await resolveStudyImage(imageTarget);
  if(study)return study;
  return {src:imageTarget,download:previewDownloadURL(anchor,null)};
});
if(document.querySelector('.social-grid')) installSocialPreview();
// These pages either emit final responsive images in HTML or build them from
// the current edition manifest. Legacy records remain available on demand.
const currentEditionPage=document.querySelector('#galleryGrid,.social-grid,.city-home,.atlas-places,.viewer-page,[data-compare-panel],.screening');
globalThis.fmMediaReady=(currentEditionPage ? Promise.resolve() : installResponsiveImages({onCleanImage:updateCleanImageCaption})).catch(()=>{}).then(()=>{
 globalThis.dispatchEvent?.(new CustomEvent('fm:media-ready'));
});

const districtTitle=document.querySelector('#districtTitle'),mapTitle=document.querySelector('.map-creator strong');
if(districtTitle&&mapTitle){const sync=()=>{mapTitle.textContent=districtTitle.textContent;mapTitle.nextElementSibling.textContent='by Daniel Sultan';};sync();new MutationObserver(sync).observe(districtTitle,{subtree:true,childList:true,characterData:true});}

installDocumentPreviews();
