// Register before the first picture is parsed, while the gallery module loads.
(() => {
  const navigation=window.fmGalleryNavigation={manual:false};
  const moved=()=>{navigation.manual=true;};
  for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,moved,{passive:true});
  window.addEventListener('hashchange',()=>{navigation.manual=false;});
  let pending = null, fallbackTimer;
  function capture(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const button = event.target.closest('[data-open]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pending?.removeAttribute('aria-busy');
    pending = button;
    pending.setAttribute('aria-busy', 'true');
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      const selected = finish();
      if (selected?.isConnected && selected.href) location.assign(selected.href);
    }, 2500);
  }
  document.addEventListener('click', capture, true);
  function finish() {
    clearTimeout(fallbackTimer);
    document.removeEventListener('click', capture, true);
    pending?.removeAttribute('aria-busy');
    const button = pending;
    pending = null;
    return button;
  }
  function start() {
    import('./gallery.js?v=20261120-plates').then(() => {
      const button = finish();
      if (button?.isConnected) button.click();
    }).catch(() => {
      const selected = finish();
      const message = document.createElement('p');
      message.className = 'gallery-load-error';
      message.setAttribute('role', 'alert');
      message.append('Open any image at full size. ');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'text-link';
      retry.textContent = 'Retry gallery previews';
      retry.addEventListener('click', () => location.reload());
      message.append(retry);
      document.querySelector('#galleryGrid').before(message);
      if (selected?.isConnected && selected.href) location.assign(selected.href);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
