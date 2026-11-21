// Older image collections have their own provenance manifests. A current
// gallery only needs them if its edition is unavailable or an archived image opens.
let archive;
function loadArchive() {
  if (!archive) archive = import('./media-catalog.js?v=20261113-design2');
  return archive;
}
export async function refreshPictureAssets(pictures) {
  return (await loadArchive()).refreshPictureAssets(pictures);
}
export async function resolveMedia(url) {
  return (await loadArchive()).resolveMedia(url);
}
export async function installResponsiveImages(options) {
  return (await loadArchive()).installResponsiveImages(options);
}
