// Register before the first picture is parsed, while the gallery module loads.
(() => {
  let pending = null;
  function capture(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const button = event.target.closest('[data-open]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pending?.removeAttribute('aria-busy');
    pending = button;
    pending.setAttribute('aria-busy', 'true');
  }
  document.addEventListener('click', capture, true);
  function finish() {
    document.removeEventListener('click', capture, true);
    pending?.removeAttribute('aria-busy');
    const button = pending;
    pending = null;
    return button;
  }
  function start() {
    import('./gallery.js?v=20261101-media2').then(() => {
      const button = finish();
      if (button?.isConnected) button.click();
    }).catch(() => {
      finish();
      document.querySelectorAll('[data-open]').forEach(button => { button.disabled = true; });
      const message = document.createElement('p');
      message.className = 'gallery-load-error';
      message.setAttribute('role', 'alert');
      message.append('Pictures could not load. ');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'text-link';
      retry.textContent = 'Reload to try again';
      retry.addEventListener('click', () => location.reload());
      message.append(retry);
      document.querySelector('.hero').after(message);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
