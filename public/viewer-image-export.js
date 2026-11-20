// Render once at an export size. The camera, CSS size and ordinary frame policy
// stay unchanged; the scene is copied before the WebGL buffer is restored.
export function captureViewerImage({renderer, render, createCanvas, Vector2, Vector4, longEdge = 2048}) {
  const size = renderer.getSize(new Vector2()), ratio = renderer.getPixelRatio();
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), canvas = renderer.domElement, gl = renderer.getContext();
  const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const requestedEdge = Math.max(longEdge, canvas.width, canvas.height);
  const limit = Math.min(requestedEdge, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), maxViewport[0], maxViewport[1]);
  const scale = limit / Math.max(size.x, size.y);
  const width = Math.max(1, Math.round(size.x * scale)), height = Math.max(1, Math.round(size.y * scale));
  let image, reduced = limit < requestedEdge;
  const copy = () => {
    if (gl.isContextLost()) throw new Error('Graphics context unavailable');
    // The canvas attributes can retain the requested size when the driver
    // silently allocates a smaller drawing buffer. Do not stretch that result.
    if (gl.drawingBufferWidth !== canvas.width || gl.drawingBufferHeight !== canvas.height) throw new Error('Image buffer size unavailable');
    const output = createCanvas(); output.width = canvas.width; output.height = canvas.height;
    const context = output.getContext('2d');
    if (!context || !output.width || !output.height) throw new Error('Image buffer unavailable');
    context.drawImage(canvas, 0, 0);
    return output;
  };
  const restore = () => {
    renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
  };
  try {
    renderer.setPixelRatio(1); renderer.setSize(width, height, false);
    render();
    if (canvas.width !== width || canvas.height !== height) throw new Error('Export size unavailable');
    image = copy();
  } catch (error) {
    if (gl.isContextLost()) throw error;
    // A device may reject a larger buffer. Keep a clearly labelled native
    // screen-resolution fallback, without interpolating the small image.
    restore(); render(); image = copy(); reduced = true;
  } finally {
    restore();
    try {
      if (!gl.isContextLost()) render();
    } finally {
      // A comparison redraw may change these states before failing.
      renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
    }
  }
  return {canvas: image, reduced};
}
