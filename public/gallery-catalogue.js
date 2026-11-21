export const galleryViews = Object.freeze({
  aerial: {suffix:'-future.png', label:'Wide aerial', type:'aerial'},
  portrait: {suffix:'-portrait-future.png', label:'Neighbourhood perspective', type:'close'},
  skyline: {suffix:'-skyline-future.png', label:'Skyline', type:'skyline'},
  existing: {suffix:'-existing.png', label:'Wide aerial', type:'aerial'},
  existingSkyline: {suffix:'-skyline-existing.png', label:'Existing skyline', type:'skyline'},
  constructionSkyline: {suffix:'-skyline-construction.png', label:'Construction snapshot', type:'skyline'},
  landmark: {suffix:'-landmark-future.png', label:'Absolute World towers', type:'close'},
  junction: {suffix:'-junction-future.png', label:'Hurontario Street at Highway 403', type:'close'}
});

const selection = [
  'downtown-landmark-future.png', 'port-credit-future.png', 'streetsville-future.png',
  'lakeview-portrait-future.png', 'uptown-future.png', 'clarkson-skyline-future.png'
];

export function portraitViewTitle(file) {
  if(file==='downtown-landmark-future.png')return 'Absolute World towers';
  if(file==='downtown-junction-future.png')return 'Hurontario Street at Highway 403';
  if(file==='downtown-portrait-future.png')return 'Exchange District';
  if(file.includes('-skyline-'))return 'Skyline';
  if(file.includes('-portrait-'))return 'Neighbourhood perspective';
  return 'Wide aerial';
}

export function buildGalleryCatalogue(districts, images) {
  const rows=[];
  for (const district of districts) for (const [view,definition] of Object.entries(galleryViews)) {
    const file=district.id+definition.suffix;
    if(!images[file])continue;
    rows.push({file,district:district.id,area:images[file].caption?.area||district.name,view,viewTitle:images[file].caption?.subtitle||definition.label,type:definition.type,
      scenario:view==='constructionSkyline'?'Construction snapshot':view.startsWith('existing')?'Existing context':'Future scenario'});
  }
  return rows.sort((a,b)=>{
    const ai=selection.indexOf(a.file),bi=selection.indexOf(b.file);
    if(ai!==bi&&(ai>=0||bi>=0))return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);
    return a.area.localeCompare(b.area)||a.viewTitle.localeCompare(b.viewTitle)||a.scenario.localeCompare(b.scenario);
  });
}

export function filterGallery(rows,{area='all',view='all',search=''}={}) {
  const words=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=rows.filter(row=>(area==='all'||row.district===area)&&(view==='all'||row.type===view)&&
    words.every(word=>(row.area+' '+row.viewTitle+' '+row.scenario).toLocaleLowerCase().includes(word)));
  return {matches,visible:matches,hasMore:false};
}
