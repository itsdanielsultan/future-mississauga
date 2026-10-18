// Context contact studies use the same scenario/fallback decision as buildings.
// Reparent only explicitly tagged meshes, once after loading, retaining world placement.
export function adoptContextModelVisibility(model, context, prepare) {
  model.updateMatrixWorld(true);
  context.updateMatrixWorld(true);
  const nodes = [];
  context.traverse(node => {
    if (node.isMesh && node.userData.contextModelVisibility === true) nodes.push(node);
  });
  for (const node of nodes) {
    prepare?.(node);
    model.attach(node);
  }
  return nodes.length;
}
