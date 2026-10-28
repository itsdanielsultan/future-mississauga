// A single additive context patch. Scene callbacks only receive this loader's
// own result; the municipal base model is never hidden, replaced or removed.
export function createNeighbourhoodContext({
  asset, bounds, load, attach, remove, dispose: disposeResult, invalidate = () => {},
  enterDistance = 2200, exitDistance = 2800, enterPadding = 350, exitPadding = 600,
}) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)
      || bounds[0] > bounds[2] || bounds[1] > bounds[3]) {
    throw new TypeError('Context bounds must be [minX, minZ, maxX, maxZ]');
  }
  if (![load, attach, remove, disposeResult, invalidate].every(fn => typeof fn === 'function')) {
    throw new TypeError('Context scene adapters must be functions');
  }
  if (![enterDistance, exitDistance, enterPadding, exitPadding].every(Number.isFinite)
      || enterDistance <= 0 || exitDistance < enterDistance
      || enterPadding < 0 || exitPadding < enterPadding) {
    throw new TypeError('Context thresholds must preserve entry/exit hysteresis');
  }
  const [minX, minZ, maxX, maxZ] = bounds;
  let active = null, retained = null, eligible = false, destroyed = false, status = 'idle';
  const snapshot = () => Object.freeze({status, eligible, loaded: !!retained});
  // Removal/disposal are synchronous scene operations. Contain an accidental
  // asynchronous rejection too, so an optional layer cannot break the viewer.
  function quiet(fn, value) {
    try { Promise.resolve(fn(value)).catch(() => {}); } catch {}
  }
  const notify = () => quiet(invalidate);
  function release(record) {
    if (!record || record.released) return;
    record.released = true;
    if (record.attached) quiet(remove, record.value);
    quiet(disposeResult, record.value);
  }
  function stop(nextStatus) {
    const request = active, record = retained;
    active = null;
    retained = null;
    status = nextStatus;
    request?.controller.abort();
    release(record);
    notify();
  }
  const current = request => active === request && eligible && !destroyed && !request.controller.signal.aborted;
  function start() {
    const request = {controller: new AbortController(), task: null};
    active = request;
    status = 'loading';
    request.task = Promise.resolve().then(async () => {
      // A district switch can occur before this microtask starts the fetch.
      if (!current(request)) return snapshot();
      const value = await load(asset, request.controller.signal);
      if (value == null) throw new Error('Context adapter returned no model');
      const record = {value, attached: false, released: false};
      if (!current(request)) {
        release(record);
        return snapshot();
      }
      retained = record;
      // Mark before attach so a partially failed or re-entrant attachment is
      // removed safely. Each owned result is disposed at most once.
      record.attached = true;
      try {
        await attach(value);
      } catch (error) {
        if (retained === record) retained = null;
        release(record);
        throw error;
      }
      if (current(request) && retained === record) status = 'ready';
      else release(record);
      return snapshot();
    }).catch(() => {
      if (current(request)) status = 'error';
      return snapshot();
    }).finally(() => {
      if (active === request) active = null;
      notify();
    });
    notify();
    return request.task;
  }
  function qualifies({district, target, distance} = {}) {
    if ((typeof district === 'string' ? district : district?.id) !== 'citywide'
        || !Number.isFinite(target?.x) || !Number.isFinite(target?.z)
        || !Number.isFinite(distance) || distance < 0) return false;
    const padding = eligible ? exitPadding : enterPadding;
    const limit = eligible ? exitDistance : enterDistance;
    const dx = Math.max(minX - target.x, 0, target.x - maxX);
    const dz = Math.max(minZ - target.z, 0, target.z - maxZ);
    return distance <= limit && Math.hypot(dx, dz) <= padding;
  }
  return {
    // Safe to call on every camera change without awaiting the result.
    update(view) {
      if (destroyed) return Promise.resolve(snapshot());
      const next = qualifies(view);
      if (!next) {
        const changed = eligible || active || retained || status === 'error';
        eligible = false;
        if (changed) stop('idle');
        return Promise.resolve(snapshot());
      }
      eligible = true;
      if (active) return active.task;
      if (retained || status === 'error') return Promise.resolve(snapshot());
      return start();
    },
    // A failed patch does not retry on every frame. Explicit retry or leaving
    // and re-entering the eligible area starts a fresh request.
    retry() {
      if (destroyed || !eligible || retained) return Promise.resolve(snapshot());
      if (active) return active.task;
      return start();
    },
    clear() {
      if (!destroyed) { eligible = false; stop('idle'); }
      return snapshot();
    },
    dispose() {
      if (!destroyed) { destroyed = true; eligible = false; stop('disposed'); }
      return snapshot();
    },
    get state() { return snapshot(); },
  };
}

function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
}

// The parser may be non-cancellable. Always return its completed result to the
// manager, which disposes it if the request became stale during parsing.
export async function fetchNeighbourhoodModel(asset, signal, {
  parse, resolveURL = url => url, fetcher = globalThis.fetch,
} = {}) {
  if (typeof asset?.url !== 'string' || typeof parse !== 'function') {
    throw new TypeError('A context URL and parser are required');
  }
  checkAbort(signal);
  const response = await fetcher(resolveURL(asset.url, asset), {signal});
  checkAbort(signal);
  if (!response.ok) throw new Error('Context request failed');
  let bytes = new Uint8Array(await response.arrayBuffer());
  checkAbort(signal);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('Context decompression unavailable');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    checkAbort(signal);
  }
  const header = bytes.length >= 12 ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) : null;
  if (!header || header.getUint32(0, true) !== 0x46546c67
      || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('Context payload is not a complete GLB');
  }
  return parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
