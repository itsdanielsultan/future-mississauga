import {buildingMapProfiles} from './building-map-profiles.js?v=20261120-buildings';
import {LIFECYCLE_LABELS} from './model-status-materials.js?v=20261101-status2';
/** Project card presentation only. Does not change project facts or model status. */
import {buildingFeedbackHTML} from './building-feedback.js?v=20261028-improvements1';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>typeof value==='string'?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):'';
const unique=values=>[...new Set(values.map(text).filter(Boolean))];
const districtLabels=Object.freeze({citywide:'All Mississauga',downtown:'Downtown','port-credit':'Port Credit',lakeview:'Lakeview',clarkson:'Clarkson',cooksville:'Cooksville',uptown:'Uptown & Hurontario','erin-mills':'Erin Mills',streetsville:'Streetsville',meadowvale:'Meadowvale & Lisgar',malton:'Malton','dixie-applewood':'Dixie & Applewood',erindale:'Erindale & Sheridan','airport-corporate':'Airport & Corporate',heartland:'Heartland & Gateway','lorne-park':'Lorne Park · Aldo area','churchill-meadows':'Churchill Meadows',lisgar:'Lisgar & Argentia','meadowvale-village':'Meadowvale Village','east-credit-creditview':'East Credit & Creditview'});
export const projectDistrictLabel=project=>{const district=text(project.district)||text(project.researchArea);return districtLabels[district]||district;};
const isKnown=value=>(typeof value!=='number'||value>0)&&Boolean(text(value))&&!/^(?:unknown|unconfirmed|not (?:known|confirmed|independently confirmed|available|verified)|no (?:verified|confirmed|known|date)|n\/?a|null|none|tbd|to be (?:confirmed|determined))\b/i.test(text(value));
const validURL=value=>{try{const u=new URL(text(value));return /^(https?:)$/.test(u.protocol)?u.href:null;}catch{return null;}};

const overrides={
  "harborn-50-60":{summary:"Twelve proposed townhomes in two four-storey mansard rows."},
  "mcity-1-2":{
    credit:"Model: Daniel Sultan. Architecture: CORE Architects. City of Mississauga source podium geometry.",
    notes:[
      "CORE’s seven floor-plate outlines guide the exterior. Added glazing and bands improve selected podium surfaces.",
      "Floor phase, heights and podium details remain approximate. M1’s added low pavilion has an estimated roof height; existing ground-level podium gaps remain unresolved. This is not a measured as-built model."
    ]
  },
  "port-credit-50-high":{
    targetCompletionLabels:{"2028-01":"January 2028 · City programme forecast"},
    notes:[
      "The exterior follows the December 2025 drawings, including facade frames and roof arches. Frame depths, glazing and finishes are approximate.",
      "The future view shows the planned building. The dated City model retains the older building; the extent of demolition is not mapped."
]
  },
  "mcity-3":{
    credit:"Model: Daniel Sultan. Architecture: IBI Group / Arcadis. City placement reference: City of Mississauga.",
    notes:[
      "The exterior follows published plans and dated 2026 photographs, including the changing tower outline, stepped crown and raised glass pavilion.",
      "Floor spacing, facade patterns, crown details, podium and placement are approximate. This is an exterior interpretation, not a surveyed or as-built model."
    ]
  },
  "mcity-4":{
    credit:"Model: Daniel Sultan. Architecture: CORE Architects.",
    notes:[
      "The completed-design view follows CORE Architects’ March 2020 drawings and later exterior references. The 215.65 m maximum height follows the drawing; shorter crown shapes and podium details remain approximate.",
      "The construction view records Spring 2026 progress: concrete at level 41 and glazing at level 26."
    ]
  },
  "mcity-5":{
    credit:"Model: Daniel Sultan. Architecture: IBI Group.",
    notes:[
      "The future view follows the brochure’s 36-storey design, six-storey masonry podium and seventh-floor amenities.",
      "Facade dimensions and placement are approximate; building height is unverified. The model shows the intended finished exterior, not a measured construction stage."
    ]
  },
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

const readableStatuses={
 'sale-feasibility-concept':'Sale and feasibility concept',
 'mixed-completed-and-under-construction':'Some buildings completed; others under construction',
 'proposed-active':'Active proposal',
 'under-construction-partly-completed':'Under construction; some buildings completed',
 'council-endorsed-vision-feasibility':'Council-endorsed vision under feasibility review',
 'under-construction':'Under construction',
 'approved-old-current-status-unconfirmed':'Earlier approval; current status unconfirmed',
 'site-plan-proposed':'Site plan proposal',
 'long-term-masterplan':'Long-term master plan',
 'completed-operating':'Completed and operating'
};
export const projectStatusDetail=project=>{const detail=readableStatuses[text(project.status)]||text(project.status);return detail?detail[0].toUpperCase()+detail.slice(1):'';};
const publicCaveats={
 'square-one-masterplan':"Oxford’s 2025 account describes 48 buildings, including 41 residential buildings; the original architect’s plan has 37 towers. These totals describe different versions or definitions. Individual phases are listed separately.",
 'square-one-phase1':"The model uses the City’s dated 2024 shapes. Published storey counts differ: STAK 36 is listed at 48 storeys in the current Daniels fact sheet and 44 in older Oxford material; Dialogue is marketed at 37, while some architectural records count 36. Final roof details remain unverified.",
 '180-burnhamthorpe':"The City’s June 2026 register describes 40- and 60-storey towers with an eight-storey podium. A published 2023 revision gives 71 and 46 storeys. The dated City shapes do not match that revision, and no approved elevation has resolved the difference.",
 'parkside-block11':"An older approval is recorded, but the current status, exact block and any later design change remain unconfirmed. Cancellation has not been established.",
 'keystone':"The completed City model shapes are shown. Heights of 81.42 m and 71.90 m are calculated from the captured geometry, not verified architectural dimensions.",
 'brightwater-mason':"The source footprint matches the master plan’s G1 building and shows a body of roughly nine storeys. Captured roof levels are source geometry, not a new survey.",
 'winston-6020':"The model shows a qualified planned building shape. Its current built form and structural progress remain unverified. Peel forecasts the second quarter of 2028; the City programme forecasts fall 2027. Both are expected dates, not confirmed completion.",
 'brandon-3233':"The earlier mixed-use design has been superseded. Funding material describes 85 affordable rental units, not 85 separate townhouse buildings.",
 'brightwater-credit-river-way':"The City’s 2024 shape matches the master plan’s D1 building. The informal name ‘The Kee’ was not supported by the reviewed primary sources. Its captured roof level is source geometry, not a new survey."
};
export const publicModelCaveat=project=>publicCaveats[project.id]||text(project.modelCaveat);
export const publicModelCoverage=project=>text(project.geometryCoverage)==='Latest geometry unavailable in source model'?'The latest building design is not included in this model.':text(project.geometryCoverage);

/** Detailed source qualifications remain separate from the short status label. */
export function projectStatus(project){
  if(project.lifecycle==='proposed'&&project.status==='plans-under-review')return {label:'Under review',tone:'proposed'};
  if(LIFECYCLE_LABELS[project.lifecycle])return {label:LIFECYCLE_LABELS[project.lifecycle],tone:({existing:'existing',under_construction:'construction',approved:'approved',proposed:'proposed',on_hold:'neutral',cancelled:'neutral',unknown:'uncertain',mixed:'neutral'})[project.lifecycle]};
  const raw=text(project.status),status=raw.toLowerCase().replace(/[_–—-]+/g,' ').replace(/\s+/g,' ');
  // Mixed communities and partial structures must never become “Existing”.
  if(/(?:partially built|partly completed|mixed completed|partially completed)/.test(status))return {label:'Partly built',tone:'construction'};
  if(/(?:on hold|paused)/.test(status))return {label:'On hold',tone:'uncertain'};
  if(/(?:demolition|early works)/.test(status))return {label:/demolition/.test(status)?'Demolition / early works':'Early works',tone:'proposed'};
  if(/(?:historical|earlier|old current status)/.test(status)&&/(?:unverified|unconfirmed|uncertain|retained|historical)/.test(status))return {label:'Earlier design',tone:'uncertain'};
  if(/^(?:uncertain|superseded|disputed)/.test(status))return {label:'Uncertain',tone:'uncertain'};
  if(/under construction|construction underway|construction in progress|topped out/.test(status)&&!/construction (?:not verified|unverified|unconfirmed)|(?:not |no |before |awaiting )construction/.test(status))return {label:'Under construction',tone:'construction'};
  if(project.modelLayer==='existing'||/^(?:existing|built|completed?|occupied|open\b)/.test(status))return {label:'Existing',tone:'existing'};
  const approvalUnconfirmed=/\b(?:approval|approved)(?:\s+in\s+principle)?\s*(?:[(:;,·]\s*)?(?:(?:status|decision)\s+)?(?:unconfirmed|unverified|uncertain|pending|under review|(?:has\s+)?not(?:\s+yet)?(?:\s+been)?\s+(?:confirmed|established|verified|received|granted|issued))\b|\b(?:no|without|awaiting|pending)\s+(?:an?\s+)?approval\b|\bnot(?:\s+yet)?\s+approved\b/.test(status);
  // Qualifiers apply to every approval fallback, including zoning and in-principle
  // decisions. An unrelated pending permit does not negate confirmed zoning.
  if(approvalUnconfirmed)return {label:'Under review',tone:'proposed'};
  if(/(?:approval|approved) in principle/.test(status))return {label:'Approval in principle',tone:'proposed'};
  if(/zoning approved|zoning settled/.test(status))return {label:'Zoning approved',tone:'proposed'};
  if(/\b(?:approved|approval\s+(?:(?:has been|was|is)\s+)?(?:granted|issued|received)|(?:granted|issued|received)\s+(?:planning\s+|site plan\s+)?approval|council passed|zoning settled|holding provision removed|master plan endorsed)\b/.test(status))return {label:'Approved',tone:'proposed'};
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
  if(isKnown(project.approvalStage))rows.push(['Planning approval',text(project.approvalStage)]);
  if(isKnown(project.statusEvidenceDate))rows.push(['Status evidence',text(project.statusEvidenceDate)]);
  if(isKnown(actual))rows.push(['Completion / occupancy',text(actual)]);
  if(isKnown(target))rows.push(['Target completion / occupancy',overrides[project.id]?.targetCompletionLabels?.[target]||text(target)]);
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

function sourceItems(project,override,asset){
  const projectSources=override?.sources?override.sources(project):(project.sources||[]);
  const sources=[...projectSources,...(asset?.sources||[])];
  const seen=new Set();
  return sources.map(s=>typeof s==='string'?{url:s,title:s}:s).filter(Boolean).filter(s=>{
    const key=validURL(s.url)||unique([s.title,s.publisher,s.source]).join('|');
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  });
}
function sourcesHTML(sources,credit){
  if(!sources.length&&!credit)return '';
  return `<section class="project-card-sources" aria-label="Sources and credits"><h4>Sources & credits</h4>${credit?`<p class="project-card-credit">${escapeHTML(credit)}</p>`:''}${sources.length?`<ul>${sources.map(s=>{
    const url=validURL(s.url),label=text(s.title||s.publisher||s.source)||'Source';
    const credit=text(s.publisher);
    return `<li>${url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}<span aria-hidden="true"> ↗</span></a>`:`<span>${escapeHTML(label)}</span>`}${credit&&credit!==label&&!label.toLowerCase().includes(credit.toLowerCase())?`<small>${escapeHTML(credit)}</small>`:''}${s.note?`<small>${escapeHTML(s.note)}</small>`:''}</li>`;
  }).join('')}</ul>`:''}</section>`;
}
function modelNotes(project,asset,override){
  if(override?.notes)return override.notes;
  const summary=text(project.summary);
  const notes=unique([publicModelCoverage(project),publicModelCaveat(project),asset?.modelFidelity,asset?.warning,project.recordedProgressModel])
    .filter(note=>note!==summary);
  const completionNote=text(project.completion?.note||project.completionDateNote);
  // Boilerplate about absent dates adds no useful information to an undated card.
  if(completionNote&&!/^(?:no verified completion date|no confirmed (?:completion|occupancy) date|not independently confirmed)/i.test(completionNote)&&!notes.includes(completionNote))notes.push(completionNote);
  if((project.referenceStudy||asset?.uncertainGeometry)&&!notes.some(n=>/colou?r|finish|material/i.test(n)))notes.push('Colours and finishes may differ from the building.');
  else if(asset?.preserveMaterials&&!notes.some(n=>/colou?r|finish|material|texture|cladding/i.test(n)))notes.push('Source colours are shown; current finishes may differ.');
  return notes;
}

function placeLinks(project) {
  const profiles = buildingMapProfiles[project.id] || [];
  const links = profiles.map(([id, name]) => {
    const label = profiles.length === 1 ? 'Building, photos and location' : name;
    return `<a href="building-${encodeURIComponent(id)}.html">${escapeHTML(label)}</a>`;
  });
  const point = Number.isFinite(project.lat) && Number.isFinite(project.lon);
  const street = project.address?.trim();
  const query = point ? project.lat + ',' + project.lon : street ? street + ', Mississauga, Ontario, Canada' : '';
  if (query) {
    links.push(`<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(query)}">Google Maps</a>`);
    links.push(`<a href="https://maps.apple.com/?q=${encodeURIComponent(query)}">Apple Maps</a>`);
  }
  return links.length ? `<nav class="place-destinations" aria-label="Explore this project">${links.join(' ')}</nav>` : '';
}

/** Selection-panel contents. Existing close button and camera logic stay in app.js. */
export function projectDetailsHTML(project,{asset=null,view={},revision=null}={}){
  const override=overrides[project.id],status=projectStatus(project),summary=override?.summary||text(project.summary);
  const location=unique([project.address&&project.address!==project.name?project.address:'',projectDistrictLabel(project)]).join(' · ');
  const notes=modelNotes(project,asset,override),sources=sourceItems(project,override,asset),raw=projectStatusDetail(project);
  const credit=text(override?.credit||asset?.credit);
  const currentStatusNote=text(project.lifecycleNote);
  const statusDetail=(currentStatusNote?`<p class="project-card-status-detail">${escapeHTML(currentStatusNote)}</p>`:'')+(!override?.omitStatusDetail&&raw&&raw!==status.label?`<p class="project-card-status-detail">${escapeHTML(raw)}${project.statusDate?` · ${escapeHTML(project.statusDate)}`:''}</p>`:'');
  const sourceNote=override?.sourceNote||'Reference material belongs to its credited owners. A source link does not grant permission to reuse it.';
  const detail=notes.length||sources.length||credit||statusDetail||facts(project).length,qualifier=modelQualifier(project,asset,override);
  const previews=({'harborn-50-60':[['harborn-50-60','Open model preview']],'port-credit-26-park':[['port-credit-26-park','Open model preview']],'voya':[['voya','Open model preview']],'ergocentric-275-superior':[['ergocentric-275-superior','Open model preview']],'sgm-maritz-6710':[['sgm-maritz-6710','Open model preview']],'artform':[['artform','Open model preview']],'mcity-1-2':[['mcity-pair','Open model preview']],'mcity-5':[['mcity-m5','Open model preview']],'edge-oro':[['edge-1','Edge 1 study'],['edge-2','Edge 2 study'],['oro','Oro intended-design study']],'avia':[['avia-1','Avia 1 with shared podium'],['avia-2','Avia 2 with shared podium']]})[project.id];
  const preview=previews?`<p class="project-model-preview">${previews.map(([id,title])=>`<a href="model.html?model=${id}">${escapeHTML(title)} →</a>`).join(' · ')}</p>`:'';
  const revisionLine=revision?.projectId===project.id?`<p class="project-card-location" aria-label="Model revision"><time datetime="${escapeHTML(revision.updatedOn)}">${escapeHTML(revision.label)}</time></p>`:'';
  const feedback=`<p class="project-model-preview">${buildingFeedbackHTML(project,view)}</p>`;
  const referenceCredit=project.id==='ergocentric-275-superior'?'<p class="project-card-location">Photographic reference: <a href="https://www.cityscapephotography.ca/" target="_blank" rel="noopener noreferrer">David Lasker/Cityscape Photography</a></p>':'';
  return `<div class="project-card-content"><div class="project-card-meta"><span class="project-card-status" data-tone="${status.tone}">${escapeHTML(status.label)}</span>${qualifier?`<span class="project-card-qualifier">${escapeHTML(qualifier)}</span>`:''}</div><h3>${escapeHTML(project.name)}</h3>${location?`<p class="project-card-location">${escapeHTML(location)}</p>`:''}${summary?`<p class="project-card-summary">${escapeHTML(summary)}</p>`:''}${revisionLine}${placeLinks(project)}${detail ? '' : preview}${referenceCredit}${detail?`<details class="project-card-disclosure"><summary>About this model & sources</summary><div class="project-card-details">${preview}${statusDetail}${notes.length?`<section aria-label="Model details"><h4>The model</h4>${notes.map(note=>`<p>${escapeHTML(note)}</p>`).join('')}</section>`:''}${completionRowsHTML(project)}${sourcesHTML(sources,credit)}${sources.length?`<p class="project-card-rights">${escapeHTML(sourceNote)}</p>`:''}</div></details>`:''}${feedback}</div>`;
}

/** Research-register card. The existing [data-project] focus handler is retained. */
export function projectCardHTML(project,options={}){
  const located=Array.isArray(project.position)&&project.position.length===3&&project.position.every(Number.isFinite);
  return `<article class="project project-card" id="project-${escapeHTML(project.id)}">${projectDetailsHTML(project,options)}${located?`<button class="locate ui-button" data-project="${escapeHTML(project.id)}" data-variant="outline">${escapeHTML(project.studyActionLabel||'Show on map')} <span aria-hidden="true">↗</span></button>`:''}</article>`;
}
