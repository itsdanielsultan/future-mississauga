// Preserve bookmarked sections from the single-page edition.
(() => {
  const here = new URL(location.href);
  const section = here.hash.slice(1);
  const oldPages = {
    pictures: 'gallery.html#pictures', perspectives: 'gallery.html#perspectives',
    film: 'film.html', transformation: 'compare.html', skyline: 'compare.html?mode=stages#skyline',
    downloads: 'downloads.html', evidence: 'sources.html#research'
  };
  const target = here.searchParams.has('scenario') ? 'compare.html?mode=stages#skyline' : oldPages[section];
  if (!target) return;
  const page = new URL(target, document.baseURI);
  if (here.searchParams.has('scenario')) page.searchParams.set('scenario', here.searchParams.get('scenario'));
  location.replace(page.href);
})();

// Changing a selection updates only the preview. A visit to the map is explicit.
window.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.home-map-picker');
  if (!form) return;
  const picker = form.elements.district;
  const image = document.getElementById('homeAreaPicture');
  const areaLink = document.getElementById('homeAreaLink');
  function showArea() {
    const district = picker.value;
    const option = picker.selectedOptions[0];
    const name = option.textContent;
    image.srcset = option.dataset.thumb + ' ' + option.dataset.thumbWidth + 'w, ' +
      option.dataset.preview + ' ' + option.dataset.previewWidth + 'w';
    image.src = option.dataset.preview;
    image.alt = name + ' with proposed development';
    areaLink.href = district === 'citywide' ? 'neighbourhoods.html' : 'place-' + district + '.html';
    const pictureLink = document.getElementById('homeAreaPictureLink');
    pictureLink.href = areaLink.href;
    pictureLink.setAttribute('aria-label', district === 'citywide' ? 'Browse neighbourhoods' : name + ' neighbourhood views');
    areaLink.firstChild.textContent = district === 'citywide' ? 'Browse neighbourhoods ' : name + ' views ';
  }
  picker.addEventListener('change', showArea);
  window.addEventListener('pageshow', showArea);
  showArea();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = new URL(form.action, document.baseURI);
    const district = picker.value;
    url.searchParams.set('district', district === 'fairview' ? 'citywide' : district);
    if (district === 'fairview') url.searchParams.set('context', 'fairview');
    location.assign(url.href);
  });
});
