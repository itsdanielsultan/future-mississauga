export const STATUS_CLASSIFICATION_EDITION='2026-11-01';
// Lifecycle, planning approval and geometry confidence are separate facts.
// Geometry confidence never selects a development-status colour.
export const LIFECYCLE_LABELS=Object.freeze({
  existing:'Existing',under_construction:'Under construction',approved:'Approved planning',
  proposed:'Proposed',on_hold:'On hold',cancelled:'Cancelled',unknown:'Status unverified',mixed:'Mixed phases'
});
const displayStatuses=Object.freeze({
  existing:'Existing',under_construction:'Under Construction',approved:'Approved',proposed:'Proposed',
  on_hold:'On Hold',cancelled:'Cancelled',unknown:'Uncertain',mixed:'Uncertain'
});
export const statusColours=Object.freeze({
  Existing:0xffffff,'Under Construction':0x85b4bf,Approved:0xc49b52,Proposed:0xd8b7ac,
  'On Hold':0xaaa09a,Cancelled:0x908783,Uncertain:0xb89bc3
});
const valid=value=>Object.hasOwn(LIFECYCLE_LABELS,value);
const concrete=value=>valid(value)&&value!=='mixed';

export function legacyLifecycle(value){
  const status=String(value||'').trim().toLowerCase().replace(/[_–—-]+/g,' ').replace(/\s+/g,' ');
  const exact={existing:'existing',completed:'existing','under construction':'under_construction',approved:'approved',proposed:'proposed',uncertain:'unknown','status unverified':'unknown',unknown:'unknown','on hold':'on_hold',cancelled:'cancelled','mixed phases':'mixed'};
  if(exact[status])return exact[status];
  if(/(?:on hold|paused)/.test(status))return 'on_hold';
  if(/^(?:cancelled|canceled)\b/.test(status))return 'cancelled';
  if(/(?:mixed|partially built|partly completed|partially completed)/.test(status))return 'mixed';
  if(/(?:complet|occupied|existing|built)/.test(status)&&!/(?:part|unbuilt|incomplet|unverified|unconfirmed|unknown|not complete)/.test(status))return 'existing';
  if(/(?:under.?construction|topped|partially.occupied)/.test(status)&&!/(?:not under|no construction|construction unverified|construction not verified)/.test(status))return 'under_construction';
  if(/^(?:proposed|proposal|planning|preconstruction)\b/.test(status))return 'proposed';
  return 'unknown';
}

export function resolveModelLifecycle(data={},override={},project={}){
  // Component/phase evidence wins over the wider project's lifecycle. A mixed
  // community never paints all its buildings as one development stage.
  for(const value of [override.componentPhase?.lifecycle,data.componentPhase?.lifecycle,override.lifecycle,data.lifecycle])if(concrete(value))return value;
  if(concrete(project.lifecycle))return project.lifecycle;
  const explicit=override.displayStatus||override.latestStatus||override.status||data.Status||data.displayStatus;
  const lifecycle=legacyLifecycle(explicit);
  return lifecycle==='mixed'?'unknown':lifecycle;
}
export const displayStatusForLifecycle=lifecycle=>displayStatuses[lifecycle]||displayStatuses.unknown;
export function statusMaterialKey(displayStatus){
  if(Object.hasOwn(statusColours,displayStatus))return displayStatus;
  return displayStatusForLifecycle(legacyLifecycle(displayStatus));
}
export const inactiveLifecycle=lifecycle=>lifecycle==='on_hold'||lifecycle==='cancelled';
