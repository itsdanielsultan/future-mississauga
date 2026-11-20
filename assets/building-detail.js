const locationURL = new URL(location.href);
const back = document.querySelector('[data-directory-back]');
if (back) {
  const url = new URL('model.html', document.baseURI);
  for (const key of ['q','area','view','all']) {
    const value = locationURL.searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  back.href = url.href;
}

// Keep the original-photo link usable when the remote host cannot deliver an image.
for (const image of document.querySelectorAll('.real-photo img')) {
  image.addEventListener('error', () => { image.hidden = true; });
  if (image.complete && !image.naturalWidth) image.hidden = true;
}
