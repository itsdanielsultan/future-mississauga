import {legacyLifecycle} from './model-status-materials.js?v=20261101-status2';

// This is a display grouping only. Precise lifecycle and confidence remain in
// the project records and continue to govern scene visibility independently.
export const PLANNING_NEUTRAL_COLOUR=0xd3d8db;
export const PLANNING_APPEARANCE=Object.freeze([
  Object.freeze({key:'existing',label:'Existing',color:'#d3d8db'}),
  Object.freeze({key:'under_construction',label:'Under construction',color:'#85b4bf'}),
  Object.freeze({key:'planned',label:'Planned',color:'#d8b7ac'})
]);
export function planningGroupForLifecycle(lifecycle){
  if(lifecycle==='existing'||lifecycle==='under_construction')return lifecycle;
  if(lifecycle==='approved'||lifecycle==='proposed')return 'planned';
  // Unknown, mixed and inactive records are never presented as active plans.
  return null;
}
export function planningAppearanceKey(data={}){
  return planningGroupForLifecycle(data.lifecycle||legacyLifecycle(data.displayStatus||data.Status));
}
export function planningAppearanceColour(key){
  const item=PLANNING_APPEARANCE.find(item=>item.key===key);
  return item?Number.parseInt(item.color.slice(1),16):PLANNING_NEUTRAL_COLOUR;
}
export function planningStatusLegendFor(lifecycles=[],{appearance='status'}={}){
  if(appearance!=='status')return [];
  const shown=new Set(lifecycles.map(planningGroupForLifecycle));
  return PLANNING_APPEARANCE.filter(item=>shown.has(item.key));
}
