const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Presentation policy only. An interactive model's geometry is still publicly served. */
export function modelDownloadAssets(view, assets) {
  return view.offerDownloads === false ? [] : assets;
}

export function visibleReferenceCreditHTML(view) {
  const credit = view.visibleReferenceCredit;
  if (!credit?.label || !credit.url) return '';
  let url;
  try { url = new URL(credit.url); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  return `<p class="credit" data-visible-reference-credit>Photo reference: <a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(credit.label)}</a></p>`;
}

export function configureStudyActions(view, root = document) {
  const hide = view.offerDownloads === false;
  for (const selector of ['#modelDownloads','#compressedDownloads','#downloadNote','.sidebar > p.credit:not([id]):not([data-visible-reference-credit])','.sidebar > p:has(a[download])']) {
    for (const element of root.querySelectorAll(selector)) element.hidden = hide;
  }
  const reference = visibleReferenceCreditHTML(view);
  root.querySelector('[data-visible-reference-credit]')?.remove();
  if (reference) root.querySelector('#studyCredit').insertAdjacentHTML('afterend', reference);
}

export function studyViewerMessage(view, message) {
  if (view.offerDownloads !== false) return message;
  return message
    .replace('Use the compressed download below or a newer browser.', 'Try a newer browser.')
    .replace('The model download address is unavailable.', 'The model address is unavailable.')
    .replace('The model could not be downloaded.', 'The model could not be loaded.')
    .replace('3D graphics are unavailable. You can still download the model and credits.', '3D graphics are unavailable. Try another browser to view this study.')
    .replace('Graphics could not be restored. Reload the viewer or use the model download.', 'Graphics could not be restored. Reload the viewer to try again.');
}
