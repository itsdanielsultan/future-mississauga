const schema = 'future-mississauga-model-revisions/v1';
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

export async function loadModelRevisions(fetcher = globalThis.fetch, {timeoutMs = 2500} = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher('data/model-revisions.json?v=20261028-1', {signal:controller.signal});
        if (!response.ok) return null;
        const registry = await response.json();
        return registry.schema === schema && Array.isArray(registry.revisions) ? registry : null;
      })(),
      new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, Math.min(5000, Math.max(1, Number(timeoutMs) || 2500))); })
    ]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/** A date belongs to exact model bytes, not to the catalogue's review or publication date. */
export function modelRevisionForProject(registry, catalogue, projectId, viewId) {
  if (registry?.schema !== schema || !Array.isArray(catalogue?.assets)) return null;
  const record = registry.revisions?.find(item => item.projectId === projectId && (!viewId || item.viewIds?.includes(viewId)));
  if (!record || !date(record.updatedOn) || !record.modelAssets?.length) return null;
  if (viewId) {
    const view = catalogue.views?.find(item => item.id === viewId);
    if (!view || view.assets.length !== record.modelAssets.length || view.assets.some(id => !record.modelAssets.some(asset => asset.id === id))) return null;
  }
  const matches = record.modelAssets.every(expected => {
    const asset = catalogue.assets.find(item => item.id === expected.id);
    return asset && sha256(expected.sha256) && sha256(expected.downloadSHA256) &&
      asset.sha256 === expected.sha256 && asset.downloadSHA256 === expected.downloadSHA256 &&
      asset.url === expected.url && asset.decodedBytes === expected.decodedBytes && asset.bytes === expected.bytes &&
      asset.modelReviewDate === record.updatedOn;
  });
  if (!matches) return null;
  return {id:record.id, projectId:record.projectId, updatedOn:record.updatedOn, label:`Updated on ${new Date(`${record.updatedOn}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}`};
}

/** Media only inherits a model association when both its file and represented model match. */
export function mediaModelRevision(registry, {url, sha256:mediaHash, modelSHA256} = {}) {
  if (registry?.schema !== schema || !sha256(mediaHash) || !sha256(modelSHA256)) return null;
  for (const record of registry.revisions || []) {
    const media = record.media?.find(item => item.url === url && item.sha256 === mediaHash && item.modelSHA256s?.includes(modelSHA256));
    if (media) return {revisionId:record.id, role:media.role, modelSHA256s:[...media.modelSHA256s]};
  }
  return null;
}
