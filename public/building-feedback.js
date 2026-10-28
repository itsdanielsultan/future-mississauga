const origin = 'https://futuremississauga.com';
const routes = new Set(['/','/index.html','/explore.html','/model.html','/reference-updates.html','/review-renders.html','/accuracy-review.html']);
const scenarios = {existing:'Existing city',construction:'Dated construction',future:'Future scenario',comparison:'Existing city / future scenario'};
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value) ? value : '';
const singleLine = value => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Reproduce a public view without forwarding credentials, fragments or unrelated query data. */
export function feedbackViewURL({viewURL, project, district, scenario} = {}) {
  let input;
  try {
    const parsed = new URL(viewURL || '/explore.html', origin);
    const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
    const publicSite = ['futuremississauga.com','www.futuremississauga.com'].includes(parsed.hostname);
    if ((publicSite && parsed.protocol === 'https:' || local && /^https?:$/.test(parsed.protocol)) && routes.has(parsed.pathname)) input = parsed;
  } catch { /* An unavailable view still permits a building-specific email. */ }
  const result = new URL(input?.pathname || '/explore.html', origin);
  for (const key of ['district','project','model']) {
    const value = identifier(input?.searchParams.get(key));
    if (value) result.searchParams.set(key, value);
  }
  for (const [key, value] of Object.entries({project,district})) {
    if (identifier(value)) result.searchParams.set(key, value);
  }
  const currentScenario = scenario ?? input?.searchParams.get('scenario');
  if (Object.hasOwn(scenarios, currentScenario)) result.searchParams.set('scenario', currentScenario);
  return result.href;
}

/** A draft in the visitor's mail app; this module never sends or stores a report. */
export function buildingFeedbackURL(options = {}) {
  const name = singleLine(options.name) || 'Building model';
  const viewURL = feedbackViewURL(options);
  const scenario = new URL(viewURL).searchParams.get('scenario');
  const body = [`Building: ${name}`, `View: ${viewURL}`, ...(scenario ? [`Scenario: ${scenarios[scenario]}`] : []), '', 'What looks wrong?', ''].join('\n');
  return `mailto:daniel@futuremississauga.com?subject=${encodeURIComponent(`Model correction: ${name}`)}&body=${encodeURIComponent(body)}`;
}

export function buildingFeedbackHTML(project, view = {}) {
  return `<a href="${escapeHTML(buildingFeedbackURL({...view, name:project.name, project:project.id}))}" data-building-feedback data-building-name="${escapeHTML(project.name || 'Building model')}" data-building-project="${escapeHTML(project.id || '')}">Something looks wrong?</a>`;
}

/** Delegation covers newly inserted cards and refreshes scenario state just before activation. */
export function bindBuildingFeedback(root, getView = () => ({viewURL:globalThis.location?.href})) {
  const activate = event => {
    const link = event.target?.closest?.('a[data-building-feedback]');
    if (!link || !root.contains(link)) return;
    link.href = buildingFeedbackURL({...getView(), name:link.dataset.buildingName, project:link.dataset.buildingProject});
  };
  root.addEventListener('click', activate, true);
  root.addEventListener('auxclick', activate, true);
  return () => { root.removeEventListener('click', activate, true); root.removeEventListener('auxclick', activate, true); };
}
