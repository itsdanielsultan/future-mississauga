import {assetURL} from './asset-delivery.js?v=20261109-delivery1';
import {createImagePreview} from './image-preview.js?v=20261109-delivery1';
import {mediaPreviewInfo,comparisonPair} from './clean-media.js?v=20261109-feedback1';
import {refreshPictureAssets} from './media-catalog.js?v=20261109-delivery1';
import {bindComparison} from './comparison.js?v=20261023-usability1';
const $=s=>document.querySelector(s);
const [districts,pictures]=await Promise.all(['districts','picture-assets'].map(x=>fetch('data/'+x+'.json',{cache:'no-store'}).then(r=>r.json())));
await refreshPictureAssets(pictures);
const original=name=>{const image=pictures.images[name];if(!image)throw new Error('Original picture missing: '+name);return assetURL(image.url+'?edition='+image.sha256.slice(0,16));};
const display=name=>{const image=pictures.images[name]?.display;if(!image)throw new Error('Display picture missing: '+name);return image.url;};
const hero=$('#heroImage');if(hero)hero.src=display('downtown-future.png');
const heroDownload=$('.hero a[download]');if(heroDownload)heroDownload.href=assetURL(pictures.images['downtown-future.png'].download?.url||pictures.images['downtown-future.png'].url);
function refreshPanorama(figure,row){
 if(!figure||!row)return;
 const image=figure.querySelector('img'),previewLink=figure.querySelector('a:not([download])'),download=figure.querySelector('a[download]');
 if(image)image.src=row.display.url;
 if(previewLink)previewLink.href=assetURL(row.displayMaster.url);
 if(download)download.href=assetURL(row.download?.url||row.url);
}
document.querySelectorAll('figure[data-picture]').forEach(figure=>refreshPanorama(figure,pictures.images[figure.dataset.picture]));
const ordered=['downtown','port-credit','lakeview','clarkson','cooksville','uptown','erin-mills','streetsville','meadowvale','malton','dixie-applewood','erindale','airport-corporate','heartland','citywide'].map(id=>districts.find(d=>d.id===id)).filter(Boolean);
$('#galleryGrid').innerHTML=ordered.filter(d=>d.id!=='downtown').map((d,i)=>`<article class="picture-card"><button data-open="${d.id}" aria-label="Open ${d.name} picture"><img src="${display(d.id+'-future.png')}" alt="Architectural model picture of ${d.name}, Mississauga" loading="lazy"></button><div class="card-caption"><div><h3>${d.name}</h3></div><a href="explore.html?district=${d.id}" class="icon-button" aria-label="Explore ${d.name} in 3D"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></article>`).join('');
const portraitIds=['downtown','port-credit','lakeview','clarkson','cooksville','uptown'].filter(id=>pictures.images[id+'-portrait-future.png']);
$('#perspectiveGrid').innerHTML=portraitIds.map(id=>{const d=districts.find(x=>x.id===id);return `<article class="picture-card"><button data-open="${id}" data-view="portrait" aria-label="Open ${d.name} perspective"><img src="${display(id+'-portrait-future.png')}" alt="Perspective architectural model of ${d.name}" loading="lazy"></button><div class="card-caption"><div><span>PERSPECTIVE</span><h3>${d.name}</h3></div><a href="${original(id+'-portrait-future.png')}" download class="icon-button" aria-label="Download ${d.name} full-resolution PNG"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg></a></div></article>`;}).join('');
for(const [view,title] of [['landmark','Absolute World'],['junction','The City Centre connection']]){const name='downtown-'+view+'-future.png';if(pictures.images[name])$('#perspectiveGrid').insertAdjacentHTML('beforeend',`<article class="picture-card"><button data-open="downtown" data-view="${view}" aria-label="Open ${title}"><img src="${display(name)}" alt="${title} architectural model detail" loading="lazy"></button><div class="card-caption"><div><span>DETAIL</span><h3>${title}</h3></div><a href="${original(name)}" download class="icon-button" aria-label="Download ${title} full-resolution PNG"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg></a></div></article>`);}
const preview=createImagePreview({views:true});let openDistrict=null,opener=null;
const viewFiles={aerial:'-future.png',portrait:'-portrait-future.png',skyline:'-skyline-future.png',existing:'-existing.png',existingSkyline:'-skyline-existing.png',constructionSkyline:'-skyline-construction.png',landmark:'-landmark-future.png',junction:'-junction-future.png'};
const viewNames={aerial:'Wide aerial',portrait:'Perspective',skyline:'Skyline panorama',existing:'Existing context',existingSkyline:'Existing skyline',constructionSkyline:'Dated construction skyline',landmark:'Absolute World detail',junction:'City Centre interchange'};
function showPicture(view){
 const d=openDistrict,file=d.id+viewFiles[view],info=pictures.images[file];
 preview.show({...mediaPreviewInfo({...info,title:info.title||d.name,preview:info.preview||info.display}),explore:'explore.html?district='+d.id},opener);
}
document.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>{
 opener=button;openDistrict=districts.find(d=>d.id===button.dataset.open);
 const available=Object.keys(viewFiles).filter(view=>pictures.images[openDistrict.id+viewFiles[view]]);
 const view=available.includes(button.dataset.view)?button.dataset.view:'aerial';
 preview.setViews(available.map(value=>({value,label:viewNames[value]})),view,showPicture);showPicture(view);
});
bindComparison({panel:$('#pictureCompare'),clickToJump:true,handle:$('#compareDivider'),input:$('#pictureSlider'),onChange:n=>$('#beforePicture').style.clipPath=`inset(0 ${100-n}% 0 0)`});

function showComparison(id){const pair=comparisonPair(pictures,id);if(!pair)return;const name=districts.find(d=>d.id===id).name;
 const assign=(image,row,label)=>{const url=row.cleanPresentation?row.responsive.url:row.display.url;image.removeAttribute('sizes');image.srcset=url+' 1x';image.src=url;image.alt=label;};
 assign($('#pictureCompare > img'),pair[1],`${name} future scenario`);assign($('#beforePicture img'),pair[0],`${name} existing context`);
}
$('#comparisonDistrict').addEventListener('change',e=>showComparison(e.target.value));
showComparison($('#comparisonDistrict').value||'downtown');

