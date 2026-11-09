import {shortDate,shortResolution} from './image-provenance.js?v=20261101-gallery1';
import {normalizeCleanMedia,mediaPreviewInfo,imageAttribution} from './clean-media.js?v=20261109-feedback1';
import {matchedFairviewBinding} from './fairview-media.js?v=20261102-fairview1';

export function studyImagePreview(manifest, url, baseURL, {proof,proofSHA256}={}) {
  if(manifest?.schema==='future-mississauga-neighbourhood-media/v2'){
    if(manifest.id!=='fairview'||manifest.state!=='READY_FOR_PUBLICATION'||manifest.publication!==true||!Array.isArray(manifest.images)||manifest.images.length!==2)return null;
    try{
      const rows=manifest.images.map(entry=>normalizeCleanMedia(entry,baseURL,{neighbourhood:true}));
      if(rows.map(row=>row.identity).join('|')!=='neighbourhood/fairview/before|neighbourhood/fairview/after')return null;
      if(manifest.comparisonProofs?.length!==1||manifest.comparisonProofs[0].proofID!==proof?.proofID||manifest.comparisonProofs[0].sha256!==proofSHA256)return null;
      matchedFairviewBinding(rows,proof,proofSHA256);
      const target=new URL(url,baseURL);target.search='';target.hash='';
      const row=rows.find(row=>[row.displayMaster,row.download,...row.responsivePreviews].some(asset=>{const source=new URL(asset.url,baseURL);source.search='';source.hash='';return source.href===target.href;}));
      return row?mediaPreviewInfo(row):null;
    }catch{return null;}
  }
  if (!['future-mississauga-neighbourhood-media/v1','future-mississauga-study-media/v1'].includes(manifest?.schema) || !Array.isArray(manifest.images)) return null;
  const base = new URL(baseURL), target = new URL(url,base);
  if (target.origin !== base.origin) return null;
  const row = manifest.images.find(image => {const source=new URL(image.url,base);return source.origin===base.origin&&source.pathname===target.pathname;});
  if (!row) return null;
  const updated = shortDate(manifest.updatedOn);
  return {
    title: manifest.title+' · '+row.caption,
    src: row.url, download: row.url, preview: row.url,
    width: row.width, height: row.height,
    meta: [updated ? 'Updated '+updated : '',shortResolution(row.width)].filter(Boolean).join(' · '),
    osm: manifest.sourceAttribution?.openStreetMap === true,
    attribution:imageAttribution({sourceAttribution:{...manifest.sourceAttribution,...(manifest.credits?.photoReference?{photoReference:{name:manifest.credits.photoReference,url:manifest.credits.photoReferenceURL}}:{})}})
  };
}

export const neighbourhoodPreview = studyImagePreview;
const manifests = [
  {path:'/assets/fairview-20261028/',url:'data/neighbourhood-media.json?v=20261028-improvements1'},
  {path:'/assets/ergocentric-20261028/',url:'data/ergocentric-media.json?v=20261028-improvements1'}
];
const requests = new Map();
export async function resolveStudyImage(url) {
  const target = new URL(url,location.href);
  const entry=target.origin===location.origin&&manifests.find(item=>target.pathname.includes(item.path));
  if(entry){
    // Old URLs retain their original pixels, date and metadata forever.
    if (!requests.has(entry.url)) requests.set(entry.url,fetch(entry.url).then(response=>response.ok?response.json():null).catch(()=>null));
    return studyImagePreview(await requests.get(entry.url),url,location.href);
  }
  // Current URLs may be immutable hosted PNGs. Only the shared catalogue's
  // atomically validated Fairview pair can provide their display/download roles.
  const {resolveMedia}=await import('./media-catalog.js?v=20261109-delivery1');
  const row=await resolveMedia(url);
  return row?.kind==='neighbourhood'&&row.comparisonProof?.comparisonKind==='native-neighbourhood-pilot-visibility'?mediaPreviewInfo(row):null;
}
export const resolveNeighbourhoodImage = resolveStudyImage;
