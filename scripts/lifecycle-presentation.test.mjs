import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveModelLifecycle,displayStatusForLifecycle,statusMaterialKey,statusColours} from '../public/model-status-materials.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {STATUS_LEGEND,statusLegendFor,presentationLayout,drawPresentationFooter} from '../public/scene-presentation.js';
import {projectDetailsHTML,projectStatus} from '../public/project-cards.js';
const read=name=>JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url)));
const assets=read('refinement-models').assets,projects=read('projects'),overrides=read('overrides');
const model=(lifecycle,extra={})=>({userData:{lifecycle,displayStatus:displayStatusForLifecycle(lifecycle),...extra},geometry:{attributes:{position:{count:3}},index:{count:3}}});

test('the actual Voya and M5 records retain construction lifecycle when approximate geometry is filtered',()=>{
 for(const id of ['voya-towers-plan-derived','mcity-m5-developer-proxy']){
  const asset=assets.find(item=>item.id===id),project=projects.find(item=>item.id===asset.projectId);
  const lifecycle=resolveModelLifecycle({Status:asset.status,lifecycle:asset.lifecycle,componentPhase:asset.componentPhase},{},project);
  assert.equal(lifecycle,'under_construction',id);assert.equal(asset.uncertainGeometry,true);
  const mesh=model(lifecycle,{uncertain:true,modes:asset.modes,assetId:asset.id,projectId:asset.projectId});
  applyModelVisibility([mesh],'future',{unknownStatuses:false});assert.equal(mesh.visible,true,id);
  applyModelVisibility([mesh],'construction',{unknownStatuses:false});assert.equal(mesh.visible,false,'full envelopes do not invent measured construction progress');
 }
});

test('component evidence outranks mixed masterplan and project-wide lifecycle',()=>{
 for(const projectId of ['brightwater-master','lakeview-master','watergarden']){
  const project=projects.find(item=>item.id===projectId);assert.equal(project.lifecycle,'mixed',projectId);
  assert.equal(resolveModelLifecycle({Status:'Uncertain'},{},project),'unknown');
  assert.equal(resolveModelLifecycle({Status:'Proposed',componentPhase:{lifecycle:'existing'}},{},project),'existing');
  assert.equal(resolveModelLifecycle({lifecycle:'existing'},{componentPhase:{lifecycle:'under_construction'}},project),'under_construction');
 }
 assert.equal(resolveModelLifecycle({lifecycle:'existing'}, {},{lifecycle:'approved'}),'existing','a retained office is not recoloured for its proposed redevelopment');
});

test('the saved Gemma and Lakeview phase records resolve independently in the mixed community',()=>{
 const expected={'22-14233':'existing','22-14234':'existing','22-14235':'existing','22-14236':'proposed','22-14237':'proposed','22-14238':'proposed','22-14239':'proposed','103-1087':'approved','103-1094':'approved','103-1077':'proposed','103-1080':'proposed','103-1095':'proposed'};
 for(const [id,wanted] of Object.entries(expected)){
  const override=overrides[id],project=projects.find(item=>item.id===override.projectId);
  assert.equal(project.lifecycle,'mixed',id);
  assert.equal(resolveModelLifecycle({id,Status:'Proposed'},override,project),wanted,id);
 }
});

test('approved geometry has its own colour and appears in future without implying construction',()=>{
 const approved=assets.find(asset=>asset.id==='30-eglinton-west-approved-envelope');assert.equal(approved.lifecycle,'approved');
 const lifecycle=resolveModelLifecycle({Status:approved.status,lifecycle:approved.lifecycle},{},projects.find(project=>project.id===approved.projectId));
 assert.equal(lifecycle,'approved');assert.equal(statusColours[statusMaterialKey(displayStatusForLifecycle(lifecycle))],0xc49b52);
 assert.notEqual(statusColours.Approved,statusColours.Proposed);assert.notEqual(statusColours.Approved,statusColours.Uncertain);
 const mesh=model(lifecycle,{uncertain:true});applyModelVisibility([mesh],'future',{unknownStatuses:false});assert(mesh.visible);
 for(const which of ['existing','construction']){applyModelVisibility([mesh],which);assert.equal(mesh.visible,false);}
});

test('all nine unresolved source identities stay unknown and respond only to the status filter',()=>{
 for(const id of ['102-7101','102-7105','103-1103','11-5545','71-6200','51-5314','92-4866','21-4741','41-7762']){
  // Read the named records from the audit-owned manifest rather than infer an identity.
  assert.equal(overrides[id]?.lifecycle,'unknown',id);
  assert.equal(resolveModelLifecycle({Status:'Proposed'},overrides[id],{}),'unknown',id);
 }
 const mesh=model('unknown',{uncertain:false});applyModelVisibility([mesh],'future',{unknownStatuses:false});assert.equal(mesh.visible,false);
 applyModelVisibility([mesh],'future',{unknownStatuses:true});assert.equal(mesh.visible,true);
 const excluded=model('unknown',{hiddenObsolete:true});applyModelVisibility([excluded],'future',{unknownStatuses:true});assert.equal(excluded.visible,false);
});

test('inactive designs require their exact historical-study selection and never bypass exclusion',()=>{
 for(const lifecycle of ['on_hold','cancelled']){
  const mesh=model(lifecycle,{projectId:'history',draftStudy:true,modes:['future']});
  for(const options of [{},{referenceStudies:true},{selectedStudyProjectId:'other'}]){applyModelVisibility([mesh],'future',options);assert.equal(mesh.visible,false);}
  applyModelVisibility([mesh],'future',{selectedStudyProjectId:'history',unknownStatuses:false});assert.equal(mesh.visible,true);
  for(const scenario of ['existing','construction']){applyModelVisibility([mesh],scenario,{selectedStudyProjectId:'history'});assert.equal(mesh.visible,false);}
  mesh.userData.hiddenObsolete=true;applyModelVisibility([mesh],'future',{selectedStudyProjectId:'history'});assert.equal(mesh.visible,false);
  const unlabelled=model(lifecycle,{projectId:'history'});applyModelVisibility([unlabelled],'future',{selectedStudyProjectId:'history'});assert.equal(unlabelled.visible,false);
 }
});

test('current viewer and newly saved image key separate approved from proposed and geometry confidence',()=>{
 assert.deepEqual(STATUS_LEGEND.map(item=>item.key),['existing','under_construction','approved','proposed','unknown']);
 assert.equal(STATUS_LEGEND.find(item=>item.key==='approved').color,'#c49b52');
 assert.equal(STATUS_LEGEND.find(item=>item.key==='unknown').label,'Status unverified');
 const html=readFileSync(new URL('../public/explore.html',import.meta.url),'utf8');
 assert.match(html,/id="unknownStatusToggle"/);assert.doesNotMatch(html,/Proposed \/ approved|Needs checking|uncertainToggle/);
 assert.match(html,/Detailed studies retain their architectural materials/);
 for(const width of [390,1400])for(const states of [[],['on_hold','cancelled']]){
  const legend=statusLegendFor(states),labels=[],swatches=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(x,y,w,h){if(w===16)swatches.push({x,y,w,h,color:this.fillStyle});},fillText(label,x,y){labels.push({label,x,y});}};
  const height=drawPresentationFooter(ctx,{width,top:0,title:'Downtown',scenario:'Future scenario',bearing:null,legend}),layout=presentationLayout(width,legend);
  assert.equal(height,layout.height);
  for(const item of legend){assert(labels.some(row=>row.label===item.label));assert(swatches.some(row=>row.color===item.color));}
  assert(labels.every(row=>row.y*layout.scale<height),'all legend labels fit within the footer');
 }
});

test('project details show dated planning evidence separately from approximate geometry',()=>{
 const project={id:'test',name:'Test project',lifecycle:'approved',status:'Zoning approved; site plan remains under review',approvalStage:'Zoning only',statusEvidenceDate:'2026-10-01',lifecycleNote:'The zoning was approved on 1 October 2026.',modelCaveat:'The roof outline remains approximate.'};
 assert.deepEqual(projectStatus(project),{label:'Approved planning',tone:'approved'});
 const html=projectDetailsHTML(project,{asset:{uncertainGeometry:true}});
 assert.match(html,/Approved planning/);assert.match(html,/Approximate model/);assert.match(html,/Planning approval/);assert.match(html,/Zoning only/);assert.match(html,/2026-10-01/);assert.match(html,/roof outline remains approximate/);
 assert.equal(projectStatus({...project,lifecycle:'mixed'}).label,'Mixed phases');
});
