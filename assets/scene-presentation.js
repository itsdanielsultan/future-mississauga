import {statusColours,LIFECYCLE_LABELS} from './model-status-materials.js?v=20261101-status2';
const legendItem=(key,material,color)=>Object.freeze({key,label:LIFECYCLE_LABELS[key],color:color||'#'+statusColours[material].toString(16).padStart(6,'0')});
export const STATUS_LEGEND=Object.freeze([
  legendItem('existing','Existing','#b8b9b6'),legendItem('under_construction','Under Construction'),
  legendItem('approved','Approved'),legendItem('proposed','Proposed'),legendItem('unknown','Uncertain')
]);
export function statusLegendFor(lifecycles=[],{appearance='status'}={}){
  if(appearance!=='status')return [];
  const shown=new Set(lifecycles.map(value=>value==='mixed'?'unknown':value));
  const items=[...STATUS_LEGEND,legendItem('on_hold','On Hold'),legendItem('cancelled','Cancelled')];
  return items.filter(item=>shown.has(item.key));
}

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

export function presentationLayout(width,legend=STATUS_LEGEND) {
  const compact = width < 1000, scale = width / (compact ? 650 : 1400);
  const rows=Math.ceil(legend.length/2),height=!rows?104:compact?118+(rows-1)*26+24:Math.max(116,43+(rows-1)*30+24);
  return {compact,scale,height:Math.ceil(height*scale)};
}

function drawNorth(ctx, x, y, size, bearing) {
  if (!bearing) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.rotate(bearing.degrees * Math.PI / 180);
  ctx.fillStyle = '#2e2b2a';
  ctx.beginPath(); ctx.moveTo(0, -size * .33); ctx.lineTo(size * .11, size * .02); ctx.lineTo(0, -size * .04); ctx.lineTo(-size * .11, size * .02); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9c3bf';
  ctx.beginPath(); ctx.moveTo(0, size * .33); ctx.lineTo(-size * .11, -size * .02); ctx.lineTo(0, size * .04); ctx.lineTo(size * .11, -size * .02); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.font = '700 ' + size * .18 + 'px Lato, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2e2b2a'; ctx.fillText('N', bearing.x * size * .47, bearing.y * size * .47);
  ctx.restore();
}

export function drawPresentationFooter(ctx, {width, top, title, scenario, bearing, legend=STATUS_LEGEND}) {
  const {compact, scale: s, height} = presentationLayout(width,legend);
  ctx.save(); ctx.translate(0, top); ctx.scale(s, s);
  const w = width / s;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, height / s);
  ctx.strokeStyle = '#e4e6e6'; ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(w - 28, 0); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#2e2b2a';
  ctx.font = '500 23px "Bricolage Grotesque", sans-serif'; ctx.fillText(title.replace(/^Future Mississauga\s*[·:]\s*/, ''), 28, 36, compact ? 500 : 620);
  ctx.font = '15px Lato, sans-serif'; ctx.fillText('by Daniel Sultan', 28, 60, compact ? 500 : 580);
  ctx.fillStyle = '#63696b'; ctx.font = '13px Lato, sans-serif'; ctx.fillText(scenario, 28, 82, compact ? 500 : 580);
  drawNorth(ctx, w - 56, compact ? 48 : 54, 62, bearing);
  legend.forEach((item, i) => {
    const x = compact ? 28 + (i % 2) * 308 : 750 + (i % 2) * 230;
    const y = compact ? 118 + Math.floor(i / 2) * 26 : 43 + Math.floor(i / 2) * 30;
    ctx.fillStyle = item.color; ctx.fillRect(x, y - 11, 16, 12);
    ctx.fillStyle = '#2e2b2a'; ctx.font = '14px Lato, sans-serif'; ctx.fillText(item.label, x + 26, y);
  });
  ctx.restore();
  return height;
}
