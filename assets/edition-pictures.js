// The comparison tools need the unlabelled scene. Picture galleries display the
// signed edition, including its byline, at every resolution.
let edition;
export function loadEditionPlates() {
  if (!edition) {
    edition = fetch('data/city-plates-20261120.json').then(response => {
      if (!response.ok) throw new Error('Edition unavailable');
      return response.json();
    }).then(({plates}) => new Map(plates.filter(plate => plate.webImage && plate.displayMaster?.url && plate.download?.url)
      .map(plate => [plate.id, plate]))).catch(() => new Map());
  }
  return edition;
}

export function editionPreview(info, plate) {
  if (!plate) return info;
  const full = plate.signedMaster || plate.displayMaster;
  let attribution = info.attribution || plate.attribution;
  if (plate.signedMaster && attribution?.requiredModelCredits) {
    // The full Ontario notice is printed inside every signed resolution.
    // Keep the source link and individual architecture/photography credits in the viewer.
    const ontarioNotice = /^Contains information licensed under the Open Government Licence\s*[–-]\s*Ontario\.?$/i;
    attribution = {...attribution, requiredModelCredits:attribution.requiredModelCredits.filter(line=>!ontarioNotice.test(line.trim()))};
  }
  return {...info, attribution, preview:plate.signedPreview?.url || plate.webImage, src:full.url, download:plate.download.url,
    width:full.width, height:full.height, appendedFooter:false, meta:'',
    creator:plate.signedMaster ? null : info.creator, presentation:plate.signedMaster ? null : info.presentation};
}

export function plateCaption(area, view, scenario, selectedArea = false) {
  const generic=/^(wide aerial|neighbourhood perspective|closer view|skyline|existing skyline|dated construction skyline|construction snapshot)$/i;
  const shortView={'wide aerial':'Aerial view','neighbourhood perspective':'Closer view','existing skyline':'Skyline','construction snapshot':'Skyline'};
  const primary=selectedArea ? shortView[view.toLowerCase()] || view || area : generic.test(view) || !view ? area : view;
  const phase=/existing/i.test(scenario) ? 'Existing buildings' : /construction/i.test(scenario) ? 'Under construction' : 'With proposals';
  return {title:primary, detail:selectedArea || primary===area ? phase : area+' · '+phase};
}
