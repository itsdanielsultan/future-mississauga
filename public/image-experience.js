import {installSocialPreview} from './social-preview.js?v=20261112-ui1';
import {installDocumentPreviews} from './document-preview.js?v=20261112-ui1';
import {installImagePreviews,updateCleanImageCaption,previewDownloadURL} from './image-preview.js?v=20261112-ui1';
import {mediaPreviewInfo} from './clean-media.js?v=20261109-feedback1';
import {resolveStudyImage} from './neighbourhood-media.js?v=20261109-delivery1';
import {resolveMedia,installResponsiveImages} from './media-catalog.js?v=20261109-delivery1';
installImagePreviews(async(image,anchor)=>{
  const row=await resolveMedia(image?.src||anchor.href);
  if(row)return mediaPreviewInfo(row);
  const imageTarget=anchor&&/\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(anchor.href)?anchor.href:image?.currentSrc||image?.src;
  const study=await resolveStudyImage(imageTarget);
  if(study)return study;
  return {src:imageTarget,download:previewDownloadURL(anchor,imageTarget)};
});
if(document.querySelector('.social-grid')) installSocialPreview();
installResponsiveImages({onCleanImage:updateCleanImageCaption}).catch(()=>{});

const districtTitle=document.querySelector('#districtTitle'),mapTitle=document.querySelector('.map-creator strong');
if(districtTitle&&mapTitle){const sync=()=>{mapTitle.textContent=districtTitle.textContent;mapTitle.nextElementSibling.textContent='by Daniel Sultan';};sync();new MutationObserver(sync).observe(districtTitle,{subtree:true,childList:true,characterData:true});}

installDocumentPreviews();
