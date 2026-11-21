// The original buttons still handle taps, keyboard input and the actual model change.
export function bindPlateSwitchDrag(group, {measure, draw, move, current}) {
  let gesture = null;
  let suppressClick = false;
  const buttons = () => Array.from(group.querySelectorAll(':scope > button'));
  const centre = box => box.x + box.width / 2;
  function frameAt(frames, x) {
    const right = frames.findIndex(box => centre(box) >= x);
    if (right < 0) return frames.at(-1);
    if (!right) return frames[0];
    const left = frames[right - 1], next = frames[right];
    const mix = (x - centre(left)) / (centre(next) - centre(left));
    return {x:left.x + (next.x-left.x)*mix, y:left.y,
      width:left.width + (next.width-left.width)*mix, height:left.height};
  }
  function finish(event, commit) {
    if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    const state = gesture;
    gesture = null;
    if (!state.dragging) return;
    group.removeAttribute('data-switch-dragging');
    if (group.hasPointerCapture(state.id)) group.releasePointerCapture(state.id);
    const inside = event.clientX >= state.rect.left && event.clientX <= state.rect.right
      && event.clientY >= state.rect.top && event.clientY <= state.rect.bottom;
    suppressClick = true;
    if (commit && inside) {
      const target = state.choices.reduce((best, button, i) =>
        Math.abs(centre(state.frames[i]) - state.position) < Math.abs(centre(state.frames[best]) - state.position) ? i : best, 0);
      const button = state.choices[target];
      if (button !== current()) button.click();
      button.focus({preventScroll:true});
    }
    draw(true);
  }
  group.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    suppressClick = false;
    const pressed = event.target.closest('button');
    if (!pressed) return;
    gesture = {id:event.pointerId, pressed, x:event.clientX, y:event.clientY, dragging:false};
  });
  group.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dy) >= Math.abs(dx)) { gesture = null; return; }
      gesture.choices = buttons();
      gesture.frames = gesture.choices.map(measure);
      if (gesture.frames.length < 2) { gesture = null; return; }
      gesture.rect = group.getBoundingClientRect();
      const selected = gesture.choices.indexOf(gesture.pressed);
      if (selected < 0) { gesture = null; return; }
      gesture.origin = centre(gesture.frames[selected]);
      gesture.dragging = true;
      group.setAttribute('data-switch-dragging', '');
      group.setPointerCapture(gesture.id);
    }
    gesture.position = gesture.origin + dx;
    move(frameAt(gesture.frames, gesture.position));
  });
  group.addEventListener('pointerup', event => finish(event, true));
  group.addEventListener('pointercancel', event => finish(event, false));
  group.addEventListener('lostpointercapture', event => finish(event, false));
  group.addEventListener('pointerleave', () => { if (gesture && !gesture.dragging) gesture = null; });
  group.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture?.dragging) {
      event.preventDefault();
      finish(event, false);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const choices = buttons(), focused = choices.indexOf(event.target);
    if (focused < 0) return;
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length-1 :
      (focused + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
    event.preventDefault();
    choices[target].focus({preventScroll:true});
    if (choices[target] !== current()) choices[target].click();
  });
  group.addEventListener('click', event => {
    if (!event.detail) return;
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    suppressClick = false;
  }, true);
}
