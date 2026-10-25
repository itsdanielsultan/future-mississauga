export function selectPreview(manifest, id) {
  return manifest.views.find(view => view.id === id) || null;
}

export async function verifiedModelBytes(asset, fetcher = globalThis.fetch) {
  const response = await fetcher(asset.url);
  if (!response.ok) throw new Error('The model could not be downloaded. Please try again.');
  let bytes = new Uint8Array(await response.arrayBuffer());
  const sha = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), b => b.toString(16).padStart(2, '0')).join('');
  const isGLB = value => value.length >= 12 && new DataView(value.buffer, value.byteOffset).getUint32(0, true) === 0x46546c67;
  // Some hosts transparently decode gzip; either representation must match its pin.
  if (!isGLB(bytes)) {
    if (bytes.length !== asset.bytes || await sha(bytes) !== asset.downloadSHA256) throw new Error('The model failed its integrity check. Please try again.');
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack the model. Use the compressed download below or a newer browser.');
    bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  if (!isGLB(bytes) || bytes.length !== asset.decodedBytes || await sha(bytes) !== asset.sha256) throw new Error('The model failed its integrity check. Please try again.');
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.length) throw new Error('The model file is incomplete. Please try again.');
  return bytes;
}
