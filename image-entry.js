// Register before content is parsed so ordinary file links cannot win the first click.
(() => {
  const key = Symbol.for('future-mississauga.image-entry');
  if (globalThis[key]) return;
  globalThis[key] = true;
  let pending = null, failed = false, notice = null;
  const imageFile = url => /\.(png|jpe?g|webp|avif|svg)(\?|#|$)/i.test(url);
  function candidate(target) {
    if (!target.closest('main') || target.closest('dialog,.picture-compare,.site-brand')) return null;
    const trigger = target.closest('a,button');
    const anchor = trigger?.matches('a') ? trigger : null;
    if (target.closest('[data-download]') || anchor?.matches('.save,.download-icon,.file-download,.media-preview__download,.document-download') || /^Download\b/i.test(anchor?.textContent.trim() || '')) return null;
    if (anchor) {
      const url = new URL(anchor.href, location.href);
      const knownPDF = anchor.hasAttribute('data-document-preview') ||
        (url.origin === location.origin && /\/downloads\/(Future-Mississauga-Atlas(?:-\d{8}-[a-f0-9]{12})?|City-of-Mississauga-Open-Data-Terms)\.pdf$/.test(url.pathname)) ||
        (url.hostname === 'github.com' && url.pathname.startsWith('/itsdanielsultan/future-mississauga/releases/download/') && url.pathname.endsWith('-review.pdf'));
      if (knownPDF) return anchor;
    }
    // The gallery has its own queued entry and comparison interaction.
    if (target.closest('[data-open]')) return null;
    if (anchor?.querySelector('svg')) return null;
    const img = target.closest('img') || trigger?.querySelector('img');
    return img || (anchor && imageFile(anchor.href)) ? trigger || img : null;
  }
  function showFailure() {
    if (notice) return;
    notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.append('Previews could not load. ');
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'text-link'; retry.textContent = 'Reload to try again';
    retry.addEventListener('click', () => location.reload());
    notice.append(retry);
    document.querySelector('main').prepend(notice);
  }
  function capture(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = candidate(event.target);
    if (!trigger) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (failed) { showFailure(); return; }
    pending?.removeAttribute('aria-busy');
    pending = trigger; pending.setAttribute('aria-busy', 'true');
  }
  document.addEventListener('click', capture, true);
  function start() {
    import('./image-experience.js?v=20261102-coherent1').then(() => {
      document.removeEventListener('click', capture, true);
      const trigger = pending; pending = null;
      trigger?.removeAttribute('aria-busy');
      if (trigger?.isConnected) trigger.click();
    }).catch(() => {
      failed = true;
      pending?.removeAttribute('aria-busy');
      if (pending) showFailure();
      pending = null;
      // Retain capture on failure; preview links never become accidental downloads.
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
