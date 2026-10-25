export const CITY_DATA_TERMS_URL = 'https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data';

// This notice records no consent and makes no choice for the visitor. A model
// request starts only through the visitor's load or download action.
export function cityDataNotice({loadLabel} = {}) {
  const element = document.createElement('section');
  element.className = 'city-data-terms'; element.setAttribute('aria-label', 'City data terms');
  const heading = document.createElement('h2'); heading.textContent = 'City data terms';
  const text = document.createElement('p'), link = document.createElement('a');
  link.href = CITY_DATA_TERMS_URL; link.textContent = 'City of Mississauga data terms (PDF)';
  link.target = '_blank'; link.rel = 'noopener';
  text.append('By loading, using or downloading City-derived models, you agree to be bound by the ', link, '.');
  const sharing = document.createElement('p');
  sharing.textContent = 'When sharing original or modified City data, provide these terms or their URL and require recipients to agree.';
  element.append(heading, text, sharing);
  let ready = Promise.resolve();
  if (loadLabel) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'city-data-load'; button.textContent = loadLabel;
    ready = new Promise(resolve => button.addEventListener('click', () => {
      button.disabled = true; button.textContent = 'Loading…'; resolve();
    }, {once:true}));
    element.append(button);
    ready.then(() => { button.hidden = true; });
  }
  return {element, ready};
}
