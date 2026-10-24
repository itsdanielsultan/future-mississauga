import {installDocumentPreviews} from './document-preview.js?v=20261023-documents1';
import {installImagePreviews,shortResolution} from './image-preview.js?v=20261023-cardfooter1';
import {resolveMedia,installResponsiveImages} from './media-catalog.js?v=20261023-usability1';
installImagePreviews(async(image,anchor)=>{
  const row=await resolveMedia(image?.src||anchor.href);
  if(row)return {title:row.title,src:row.displayMaster.url,download:row.download.url,preview:row.preview.url,width:row.displayMaster.width,height:row.displayMaster.height,osm:row.sourceAttribution.openStreetMap,meta:shortResolution(row.download.width)};
  const imageTarget=anchor&&/\.(png|jpe?g|webp|avif|svg)(\?|$)/i.test(anchor.href)?anchor.href:image?.currentSrc||image?.src;
  return {src:imageTarget,download:imageTarget};
});
installResponsiveImages().catch(()=>{});

const districtTitle=document.querySelector('#districtTitle'),mapTitle=document.querySelector('.map-creator strong');
if(districtTitle&&mapTitle){const sync=()=>{mapTitle.textContent=districtTitle.textContent;mapTitle.nextElementSibling.textContent='by Daniel Sultan';};sync();new MutationObserver(sync).observe(districtTitle,{subtree:true,childList:true,characterData:true});}

installDocumentPreviews();
