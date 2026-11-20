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

// Browsers handle GET submissions from a local HTML file differently.
window.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.home-map-picker');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = new URL(form.action, document.baseURI);
    url.searchParams.set('district', form.elements.district.value);
    location.assign(url.href);
  });
});
