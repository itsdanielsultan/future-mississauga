// Technical source coverage, never an administrative neighbourhood boundary.
// No geometry, loading policy or projection type is changed by these controls.
import {defaultViewDirection} from './viewer-camera.js?v=20261023-usability1';

const EPSILON = 1e-7;
const validBounds = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function convexHull(points) {
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=rows=>{const out=[];for(const p of rows){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half(sorted.reverse()).slice(0,-1)];
}

function clipX(polygon, edge, keepGreater) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const insideA = keepGreater ? a[0] >= edge : a[0] <= edge;
    const insideB = keepGreater ? b[0] >= edge : b[0] <= edge;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (edge - a[0]) / (b[0] - a[0]);
      result.push([edge, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

// Test every vertical slice where rectangle coverage changes. Checking only
// viewport corners would miss gaps or a concave notch between loaded crops.
export function footprintCovered(polygon, rectangles) {
  if (!polygon?.length || !rectangles.length) return false;
  const minX = Math.min(...polygon.map(p => p[0])), maxX = Math.max(...polygon.map(p => p[0]));
  const edges = [...new Set([minX, maxX, ...rectangles.flatMap(b => [b[0], b[2]]).filter(x => x > minX && x < maxX)])].sort((a,b) => a-b);
  for (let i = 1; i < edges.length; i++) {
    const left = edges[i - 1], right = edges[i];
    if (right - left < EPSILON) continue;
    const slice = clipX(clipX(polygon, left, true), right, false);
    if (!slice.length) continue;
    const middle = (left + right) / 2;
    const intervals = rectangles.filter(b => middle >= b[0] && middle <= b[2]).map(b => [b[1], b[3]]).sort((a,b) => a[0]-b[0]);
    const merged = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (previous && interval[0] <= previous[1] + EPSILON) previous[1] = Math.max(previous[1], interval[1]);
      else merged.push([...interval]);
    }
    const minZ = Math.min(...slice.map(p => p[1])), maxZ = Math.max(...slice.map(p => p[1]));
    if (!merged.some(([lo,hi]) => minZ >= lo - EPSILON && maxZ <= hi + EPSILON)) return false;
  }
  return true;
}

function viewBasis(THREE, position, target, aspect, fov, margin) {
  const direction = position.clone().sub(target);
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < EPSILON) direction.copy(defaultViewDirection(THREE));
  direction.normalize();
  // Only a ray above the horizon needs an angle correction. Normal OrbitControls
  // elevations, including the default 38 degrees, retain their exact direction.
  const minimum = THREE.MathUtils.degToRad(fov / 2 + 2);
  if (direction.y < Math.sin(minimum)) {
    const bearing = Math.atan2(direction.x, direction.z);
    direction.set(Math.sin(bearing)*Math.cos(minimum), Math.sin(minimum), Math.cos(bearing)*Math.cos(minimum));
  }
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), direction).normalize();
  if (!right.lengthSq()) right.set(1,0,0);
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * margin;
  const offsets = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => {
    const ray = direction.clone().negate().addScaledVector(right,x*tangent*aspect).addScaledVector(up,y*tangent);
    return [ray.x / -ray.y, ray.z / -ray.y];
  });
  return {direction, offsets};
}

export function groundFootprint(THREE, position, target, {aspect, fov = 35, ground = 0, margin = 1} = {}) {
  const {offsets} = viewBasis(THREE,position,target,aspect,fov,margin);
  const height = position.y-ground;
  return offsets.map(([x,z]) => [position.x+height*x,position.z+height*z]);
}

export function constrainCoverageFrame(THREE, frame, {rectangles, ground = 0, ceiling = ground, aspect, fov = 35, minDistance = 30, margin = 1.025, previous = null}) {
  const position = frame.position.clone(), target = frame.target.clone();
  if (!rectangles.length || !(aspect > 0)) return {position,target,constrained:false};
  const {direction,offsets} = viewBasis(THREE,position,target,aspect,fov,margin);
  const wantedDistance = Math.max(minDistance,position.distanceTo(target));
  const wanted = {target,position:target.clone().addScaledVector(direction,wantedDistance)};
  const span=Math.max(0,ceiling-ground);
  const aboveSlabDistance=y=>Math.max(minDistance,(ceiling-y+1e-5)/direction.y);
  // A lower source elevation alone can miss the near edge at a higher surface.
  // Cover the complete projected slab between both source elevation references.
  const footprint = p => convexHull([ground,ceiling].flatMap(y=>offsets.map(([x,z]) => [p.position.x+(p.position.y-y)*x,p.position.z+(p.position.y-y)*z])));
  const fits = p => p.position.y>ceiling && footprintCovered(footprint(p),rectangles);
  if (fits(wanted)) return {...wanted,constrained:wanted.position.distanceToSquared(position)>EPSILON};
  // Zoom, rotation and resize leave the requested target in place. Keep that
  // anchor instead of moving to a larger, distant crop to permit more distance.
  if(previous&&target.distanceToSquared(previous.target)<1e-8){
    const at=d=>({target:target.clone(),position:target.clone().addScaledVector(direction,d)});
    const nearest=aboveSlabDistance(target.y);
    if(fits(at(nearest))){
      let low=nearest,high=Math.max(nearest,wantedDistance);
      for(let n=0;n<22;n++){const mid=(low+high)/2;if(fits(at(mid)))low=mid;else high=mid;}
      return {...at(low),constrained:true};
    }
  }
  const xs=offsets.map(p=>p[0]),zs=offsets.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const lowX=minX>0?-span*minX:0,highX=maxX<0?-span*maxX:0,lowZ=minZ>0?-span*minZ:0,highZ=maxZ<0?-span*maxZ:0;
  const candidates=[];
  for (const b of rectangles) {
    const maxHeight=Math.min((b[2]-b[0]-highX+lowX)/(maxX-minX),(b[3]-b[1]-highZ+lowZ)/(maxZ-minZ))*(1-1e-8);
    if(maxHeight<=span)continue;
    const minimum=Math.min(minDistance,(maxHeight-span)*.5/direction.y);
    // The camera must clear the source slab; its orbit target may be a lower
    // building. Raising that target makes later zooms drift above the project.
    const targetHeight=Math.min(target.y-ground,maxHeight-minimum*direction.y);
    const nearest=Math.max(minimum,(span-targetHeight+1e-5)/direction.y);
    const farthest=(maxHeight-targetHeight)/direction.y;
    if(nearest>farthest+EPSILON)continue;
    const distance=clamp(wantedDistance,nearest,Math.max(nearest,farthest));
    const nextTarget=target.clone().setY(ground+targetHeight);
    const nextPosition=nextTarget.clone().addScaledVector(direction,distance),height=nextPosition.y-ground;
    const x=clamp(nextPosition.x,b[0]-height*minX-lowX,b[2]-height*maxX-highX);
    const z=clamp(nextPosition.z,b[1]-height*minZ-lowZ,b[3]-height*maxZ-highZ);
    nextTarget.x+=x-nextPosition.x;nextTarget.z+=z-nextPosition.z;nextPosition.x=x;nextPosition.z=z;
    candidates.push({position:nextPosition,target:nextTarget});
  }
  // Keep the requested target where a union of loaded crops supports it. The
  // prior valid target also makes small pans/rotations continuous at a seam.
  for (const anchor of [target,previous?.target].filter(Boolean)) {
    const origin=anchor.clone().setY(target.y);
    const at=d=>({target:origin.clone(),position:origin.clone().addScaledVector(direction,d)});
    const nearest=aboveSlabDistance(origin.y);
    if (!fits(at(nearest))) continue;
    let low=nearest,high=Math.max(nearest,wantedDistance);
    for(let n=0;n<18;n++){const mid=(low+high)/2;if(fits(at(mid)))low=mid;else high=mid;}
    candidates.push(at(low));
  }
  const score=p=>p.target.distanceToSquared(target)+p.position.distanceToSquared(position)+4*(p.position.distanceTo(p.target)-wantedDistance)**2;
  const safe=candidates.filter(fits);
  // Favour a local correction over travelling to another crop just because
  // that crop can accommodate the requested scale.
  const start=safe.sort((a,b)=>score(a)-score(b))[0];
  if(!start) throw new Error('No camera frame fits the available source coverage');
  // The hull of both endpoint footprints contains every intermediate footprint.
  // This exact swept check cannot skip a narrow unloaded gap between samples.
  const at=t=>({position:start.position.clone().lerp(wanted.position,t),target:start.target.clone().lerp(wanted.target,t)});
  const originFootprint=footprint(start);
  const pathFits=t=>footprintCovered(convexHull([...originFootprint,...footprint(at(t))]),rectangles);
  let low=0,high=1;
  for(let n=0;n<20;n++){const mid=(low+high)/2;if(pathFits(mid))low=mid;else high=mid;}
  return {...at(low),constrained:true};
}

export function createCoverageController({THREE,camera,controls}) {
  let rectangles=[],ground=0,ceiling=0,previous=null,revision=0,lastKey='';
  function options(){return {rectangles,ground,ceiling,aspect:camera.aspect,fov:camera.fov,minDistance:controls.minDistance,previous};}
  function setCoverage({district,rectangles:loaded=[],ground:loadedGround,ceiling:loadedCeiling}={}) {
    const sourceGround=district?.sourceCropCenter?.[1]??district?.center?.[1]??0;
    const minimumY=district?.geometryBounds?.[0]?.[1];
    const nextGround=Number.isFinite(loadedGround)?loadedGround:Number.isFinite(minimumY)?Math.min(sourceGround,minimumY):sourceGround;
    const nextCeiling=Math.max(nextGround,sourceGround,Number.isFinite(loadedCeiling)?loadedCeiling:sourceGround);
    const next=district?.id==='citywide'||!validBounds(district?.bounds)?[]:[district.bounds,...loaded.filter(validBounds)];
    const unique=[...new Map(next.map(b=>[b.join(','),[...b]])).values()];
    const connected=unique.length?[unique[0]]:[],pending=unique.slice(1);
    // A disconnected detailed island cannot authorize travel across its gap.
    for(let changed=true;changed;){changed=false;for(let i=pending.length-1;i>=0;i--){const b=pending[i];if(connected.some(a=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])){connected.push(b);pending.splice(i,1);changed=true;}}}
    if(nextGround!==ground||nextCeiling!==ceiling||JSON.stringify(connected)!==JSON.stringify(rectangles)){ground=nextGround;ceiling=nextCeiling;rectangles=connected;previous=null;revision++;lastKey='';}
  }
  function constrainFrame(frame){return constrainCoverageFrame(THREE,frame,options());}
  function constrain(){
    const key=[revision,camera.aspect,camera.fov,...camera.position.toArray(),...controls.target.toArray()].join(',');
    if(key===lastKey)return false;
    const result=constrainFrame({position:camera.position,target:controls.target});
    const changed=camera.position.distanceToSquared(result.position)>EPSILON||controls.target.distanceToSquared(result.target)>EPSILON;
    if(changed){camera.position.copy(result.position);controls.target.copy(result.target);camera.lookAt(controls.target);camera.updateMatrixWorld(true);}
    previous={position:result.position.clone(),target:result.target.clone()};
    lastKey=[revision,camera.aspect,camera.fov,...camera.position.toArray(),...controls.target.toArray()].join(',');
    return changed;
  }
  return {setCoverage,constrain,constrainFrame,clear(){setCoverage();},get coverage(){return rectangles.map(b=>[...b]);}};
}
