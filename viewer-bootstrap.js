try {
  await import('./app.js?v=20261025-mobile1');
} catch (error) {
  const loading = document.querySelector('#loading');
  loading.hidden = false;
  loading.style.display = 'grid';
  loading.replaceChildren(document.createTextNode('The 3D map could not start. Please try again. You can still browse the city gallery and project sources.'));
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry map';
  retry.addEventListener('click', () => location.reload());
  const gallery = document.createElement('a');
  gallery.href = './#pictures';
  gallery.textContent = 'Browse city pictures';
  loading.append(retry, gallery);
  document.querySelector('#sceneWrap').setAttribute('aria-busy', 'false');
  console.error('Map startup failed', error);
}
