// Preserve bookmarked sections from the single-page edition.
(() => {
  const here = new URL(location.href);
  const section = here.hash.slice(1);
  const oldPages = {
    pictures: 'gallery.html#pictures', perspectives: 'gallery.html#perspectives',
    film: 'film.html', transformation: 'compare.html',
    downloads: 'downloads.html', evidence: 'sources.html#research'
  };
  const target = oldPages[section];
  if (!target) return;
  const page = new URL(target, document.baseURI);
  for (const [key,value] of here.searchParams) page.searchParams.set(key,value);
  location.replace(page.href);
})();

// Keep the options inside the viewport without moving the page when a visitor
// opens the picker near the bottom edge. The select retains native type-ahead,
// arrow keys, labels and form submission. Older browsers use the native popup.
function createAreaMenu(form, picker) {
  if (!('showPopover' in HTMLElement.prototype)) return null;
  const label = form.querySelector('label[for="homeDistrict"]');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'area-trigger';
  button.id = 'homeAreaTrigger';
  button.setAttribute('aria-haspopup','listbox');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls',picker.id);
  label.id = 'homeAreaLabel';
  label.htmlFor = button.id;
  button.setAttribute('aria-labelledby',label.id + ' ' + button.id);
  picker.setAttribute('aria-labelledby',label.id);
  const list = document.createElement('div');
  list.className = 'area-options';
  list.popover = 'auto';
  picker.before(button, list);
  // The enhanced menu is a scrolling listbox, independent of the closed-select skin.
  picker.classList.remove('ui-select');
  picker.size = 8;
  list.append(picker);
  function position() {
    const r = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    const bottom = top + (viewport?.height || innerHeight);
    const roomAbove = Math.max(0, r.top - top - 10);
    const roomBelow = Math.max(0, bottom - r.bottom - 10);
    const up = roomAbove > roomBelow && roomBelow < 304;
    const height = Math.max(46, Math.min(304, up ? roomAbove : roomBelow));
    list.style.width = r.width + 'px';
    list.style.left = r.left + 'px';
    list.style.top = (up ? r.top - height - 4 : r.bottom + 4) + 'px';
    picker.style.height = Math.max(36, height - 10) + 'px';
  }
  let initial;
  const isOpen = () => list.matches(':popover-open');
  function setOpen(open) {
    if (open) {
      initial = picker.selectedIndex;
      position();
      list.showPopover();
      picker.focus({preventScroll:true});
    } else if (isOpen()) {
      list.hidePopover();
      button.focus({preventScroll:true});
    }
  }
  button.addEventListener('click', () => setOpen(!isOpen()));
  button.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  });
  list.addEventListener('toggle', () => button.setAttribute('aria-expanded',String(isOpen())));
  picker.addEventListener('click', event => {
    const option = event.target.closest('option');
    if (!option) return;
    // Accessibility activation can deliver the click before the native listbox commits it.
    picker.value = option.value;
    picker.dispatchEvent(new Event('change', {bubbles:true}));
    setOpen(false);
  });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      if (event.key === 'Escape') picker.selectedIndex = initial;
      picker.dispatchEvent(new Event('change',{bubbles:true}));
      setOpen(false);
    } else if (event.key === 'Tab') {
      // Return focus to the trigger before the native Tab action finds the next control.
      setOpen(false);
    }
  });
  window.addEventListener('resize', () => { if (isOpen()) position(); });
  window.addEventListener('scroll', () => { if (isOpen()) position(); }, {passive:true});
  return button;
}

// Changing a selection updates only the preview. A visit to the map is explicit.
window.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.home-map-picker');
  if (!form) return;
  const picker = form.elements.district;
  const image = document.getElementById('homeAreaPicture');
  const areaLink = document.getElementById('homeAreaLink');
  const trigger = createAreaMenu(form, picker);
  function showArea() {
    const district = picker.value;
    const option = picker.selectedOptions[0];
    const name = option.textContent;
    if (trigger) trigger.textContent = name;
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
    url.searchParams.set('scenario', 'future');
    url.searchParams.set('appearance', 'status');
    if (district === 'fairview') url.searchParams.set('context', 'fairview');
    location.assign(url.href);
  });
});
