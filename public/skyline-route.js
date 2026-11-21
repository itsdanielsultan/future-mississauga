const stages = ['existing', 'construction', 'future'];

function parameters(url) {
  if (!url.hash.startsWith('#?')) return url.searchParams;
  const [query] = url.hash.slice(2).split('#');
  return new URLSearchParams(query);
}

export function requestedStage(url) {
  const params = parameters(url);
  const stage = params.get('scenario') || params.get('stage');
  return stages.includes(stage) ? stage : null;
}

export function legacyStageHome(url) {
  const params = parameters(url);
  if (params.get('mode') !== 'stages' && !params.has('scenario') && url.hash !== '#skyline') return null;
  const home = new URL('index.html', url);
  home.searchParams.set('scenario', requestedStage(url) || 'future');
  for (const key of ['area','split']) if (params.has(key)) home.searchParams.set(key, params.get(key));
  home.hash = 'skyline';
  return home;
}
