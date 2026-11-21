import {editionPreview} from './edition-pictures.js';

// Divider images keep the scene unobstructed. Every switch replaces all old
// candidates, including the larger candidate left by another neighbourhood.
export function setPairImage(image, area, name, state) {
  const prefix = 'gallery/edition-20261120/';
  const downtown = area === 'downtown';
  const file = 'wide-' + area + '-' + state + '.webp';
  const small = prefix + (downtown ? 'home-' + state + '-1200.webp' : 'thumbnails/' + file);
  const large = prefix + (downtown ? 'home-' + state + '-2560.webp' : file);
  image.sizes = '(min-width:1440px) 1320px, 92vw';
  image.srcset = small + (downtown ? ' 1200w, ' : ' 640w, ') + large + (downtown ? ' 2560w' : ' 1600w');
  image.src = small;
  image.alt = name + (state === 'future' ? ' with proposed development' : ' with existing buildings');
}

export function stageFrame(source, plate) {
  if (!plate) return source;
  const frame = editionPreview(source, plate);
  return {...frame, responsive:frame.src, previewWidth:plate.signedPreview?.width || plate.width};
}

export function setStageImage({image, opener, download}, view, frame, label) {
  opener.dataset.view = view;
  opener.setAttribute('aria-label', 'Expand Downtown · ' + label);
  image.srcset = frame.preview + ' ' + (frame.previewWidth || 1200) + 'w, ' +
    frame.responsive + ' ' + (frame.previewWidth ? frame.width : 3200) + 'w';
  image.src = frame.preview;
  image.alt = frame.alt;
  download.href = frame.download;
  download.setAttribute('aria-label', 'Download Downtown · ' + label + ' as a signed PNG');
}
