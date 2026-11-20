import {legacyLifecycle} from './model-status-materials.js?v=20261101-status2';

// Display colours follow the recorded lifecycle. Geometry confidence remains
// separate, and neither this palette nor the view selector changes source data.
export const PLANNING_NEUTRAL_COLOUR=0xd3d8db;
export const PLANNING_APPEARANCE=Object.freeze([
  Object.freeze({key:'existing',label:'Existing',color:'#b8b9b6'}),
  Object.freeze({key:'under_construction',label:'Under construction',color:'#85b4bf'}),
  Object.freeze({key:'approved',label:'Approved planning',color:'#c49b52'}),
  Object.freeze({key:'proposed',label:'Proposed',color:'#d8b7ac'}),
  Object.freeze({key:'unknown',label:'Status unverified',color:'#b89bc3'}),
  Object.freeze({key:'on_hold',label:'On hold',color:'#aaa09a'}),
  Object.freeze({key:'cancelled',label:'Cancelled',color:'#908783'})
]);
export function planningGroupForLifecycle(lifecycle){
  if(lifecycle==='mixed')return 'unknown';
  if(PLANNING_APPEARANCE.some(item=>item.key===lifecycle))return lifecycle;
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
