import fs from 'node:fs/promises';
import {buildingThumbnail} from '../public/building-thumbnail-binding.js';

const root = new URL('../public/', import.meta.url);
const read = name => fs.readFile(new URL(name, root), 'utf8');
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ');
const text = value => decode(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '');
const manifest = JSON.parse(await read('data/model-previews.json'));
const thumbnails = JSON.parse(await read('data/building-thumbnails.json'));
const neighbourhoodImages = JSON.parse(await read('data/neighbourhood-media-20261102.json')).images.flatMap(row => row.responsivePreviews || []);
const districts = JSON.parse(await read('data/districts.json'));
const areas = new Map(districts.map(row => [row.id, row.name]));
const projects = JSON.parse(await read('data/projects.json'));
const projectById = new Map(projects.map(row => [row.id, row]));
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function projectDistrict(project, fallback = 'citywide') {
  if (areas.has(project?.viewerDistrict)) return project.viewerDistrict;
  const explicit = project?.viewerDistricts?.find(id => areas.has(id));
  if (explicit) return explicit;
  if (project?.position) {
    const [x,,z] = project.position;
    const choices = districts.filter(d => d.id !== 'citywide' && x >= d.bounds[0] && x <= d.bounds[2] && z >= d.bounds[1] && z <= d.bounds[3]);
    const named = normalize(project.district);
    const matched = choices.find(d => named.includes(normalize(d.name)) || named.includes(normalize(d.id))) || choices.sort((a,b) => a.radius-b.radius)[0];
    if (matched) return matched.id;
  }
  const namedDistrict=districts.find(d=>normalize(project?.district)===normalize(d.id)||normalize(project?.district)===normalize(d.name));
  if(namedDistrict)return namedDistrict.id;
  return areas.has(fallback) ? fallback : 'citywide';
}
const modelProjects = {'mcity-pair':'mcity-1-2','mcity-m1':'mcity-1-2','mcity-m2':'mcity-1-2','avia-1':'avia','avia-2':'avia','edge-1':'edge-oro','edge-2':'edge-oro','oro':'edge-oro'};
const entries = new Map();
for (const row of manifest.views) {
  const projectId = row.projectId || modelProjects[row.id] || row.id;
  const project = projectById.get(projectId);
  const district = projectDistrict(project);
  entries.set(row.id, {
    id: row.id, projectId, title: row.title, area: areas.get(district), areaId: district, address: project?.address || '',
    description: row.subtitle.split(' · ')[0],
    image: buildingThumbnail(row, manifest, thumbnails),
    credit: row.visibleReferenceCredit || null,
    links: [{label: 'Explore model', url: `model.html?model=${encodeURIComponent(row.id)}`, kind: 'model'}, ...(project ? [{label:'City map',url:`explore.html?district=${district}&project=${projectId}`,kind:'city'}] : [])]
  });
}
for (const [page, className, label] of [['review-renders.html', 'render-project', 'View study'], ['reference-updates.html', 'model-change', 'View study']]) {
  const html = await read(page);
  for (const match of html.matchAll(new RegExp(`<section class="${className}"[^>]*>.*?<\\/section>`, 'gs'))) {
    const section = match[0], opening = section.slice(0, section.indexOf('>') + 1), id = attr(opening, 'id');
    const title = text(section.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1] || id);
    const rawArea = text(section.match(/<(?:p|div) class="eyebrow"[^>]*>(.*?)<\/(?:p|div)>/s)?.[1] || 'Mississauga').split(' · ')[0];
    const city = [...section.matchAll(/<a\b[^>]*>/g)].map(m => attr(m[0], 'href')).find(url => url.startsWith('explore.html?'));
    const cityParams = new URLSearchParams(city?.split('?')[1] || '');
    const projectId = cityParams.get('project') || id;
    const project = projectById.get(projectId);
    const namedDistrict = districts.find(d => normalize(rawArea) === normalize(d.name) || normalize(rawArea) === normalize(d.id));
    const areaAlias = {'City Centre':'downtown','Zonta Meadows Park':'downtown'}[rawArea];
    const district = projectDistrict(project, cityParams.get('district') || namedDistrict?.id || areaAlias);
    const area = areas.get(district);
    const existing = entries.get(id);
    const imageTag = [...section.matchAll(/<img\b[^>]*>/g)].at(-1)?.[0] || '';
    const imageURL = attr(imageTag, 'src');
    // Use a published web derivative when one exists. Do not fetch a multi-MB
    // original merely to decorate the index or manufacture replacement imagery.
    const imageDimensions = neighbourhoodImages.find(image => image.url === imageURL)?.dimensions;
    const image = /\.(?:avif|webp|jpe?g)(?:\?|$)/i.test(imageURL) ? {url: imageURL, width: imageDimensions?.[0] || Number(attr(imageTag, 'width')) || 1200, height: imageDimensions?.[1] || Number(attr(imageTag, 'height')) || 900} : null;
    const entry = existing || {id, projectId, title, area, areaId: district, location:rawArea, address:project?.address || '', description: '', image, credit: null, links: []};
    entry.links.push({label, url: `${page}#${id}`, kind: 'study'});
    if (city && !entry.links.some(link => link.kind === 'city')) entry.links.push({label: 'City map', url: project ? `explore.html?district=${district}&project=${projectId}` : city, kind: 'city'});
    entries.set(id, entry);
  }
}
const covered = new Set([...entries.values()].map(entry => entry.projectId));
for (const project of [...projects].sort((a,b) => a.name.localeCompare(b.name))) {
  if (covered.has(project.id)) continue;
  const district = projectDistrict(project);
  entries.set(project.id, {id:project.id, projectId:project.id, title:project.name, area:areas.get(district), areaId:district, address:project.address || '', description:'', image:null, credit:null, links:[{label:'City map',url:`explore.html?district=${district}&project=${project.id}`,kind:'city'}]});
}
const directoryPictures = JSON.parse(await read('data/directory-pictures.json'));
for (const picture of directoryPictures.entries) {
  const entry = entries.get(picture.id);
  if (entry && !entry.image) {
    entry.image = picture.image;
    entry.imageKind = picture.kind;
    entry.imageLabel = picture.label;
  }
}
const data = {schema: 'future-mississauga-building-catalogue/v1', entries: [...entries.values()]};
await fs.writeFile(new URL('data/building-catalogue.json', root), JSON.stringify(data, null, 2) + '\n');
const encode = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;');
for (const [page, className] of [['review-renders.html','render-project'],['reference-updates.html','model-change']]) {
  const source = await read(page);
  const updated = source.replace(new RegExp(`<section class="${className}"[^>]*>`, 'g'), opening => {
    const entry = entries.get(attr(opening, 'id'));
    return entry ? opening.replace(/ data-area="[^"]*"/, '').replace(/>$/, ` data-area="${encode(entry.area)}">`) : opening;
  });
  if(updated !== source) await fs.writeFile(new URL(page, root), updated);
}
console.log(`${data.entries.length} public building and neighbourhood studies indexed.`);
