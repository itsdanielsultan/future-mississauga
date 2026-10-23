export const STATUS_LEGEND = Object.freeze([
  {key: 'existing', label: 'Existing', color: '#b8b9b6'},
  {key: 'construction', label: 'Under construction', color: '#85b4bf'},
  {key: 'proposed', label: 'Proposed / approved', color: '#d8b7ac'},
  {key: 'uncertain', label: 'Uncertain source versions', color: '#b89bc3'}
]);

// NDC coordinates need pixel aspect scaling before they become a compass bearing.
export function northBearingFromNDC(anchor, north, width, height) {
  const dx = (north.x - anchor.x) * width / 2;
  const dy = -(north.y - anchor.y) * height / 2;
  const length = Math.hypot(dx, dy);
  if (![dx, dy, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || length < 1e-8) return null;
  return {x: dx / length, y: dy / length, degrees: Math.atan2(dx, -dy) * 180 / Math.PI};
}

export function projectNorth(THREE, camera, target, width, height) {
  const anchor = target.clone().project(camera);
  const north = target.clone().add(new THREE.Vector3(0, 0, -100)).project(camera);
  return northBearingFromNDC(anchor, north, width, height);
}

export function presentationLayout(width) {
  const compact = width < 1000, scale = width / (compact ? 650 : 1400);
  return {compact, scale, height: Math.ceil((compact ? 154 : 124) * scale)};
}

function drawNorth(ctx, x, y, size, bearing) {
  if (!bearing) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = .75;
  ctx.beginPath(); ctx.arc(0, 0, size * .52, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(bearing.degrees * Math.PI / 180);
  ctx.fillStyle = '#203438';
  ctx.beginPath(); ctx.moveTo(0, -size * .39); ctx.lineTo(size * .23, size * .2); ctx.lineTo(0, size * .09); ctx.lineTo(-size * .23, size * .2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f6f5ef';
  ctx.beginPath(); ctx.moveTo(0, -size * .31); ctx.lineTo(size * .16, size * .15); ctx.lineTo(0, size * .06); ctx.closePath(); ctx.fill();
  ctx.font = '600 ' + size * .21 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#203438'; ctx.fillText('N', 0, size * .4);
  ctx.restore();
}

export function drawPresentationFooter(ctx, {width, top, title, scenario, bearing}) {
  const {compact, scale: s, height} = presentationLayout(width);
  ctx.save(); ctx.translate(0, top); ctx.scale(s, s);
  const w = width / s;
  ctx.fillStyle = '#f6f5ef'; ctx.fillRect(0, 0, w, height / s);
  ctx.strokeStyle = '#daddd5'; ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(w - 24, 0); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#203438';
  ctx.font = '700 23px sans-serif'; ctx.fillText('Daniel Sultan', 26, 39);
  ctx.font = '15px sans-serif'; ctx.fillText(title, 26, 65, compact ? 500 : 610);
  ctx.fillStyle = '#607276'; ctx.font = '13px sans-serif'; ctx.fillText(scenario + ' · Source dates vary', 26, 88, compact ? 500 : 610);
  drawNorth(ctx, compact ? w - 58 : w - 455, compact ? 49 : 61, 66, bearing);
  STATUS_LEGEND.forEach((item, i) => {
    const x = compact ? 26 + (i % 2) * 310 : w - 382;
    const y = compact ? 116 + Math.floor(i / 2) * 24 : 29 + i * 24;
    ctx.fillStyle = item.color; ctx.fillRect(x, y - 12, 25, 14);
    ctx.fillStyle = '#203438'; ctx.font = '15px sans-serif'; ctx.fillText(item.label, x + 35, y);
  });
  ctx.restore();
  return height;
}
