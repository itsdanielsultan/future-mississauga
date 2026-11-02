import assert from 'node:assert/strict';
// A single independently reviewed geographic addition. Keep every unrelated
// version and all frozen historical fingerprints in the model-scope tests.
export const OHN_VERSION = Object.freeze({
  url: 'models/context-supplements/lakeview-ohn-offshore-0f27774f67dc.glb',
  sha256: '0f27774f67dc09a29e0713d401b40dcabc6e14011874a0bb8daf7c654bcd814d'
});
export function restorePreOHNVersions(input) {
  const data = structuredClone(input);
  assert.equal(data.sha256[OHN_VERSION.url], OHN_VERSION.sha256, 'exact reviewed OHN version');
  delete data.sha256[OHN_VERSION.url];
  return data;
}
