const dateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});

export function shortDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value+'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) return '';
  return dateFormat.format(date);
}

export const shortResolution = width => Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width / 1000))+'K PNG' : '';

// A new delivery URL or presentation date does not change the model depicted.
export function pictureProvenance(renderInfo = {}, width) {
  const rendered = shortDate(renderInfo?.renderDate);
  const modelDate = shortDate(renderInfo?.sourceModelDate);
  const sourceEdition = typeof renderInfo?.sourceEdition === 'string' ? renderInfo.sourceEdition.trim() : '';
  return {
    meta: [rendered ? 'Rendered '+rendered : '', shortResolution(width)].filter(Boolean).join(' · '),
    sourceEdition: modelDate ? 'Model version: '+modelDate : renderInfo?.state === 'retained-earlier' ? 'Earlier model version' : sourceEdition ? 'Model date not recorded' : '',
    notice: renderInfo?.state === 'retained-earlier' ? 'This earlier view does not include later model changes.' : ''
  };
}

// Use the page's existing exact mapping. Nearby or similarly named studies are not evidence.
export function cityMapLinkForSection(section, baseURL) {
  if (!section?.id) return '';
  const base = new URL(baseURL);
  const explicit = section.dataset?.previewExplore;
  for (const anchor of section.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href');
    let url;
    try { url = new URL(href, base); } catch { continue; }
    if (url.origin !== base.origin || url.pathname.split('/').pop() !== 'explore.html') continue;
    if (url.searchParams.get('project') === section.id || (href === explicit && url.searchParams.get('context'))) return href;
  }
  return '';
}
