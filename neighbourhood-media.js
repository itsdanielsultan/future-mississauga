import {shortDate,shortResolution} from './image-provenance.js?v=20261028-citywide1';

export function studyImagePreview(manifest, url, baseURL) {
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
    sourceEdition: manifest.previewLabel || manifest.sourceGeometryNote,
    description: manifest.description,
    osm: manifest.sourceAttribution?.openStreetMap === true
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
  if (target.origin !== location.origin) return null;
  const entry=manifests.find(item=>target.pathname.includes(item.path));
  if (!entry) return null;
  if (!requests.has(entry.url)) requests.set(entry.url,fetch(entry.url).then(response=>response.ok?response.json():null).catch(()=>null));
  return studyImagePreview(await requests.get(entry.url),url,location.href);
}
export const resolveNeighbourhoodImage = resolveStudyImage;
