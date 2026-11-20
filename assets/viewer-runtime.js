// Feature-based limits apply to touch devices, including folded and split windows.
// These bound the drawing buffer, not the source geometry or exported originals.
export function drawingPolicy({width, height, pixelRatio = 1, coarse = false, memory = 8}) {
  const compact = coarse || memory <= 4;
  const pixelBudget = compact ? 1_500_000 : 4_000_000;
  const ratio = Math.min(Math.max(1, pixelRatio), compact ? 1.5 : 2,
    Math.sqrt(pixelBudget / Math.max(1, width * height)));
  return {pixelRatio: ratio, shadowSize: compact ? 2048 : 4096, compact};
}

// No perpetual animation loop: damping and camera flights request subsequent
// frames, while static, offscreen and background views let the GPU rest.
export function createFrameScheduler({draw, canDraw = () => true,
  request = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame}) {
  let handle = null, drawing = false, dirty = false, frames = 0;
  function schedule() {
    if (handle === null && !drawing && dirty && canDraw()) handle = request(tick);
  }
  function tick(time) {
    handle = null;
    if (!canDraw()) return;
    dirty = false;
    drawing = true;
    try { frames++; if (draw(time)) dirty = true; }
    finally { drawing = false; schedule(); }
  }
  return {
    invalidate() { dirty = true; schedule(); },
    pause() { if (handle !== null) cancel(handle); handle = null; },
    get frames() { return frames; },
  };
}
