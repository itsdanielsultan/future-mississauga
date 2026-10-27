import {assetOrigin, deliveryPaths} from './asset-delivery-map.js?v=20261027-assets3';

// Resolve only at the network boundary. Source identities and credits keep the
// original local paths. This function is never called in the rendering loop.
export function createAssetResolver({origin, paths, baseURI = () => globalThis.document?.baseURI || 'https://futuremississauga.com/'}) {
  const destination = new URL(origin);
  if (destination.protocol !== 'https:' || destination.pathname !== '/' || destination.search || destination.hash || destination.username || destination.password) throw Error('Invalid asset origin');
  return value => {
    if (typeof value !== 'string') return value;
    let url, base;
    try { base = new URL(typeof baseURI === 'function' ? baseURI() : baseURI); url = new URL(value, base); } catch { return value; }
    if (!['http:', 'https:'].includes(url.protocol)) return value;
    // External source pins, data/blob textures and unlisted files stay untouched.
    if (url.origin !== base.origin && !['https://futuremississauga.com', 'https://futuremississauga.ca'].includes(url.origin)) return value;
    if ([...url.searchParams.keys()].some(key => key !== 'edition')) return value;
    const key = url.pathname.slice(1);
    if (!Object.hasOwn(paths, key)) return value;
    const target = paths[key];
    // The full content hash supplies cache identity; the old edition is redundant.
    return destination.origin + '/' + target + url.hash;
  };
}

export const assetURL = createAssetResolver({origin: assetOrigin, paths: deliveryPaths});
