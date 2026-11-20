// A thumbnail belongs to an exact displayed assembly. A later model revision
// must receive its own image; an old picture must not silently become current.
export function buildingThumbnail(view, manifest, registry) {
  const binding = registry.current.find(row => row.id === view.id);
  if (!binding || binding.assets.length !== view.assets.length) return null;
  for (const [index, id] of view.assets.entries()) {
    const asset = manifest.assets.find(row => row.id === id);
    if (!asset || binding.assets[index].id !== id || binding.assets[index].sha256 !== asset.sha256) return null;
  }
  return {...binding.image};
}
