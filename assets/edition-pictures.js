// The comparison tools need the unlabelled scene. Picture galleries display the
// signed edition, including its byline, at every resolution.
const editions = new Map();
export function loadEditionPlates(source = 'data/city-plates-20261121.json') {
  if (!editions.has(source)) {
    const edition = fetch(source).then(response => {
      if (!response.ok) throw new Error('Edition unavailable');
      return response.json();
    }).then(({plates}) => new Map(plates.filter(plate => plate.webImage && plate.displayMaster?.url && plate.download?.url)
      .map(plate => [plate.id, plate]))).catch(() => {
        editions.delete(source);
        return new Map();
      });
    editions.set(source,edition);
  }
  return editions.get(source);
}

export function editionPreview(info, plate) {
  if (!plate) return info;
  const full = plate.signedMaster || plate.displayMaster;
  const size=publicationResolution(plate.download);
  const scenario=plate.label?.split(' · ').at(-1)?.replace('With proposed projects','With proposals').replace('Construction snapshot','Under construction');
  const view=(info.viewTitle || '').replace(/^(?:Future|Existing) (aerial|skyline)$/i,'$1')
    .replace(/^Wide aerial$/i,'Aerial').replace(/^(?:Future perspective|Neighbourhood perspective)$/i,'Closer view')
    .replace(/^(?:Dated construction skyline|Construction snapshot)$/i,'Skyline');
  const namedView=view && ![plate.area,scenario].some(name => name?.toLowerCase()===view.toLowerCase());
  const description=[namedView ? view.charAt(0).toUpperCase()+view.slice(1) : '',scenario].filter(Boolean).join(' · ');
  return {...info, attribution:plate.attribution || info.attribution, preview:plate.signedPreview?.url || plate.webImage, src:full.url, download:plate.download.url,
    width:full.width, height:full.height, appendedFooter:false, meta:description, placeTitle:plate.area, resolution:size,
    downloadDimensions:plate.download.width+' × '+plate.download.height, creditsInImage:Boolean(plate.signedMaster && plate.signedPreview),
    creator:plate.signedMaster ? null : info.creator, presentation:plate.signedMaster ? null : info.presentation};
}

// Use the downloadable artwork's long edge, including for portrait images.
export function publicationResolution(file) {
  const edge=Math.max(file?.width || 0,file?.height || 0);
  if (!edge) return '';
  return edge<1024 ? edge+' px' : Math.round(edge/1024*2)/2+'K';
}

export function plateCaption(area, view, scenario, selectedArea = false) {
  const generic=/^(wide aerial|neighbourhood perspective|closer view|skyline|existing skyline|dated construction skyline|construction snapshot)$/i;
  const shortView={'wide aerial':'Aerial view','neighbourhood perspective':'Closer view','existing skyline':'Skyline','construction snapshot':'Skyline'};
  const primary=selectedArea ? shortView[view.toLowerCase()] || view || area : generic.test(view) || !view ? area : view;
  const phase=/existing/i.test(scenario) ? 'Existing buildings' : /construction/i.test(scenario) ? 'Under construction' : 'With proposals';
  return {title:primary, detail:selectedArea || primary===area ? phase : area+' · '+phase};
}
