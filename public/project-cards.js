/** Project card presentation only. Does not change project facts or model status. */
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>typeof value==='string'?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):'';
const unique=values=>[...new Set(values.map(text).filter(Boolean))];
const isKnown=value=>(typeof value!=='number'||value>0)&&Boolean(text(value))&&!/^(?:unknown|unconfirmed|not (?:known|confirmed|independently confirmed|available|verified)|no (?:verified|confirmed|known|date)|n\/?a|null|none|tbd|to be (?:confirmed|determined))\b/i.test(text(value));
const validURL=value=>{try{const u=new URL(text(value));return /^(https?:)$/.test(u.protocol)?u.href:null;}catch{return null;}};

const overrides={
  'merner-41-bay':{
    summary:'A gabled home with an addition and a wraparound porch.',
    omitStatusDetail:true,
    qualifier:'Approximate exterior',
    notes:[
      'The exterior follows four 2017 elevation drawings and a photo of the finished home.',
      'Colours and visible details are approximate. Hidden parts of the building have not been checked.'
    ],
    sourceNote:'Drawings and photos remain with their owners. The original files are kept private.',
    sources:p=>{
      const items=p.sources||[];
      return [
        {title:'Merner Row Design / Lisa Apps',note:'Elevation drawings and exterior photograph.'},
        ...items.filter(s=>validURL(s?.url)).map(s=>({
          ...s,
          title:/Building_Footprints/i.test(s.url)?'City of Mississauga: building footprints':/\/Address\//i.test(s.url)?'City of Mississauga: address map':/Ontario_DTM/i.test(s.url)?'Ontario: terrain':s.title||s.publisher
        }))
      ];
    }
  }
};

/** The full underlying status remains in the disclosure if the short label differs. */
export function projectStatus(project){
  const raw=text(project.status),status=raw.toLowerCase().replace(/[_–—-]+/g,' ').replace(/\s+/g,' ');
  // Mixed communities and partial structures must never become “Existing”.
  if(/(?:partially built|partly completed|mixed completed|partially completed)/.test(status))return {label:'Partly built',tone:'construction'};
  if(/(?:on hold|paused)/.test(status))return {label:'On hold',tone:'uncertain'};
  if(/(?:demolition|early works)/.test(status))return {label:/demolition/.test(status)?'Demolition / early works':'Early works',tone:'proposed'};
  if(/(?:historical|earlier|old current status)/.test(status)&&/(?:unverified|unconfirmed|uncertain|retained|historical)/.test(status))return {label:'Earlier design',tone:'uncertain'};
  if(/^(?:uncertain|superseded|disputed)/.test(status))return {label:'Uncertain',tone:'uncertain'};
  if(/under construction|construction underway|construction in progress|topped out/.test(status)&&!/construction (?:not verified|unverified|unconfirmed)|(?:not |no |before |awaiting )construction/.test(status))return {label:'Under construction',tone:'construction'};
  if(project.modelLayer==='existing'||/^(?:existing|built|completed?|occupied|open\b)/.test(status))return {label:'Existing',tone:'existing'};
  if(/(?:approval|approved) in principle/.test(status))return {label:'Approval in principle',tone:'proposed'};
  if(/zoning approved|zoning settled/.test(status))return {label:'Zoning approved',tone:'proposed'};
  if(/(?:approved|approval|council passed|zoning settled|holding provision removed|master plan endorsed)/.test(status))return {label:'Approved',tone:'proposed'};
  if(/appealed|appeal/.test(status))return {label:'Under appeal',tone:'uncertain'};
  if(/under review|received/.test(status))return {label:'Under review',tone:'proposed'};
  if(/(?:construction stage|construction timing|construction start|current application).*?(?:unverified|unconfirmed|not verified)/.test(status))return {label:'Status unconfirmed',tone:'uncertain'};
  if(/(?:propos|planned|planning|application|rezoning|concept|draft|preconstruction|pre construction|feasibility|masterplan)/.test(status))return {label:'Proposed',tone:'proposed'};
  return {label:raw.split(/[·;]/)[0].trim()||'Status not recorded',tone:'neutral'};
}

function modelQualifier(project,asset,override){
  if(override?.qualifier)return override.qualifier;
  if(/construction (?:stage|start|timing).*?(?:unverified|not verified|unconfirmed)|construction (?:unverified|not verified|unconfirmed)/i.test(text(project.status)))return 'Stage unconfirmed';
  const description=[project.geometryCoverage,asset?.modelFidelity].map(text).join(' ');
  if(project.referenceStudy||asset?.uncertainGeometry||/approx|schematic|proxy|silhouette|inferred|unverified|reference study/i.test(description))return 'Approximate model';
  return '';
}

function facts(project){
  const actual=project.actualCompletionDate||project.completionDate||project.completion?.actual;
  const target=project.targetCompletionDate;
  const rows=[];
  if(isKnown(actual))rows.push(['Completion / occupancy',text(actual)]);
  if(isKnown(target))rows.push(['Target completion / occupancy',text(target)]);
  if(!isKnown(actual)&&isKnown(project.completionYear))rows.push(['Reported completion year',text(project.completionYear)]);
  const construction=project.actualConstruction;
  if(construction){
    const date=construction.evidenceDate||construction.asOf;
    const stage=text(construction.stage||construction.status);
    if(stage||isKnown(date))rows.push(['Construction report',[stage,isKnown(date)?text(date):''].filter(Boolean).join(' · ')]);
  }
  const counts=unique([project.storeys].flat().filter(n=>Number.isFinite(Number(n))&&Number(n)>0));
  if(counts.length)rows.push(['Source storey counts',counts.join(', ')]);
  return rows;
}

/** Unknown date fields are absent, not rendered as a warning or a date. */
export function completionRowsHTML(project){
  const rows=facts(project);
  return rows.length?`<dl class="project-card-facts">${rows.map(([label,value])=>`<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`:'';
}

function sourceItems(project,override){
  const sources=override?.sources?override.sources(project):(project.sources||[]);
  const seen=new Set();
  return sources.map(s=>typeof s==='string'?{url:s,title:s}:s).filter(Boolean).filter(s=>{
    const key=validURL(s.url)||unique([s.title,s.publisher,s.source]).join('|');
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  });
}
function sourcesHTML(sources){
  if(!sources.length)return '';
  return `<section class="project-card-sources" aria-label="Sources and credits"><h4>Sources & credits</h4><ul>${sources.map(s=>{
    const url=validURL(s.url),label=text(s.title||s.publisher||s.source)||'Source';
    const credit=text(s.publisher);
    return `<li>${url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}<span aria-hidden="true"> ↗</span></a>`:`<span>${escapeHTML(label)}</span>`}${credit&&credit!==label&&!label.toLowerCase().includes(credit.toLowerCase())?`<small>${escapeHTML(credit)}</small>`:''}${s.note?`<small>${escapeHTML(s.note)}</small>`:''}</li>`;
  }).join('')}</ul></section>`;
}
function modelNotes(project,asset,override){
  if(override?.notes)return override.notes;
  const summary=text(project.summary);
  const notes=unique([project.geometryCoverage,project.modelCaveat,asset?.modelFidelity,asset?.warning,project.recordedProgressModel])
    .filter(note=>note!==summary);
  const completionNote=text(project.completion?.note||project.completionDateNote);
  // Boilerplate about absent dates adds no useful information to an undated card.
  if(completionNote&&!/^(?:no verified completion date|no confirmed (?:completion|occupancy) date|not independently confirmed)/i.test(completionNote)&&!notes.includes(completionNote))notes.push(completionNote);
  if((project.referenceStudy||asset?.uncertainGeometry)&&!notes.some(n=>/colou?r|finish|material/i.test(n)))notes.push('Colours and finishes may differ from the building.');
  else if(asset?.preserveMaterials&&!notes.some(n=>/colou?r|finish|material|texture|cladding/i.test(n)))notes.push('Source colours are shown; current finishes may differ.');
  return notes;
}

/** Selection-panel contents. Existing close button and camera logic stay in app.js. */
export function projectDetailsHTML(project,{asset=null}={}){
  const override=overrides[project.id],status=projectStatus(project),summary=override?.summary||text(project.summary);
  const location=unique([project.address&&project.address!==project.name?project.address:'',project.district||project.researchArea]).join(' · ');
  const notes=modelNotes(project,asset,override),sources=sourceItems(project,override),raw=text(project.status);
  const statusDetail=!override?.omitStatusDetail&&raw&&raw!==status.label?`<p class="project-card-status-detail">${escapeHTML(raw)}${project.statusDate?` · ${escapeHTML(project.statusDate)}`:''}</p>`:'';
  const sourceNote=override?.sourceNote||'Reference material belongs to its credited owners. A source link does not grant permission to reuse it.';
  const detail=notes.length||sources.length||statusDetail||facts(project).length,qualifier=modelQualifier(project,asset,override);
  return `<div class="project-card-content"><div class="project-card-meta"><span class="project-card-status" data-tone="${status.tone}">${escapeHTML(status.label)}</span>${qualifier?`<span class="project-card-qualifier">${escapeHTML(qualifier)}</span>`:''}</div><h3>${escapeHTML(project.name)}</h3>${location?`<p class="project-card-location">${escapeHTML(location)}</p>`:''}${summary?`<p class="project-card-summary">${escapeHTML(summary)}</p>`:''}${detail?`<details class="project-card-disclosure"><summary>About this model & sources</summary><div class="project-card-details">${statusDetail}${notes.length?`<section aria-label="Model details"><h4>The model</h4>${notes.map(note=>`<p>${escapeHTML(note)}</p>`).join('')}</section>`:''}${completionRowsHTML(project)}${sourcesHTML(sources)}${sources.length?`<p class="project-card-rights">${escapeHTML(sourceNote)}</p>`:''}</div></details>`:''}</div>`;
}

/** Research-register card. The existing [data-project] focus handler is retained. */
export function projectCardHTML(project,options={}){
  const located=Array.isArray(project.position)&&project.position.length===3&&project.position.every(Number.isFinite);
  return `<article class="project project-card" id="project-${escapeHTML(project.id)}">${projectDetailsHTML(project,options)}${located?`<button class="locate" data-project="${escapeHTML(project.id)}">${escapeHTML(project.studyActionLabel||'Show on map')} <span aria-hidden="true">↗</span></button>`:''}</article>`;
}
