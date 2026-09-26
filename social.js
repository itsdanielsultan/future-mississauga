const retryPreview = image => {
  if (image.dataset.retried) return;
  image.dataset.retried = 'true';
  const url = new URL(image.src, document.baseURI);
  url.searchParams.set('retry', '1');
  image.src = url.href;
};
document.querySelectorAll('.social-grid img').forEach(image => {
  image.addEventListener('error', () => retryPreview(image));
  if (image.complete && image.currentSrc && !image.naturalWidth) retryPreview(image);
});
document.querySelector('#areaFilter').addEventListener('change', event => {
  let count = 0;
  document.querySelectorAll('.social-grid article').forEach(card => {
    card.hidden = event.target.value !== 'all' && card.dataset.district !== event.target.value;
    if (!card.hidden) {
      count++;
      const image = card.querySelector('img');
      if (image.complete && image.currentSrc && !image.naturalWidth) retryPreview(image);
    }
  });
  document.querySelector('#resultCount').textContent = count + ' picture' + (count === 1 ? '' : 's');
});
