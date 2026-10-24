// Enhance the real portrait links with an on-site, keyboard-accessible preview.
// Full-size links keep working without JavaScript; this uses the display PNG.
export function installSocialPreview(root = document) {
  const links = [...root.querySelectorAll('.social-grid .image-link')];
  if (!links.length || typeof HTMLDialogElement === 'undefined') return null;
  const dialog = document.createElement('dialog');
  dialog.className = 'picture-preview';
  dialog.setAttribute('aria-labelledby', 'socialPreviewTitle');
  dialog.innerHTML = `
    <div class="picture-preview__shell">
      <header class="picture-preview__header">
        <div><h2 id="socialPreviewTitle"></h2><p class="picture-preview__caption"></p></div>
        <button class="picture-preview__close" type="button" aria-label="Close picture" autofocus>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="picture-preview__stage" aria-busy="true">
        <img class="picture-preview__image" alt="">
        <p class="picture-preview__status" role="status">Loading picture…</p>
      </div>
      <footer class="picture-preview__footer">
        <a class="picture-preview__download" download>Download PNG <span aria-hidden="true">↓</span></a>
        <span class="picture-preview__source" hidden><a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · </span><a href="sources.html">Sources &amp; credits</a>
      </footer>
    </div>`;
  document.body.append(dialog);
  const title = dialog.querySelector('h2');
  const caption = dialog.querySelector('.picture-preview__caption');
  const image = dialog.querySelector('img');
  const stage = dialog.querySelector('.picture-preview__stage');
  const status = dialog.querySelector('.picture-preview__status');
  const download = dialog.querySelector('[download]');
  let opener = null;
  let imageRequest = 0;
  let backdropDown = false;
  const inside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const settleImage = success => {
    stage.setAttribute('aria-busy', 'false');
    image.hidden = !success;
    status.hidden = success;
    status.textContent = success ? '' : 'The preview could not load. You can still download the PNG.';
  };
  image.addEventListener('load', () => settleImage(true));
  image.addEventListener('error', () => settleImage(false));
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = dialog.querySelector('.picture-preview__close');
    const last = [...dialog.querySelectorAll('.picture-preview__footer a[href]')].filter(node => node.getClientRects().length).at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('pointerdown', event => {
    backdropDown = event.target === dialog && !inside(event);
  });
  dialog.addEventListener('click', event => {
    if (backdropDown && event.target === dialog && !inside(event)) dialog.close();
    backdropDown = false;
  });
  dialog.addEventListener('close', () => {
    imageRequest++;
    document.documentElement.classList.remove('picture-preview-open');
    opener?.focus({ preventScroll: true });
  });
  for (const link of links) {
    const card = link.closest('article');
    const thumb = link.querySelector('img');
    if (!card || !thumb) continue;
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-label', 'Preview ' + (thumb.alt || card.querySelector('h2')?.textContent || 'picture'));
    const previewButton = card.querySelector('.picture-open');
    const openPreview = (event, trigger) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = trigger;
      title.textContent = card.querySelector('h2')?.textContent || 'Picture';
      const state = card.querySelector('.picture-state, .eyebrow')?.textContent?.trim();
      const date = card.querySelector('.social-note')?.textContent?.trim();
      caption.textContent = [state, date].filter(Boolean).join(' · ');
      dialog.querySelector('.picture-preview__source').hidden = card.dataset.osm === 'false';
      download.href = card.querySelector('.save')?.href || link.href;
      download.download = new URL(download.href).pathname.split('/').pop();
      image.alt = thumb.alt;
      image.hidden = true;
      status.hidden = false;
      status.textContent = 'Loading picture…';
      stage.setAttribute('aria-busy', 'true');
      image.width = Number(card.dataset.displayWidth || thumb.width);
      image.height = Number(card.dataset.displayHeight || thumb.height);
      image.src = thumb.currentSrc || thumb.src;
      const request = ++imageRequest, masterURL = card.dataset.displayUrl;
      if (masterURL) {
        const native = new Image();
        native.onload = () => { if (request === imageRequest) image.src = masterURL; };
        native.onerror = () => {
          if (request !== imageRequest) return;
          status.hidden = false;
          status.textContent = 'Full-resolution preview unavailable. The small preview and PNG download are still available.';
        };
        native.src = masterURL;
      }
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('picture-preview-open');
      if (image.complete) settleImage(image.naturalWidth > 0);
    };
    link.addEventListener('click', event => openPreview(event, link));
    if (previewButton) {
      previewButton.hidden = false;
      previewButton.setAttribute('aria-haspopup', 'dialog');
      previewButton.setAttribute('aria-label', link.getAttribute('aria-label'));
      previewButton.addEventListener('click', event => openPreview(event, previewButton));
    }
  }
  return dialog;
}
