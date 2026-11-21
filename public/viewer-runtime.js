// Feature-based limits apply to touch devices, including folded and split windows.
// These bound the drawing buffer, not the source geometry or exported originals.
export function drawingPolicy({width, height, pixelRatio = 1, coarse = false, memory = 8, moving = false}) {
  const compact = coarse || memory <= 4;
  const pixelBudget = compact ? 1_500_000 : 4_000_000;
  const movingLimit = compact ? .85 : 1;
  const ratio = Math.min(Math.max(1, pixelRatio), moving ? movingLimit : compact ? 1.5 : 2,
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

// Keep the poster up until the GPU has actually finished the district draw.
// Polling a WebGL fence yields to input and avoids blocking on a slow first frame.
export function afterFirstGPUFrame(gl, current, reveal, request = globalThis.requestAnimationFrame) {
  const fence = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (fence) gl.flush();
  function check() {
    if (!current()) {
      if (fence && !gl.isContextLost()) gl.deleteSync(fence);
      return;
    }
    if (fence && gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) {
      request(check);
      return;
    }
    if (fence) gl.deleteSync(fence);
    reveal();
  }
  request(check);
}
