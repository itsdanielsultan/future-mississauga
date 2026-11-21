import {readFile, writeFile, rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildGalleryCatalogue} from '../public/gallery-catalogue.js';
import {plateCaption, publicationResolution} from '../public/edition-pictures.js';

const site = new URL('../public/',import.meta.url);
const read = path => readFile(new URL(path,site),'utf8');
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups = [['close','Landmarks and closer views'],['aerial','Neighbourhood aerials'],['skyline','Skylines']];
const icon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg>';

export function staticLandscapeGallery(districts,plates) {
  const assets = new Map(plates.filter(p=>p.id.startsWith('wide/')).map(p=>[p.id.slice(5),p]));
  const images=Object.fromEntries([...assets].map(([file,p])=>[file,{caption:{area:p.area,
    subtitle:file==='downtown-portrait-future.png'?'Exchange District':null}}]));
  const rows=buildGalleryCatalogue(districts,images);
  if(rows.length!==assets.size) throw Error('Some landscape plates are missing from the gallery catalogue.');
  const used=new Set(rows.map(row=>row.district));
  const options=districts.filter(d=>used.has(d.id)).sort((a,b)=>a.name.localeCompare(b.name))
    .map(d=>`<option value="${escape(d.id)}">${escape(d.name)}</option>`).join('');
  function card(row) {
    const {signedThumbnail:small,signedPreview:preview,signedMaster:full,download}=assets.get(row.file);
    if(![small,preview,full,download].every(record=>record?.url&&record.width&&record.height))throw Error('Unsigned or incomplete gallery plate: '+row.file);
    const fullName=[row.area,row.viewTitle,row.scenario].join(' · ');
    const caption=plateCaption(row.area,row.viewTitle,row.scenario);
    return `<article class="picture-card" data-file="${escape(row.file)}" data-area-title="${escape(row.area)}" data-view-title="${escape(row.viewTitle)}" data-type="${row.type}" data-scenario="${escape(row.scenario)}"><a href="${escape(full.url)}" data-open="${escape(row.district)}" data-view="${escape(row.view)}" aria-label="Preview ${escape(fullName)}"><img src="${escape(small.url)}" srcset="${escape(small.url)} ${small.width}w, ${escape(preview.url)} ${preview.width}w" sizes="(max-width: 560px) calc(100vw - 32px), (max-width: 1440px) 46vw, 650px" width="${preview.width}" height="${preview.height}" alt="${escape(fullName)}" loading="lazy" decoding="async"></a><div class="card-caption"><div><h3>${escape(caption.title)}</h3><span class="media-caption__scenario">${escape(caption.detail)}</span></div><a href="${escape(download.url)}" download class="icon-button ui-button" aria-label="Download ${escape(fullName)} PNG" data-variant="ghost" data-size="icon" data-resolution="${publicationResolution(download)}" title="Download PNG (${download.width} × ${download.height})">${icon}</a></div></article>`;
  }
  const content=groups.map(([type,title])=>{
    const members=rows.filter(row=>row.type===type);
    return members.length ? `<h2 class="gallery-collection-title" data-gallery-group="${type}">${title}</h2>\n`+members.map(card).join('\n') : '';
  }).filter(Boolean).join('\n');
  return {content,options,count:rows.length};
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const html=await read('gallery.html');
  const arg=process.argv.indexOf('--edition');
  const stamp=arg!==-1 ? process.argv[arg+1] : /data-edition="(\d{8})"/.exec(html)?.[1];
  if(!/^\d{8}$/.test(stamp))throw Error('Supply --edition YYYYMMDD');
  const [districts, edition]=await Promise.all([read('data/districts.json'),read('data/city-plates-'+stamp+'.json')]);
  const {content,options,count}=staticLandscapeGallery(JSON.parse(districts),JSON.parse(edition).plates);
  const out=html.replace(/(<select[^>]+id="galleryArea"[^>]*>)[\s\S]*?<\/select>/,'$1<option value="all">All areas</option>'+options+'</select>')
    .replace(/(<p[^>]+id="galleryResult"[^>]*>)[^<]*<\/p>/,'$1'+count+' images</p>')
    .replace(/<!-- landscape gallery -->[\s\S]*?<!-- end landscape gallery -->/,'<!-- landscape gallery -->\n<div id="galleryGrid" class="gallery-grid" data-edition="'+stamp+'">\n'+content+'\n</div>\n<!-- end landscape gallery -->');
  if(!out.includes(content))throw Error('Gallery build markers are missing');
  if(out!==html) {
    const tmp=new URL('gallery.html.partial',site);
    await writeFile(tmp,out);await rename(tmp,new URL('gallery.html',site));
  }
  console.log(count+' signed landscape views, '+stamp);
}
