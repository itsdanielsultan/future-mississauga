const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function visibleReferenceCreditHTML(view) {
  const credit = view.visibleReferenceCredit;
  if (!credit?.label || !credit.url) return '';
  let url;
  try { url = new URL(credit.url); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  if (url.href === 'https://davidlaskerphotography.com/') url = new URL('https://www.cityscapephotography.ca/');
  return `<p class="credit" data-visible-reference-credit>Photo reference: <a href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(credit.label)}</a></p>`;
}

export function configureStudyCredits(view, root = document) {
  const reference = visibleReferenceCreditHTML(view);
  root.querySelector('[data-visible-reference-credit]')?.remove();
  if (reference) root.querySelector('#studyCredit').insertAdjacentHTML('afterend', reference);
}
