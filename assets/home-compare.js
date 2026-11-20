// Swapping the complete plate keeps the caption, north arrow and files together.
export function selectHomePlate(figure, selection) {
  const button = figure.parentElement.querySelector('[data-plate-state="' + selection + '"]');
  if (!button) return;
  const map = figure.parentElement.querySelector('[data-home-map]');
  if (map) map.href = 'explore.html?district=downtown&scenario=' + selection;
  const image = figure.querySelector('#heroImage');
  image.srcset = button.dataset.small + ' 1200w, ' + button.dataset.large + ' 2560w';
  image.src = button.dataset.small;
  image.alt = button.dataset.description;
  const open = figure.querySelector('.plate-open');
  open.href = button.dataset.original;
  open.dataset.previewDownload = button.dataset.original;
  open.dataset.previewTitle = button.dataset.title;
  open.setAttribute('aria-label','Enlarge ' + button.dataset.title);
  figure.querySelector('[data-plate-download]').href = button.dataset.original;
  figure.querySelector('[data-plate-print]').href = button.dataset.print;
  figure.querySelector('[data-plate-caption]').textContent = button.dataset.title;
  for (const option of figure.parentElement.querySelectorAll('[data-plate-state]')) {
    option.setAttribute('aria-pressed',String(option === button));
  }
}
const plate = document.querySelector('.city-plate');
if (plate) {
  const group = plate.parentElement.querySelector('.home-plate-switch');
  if (group) {
    group.hidden = false;
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-plate-state]');
      if (button) selectHomePlate(plate,button.dataset.plateState);
    });
  }
}
