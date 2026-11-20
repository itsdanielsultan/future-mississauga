// Keep each thumbnail, inspectable scene and credited download in the same edition.
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
  const {width, height, url} = plate.displayMaster;
  const date = new Date(plate.originalRender);
  const dateLabel = plate.originalRender && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(date)
    : '';
  return {...info, preview:plate.webImage, src:url, download:plate.download.url, width, height,
    appendedFooter:false, meta:[dateLabel, width.toLocaleString('en-CA') + ' × ' + height.toLocaleString('en-CA')].filter(Boolean).join(' · ')};
}
