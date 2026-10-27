export const CITY_DATA_TERMS_URL = 'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data';

// The City's Authority clause permits agreement through use or download.
// Keep its terms available without introducing a loading gate or consent state.
export function cityDataNotice() {
  const element = document.createElement('p');
  element.className = 'city-data-terms'; element.setAttribute('aria-label', 'City data terms');
  const link = document.createElement('a');
  link.href = CITY_DATA_TERMS_URL; link.textContent = 'City of Mississauga data terms';
  link.target = '_blank'; link.rel = 'noopener';
  element.append('By using or downloading this City-derived model, you agree to the ', link, '.');
  return {element};
}
