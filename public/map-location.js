// The URL is the map's shareable location. Keep the scenario when opening a building.
export function nextMapLocation(current, {district, project, context, scenario, building}) {
  const url = new URL(current);
  if (district) {
    url.searchParams.set('district', district);
    url.searchParams.delete('project');
    url.searchParams.delete('context');
    url.searchParams.delete('building');
  }
  for (const [key, value] of Object.entries({project, context, scenario, building})) {
    if (value === undefined) continue;
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (!url.searchParams.get('project')) url.searchParams.delete('building');
  const previous = new URL(current).searchParams;
  if (['district','project','context','building'].some(key=>previous.get(key)!==url.searchParams.get(key))) url.searchParams.delete('view');
  if (scenario && scenario !== 'comparison') url.searchParams.delete('split');
  return url;
}

let lastMapQuery;
export function restoreMapOnHistory(window) {
  lastMapQuery = window.location.search;
  window.addEventListener('popstate', () => {
    if (window.location.search !== lastMapQuery) window.location.reload();
  });
}

export function navigateMap(view) {
  const url = nextMapLocation(location.href, view);
  const previous = new URL(location.href);
  previous.searchParams.sort();
  url.searchParams.sort();
  if (url.href !== previous.href) {
    history.pushState(history.state, '', url);
    lastMapQuery = url.search;
  }
}

export function sharedMapURL(address, {district, project, building, context, scenario, split, target, position}) {
  const page = new URL(address);
  const url = page.protocol === 'file:' ? new URL('https://futuremississauga.com/explore.html') : new URL(page.pathname, page);
  url.searchParams.set('district',district);
  if (project) url.searchParams.set('project',project);
  if (project && building) url.searchParams.set('building',building);
  if (context) url.searchParams.set('context',context);
  url.searchParams.set('scenario',scenario);
  if (scenario === 'comparison') url.searchParams.set('split',String(Math.round(split*100)));
  url.searchParams.set('view',[...target,...position].map(value=>Number(value.toFixed(2))).join(','));
  return url;
}

export function readMapFrame(value) {
  if (!value || !/^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?){5}$/.test(value)) return null;
  const points = value.split(',').map(Number);
  if (points.some(n=>!Number.isFinite(n) || Math.abs(n)>160000)) return null;
  const target=points.slice(0,3), position=points.slice(3);
  if (position[1]<=target[1] || Math.hypot(...position.map((n,i)=>n-target[i]))<1) return null;
  return {target,position};
}
