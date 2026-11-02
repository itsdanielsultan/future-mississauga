export const CITY_DATA_TERMS_URL = 'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data';

// Keep the source terms in the source disclosure, without a gate or assent copy.
export function cityDataNotice() {
  const element = document.createElement('p');
  element.className = 'city-data-terms'; element.setAttribute('aria-label', 'City data terms');
  const link = document.createElement('a');
  link.href = CITY_DATA_TERMS_URL; link.textContent = 'City of Mississauga data terms';
  link.target = '_blank'; link.rel = 'noopener';
  element.append(link);
  return {element};
}
