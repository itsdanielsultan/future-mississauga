import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectDetailsHTML,projectStatus,completionRowsHTML} from '../public/project-cards.js';
const projects=JSON.parse(fs.readFileSync(new URL('../public/data/projects.json',import.meta.url)));
test('the existing 41 Bay home has no fabricated completion date or repeated caveat',()=>{
 const project=projects.find(p=>p.id==='merner-41-bay'),before=JSON.stringify(project);
 const html=projectDetailsHTML(project);
 assert.match(html,/A gabled home with an addition and a wraparound porch\./);
 assert.match(html,/Approximate exterior/);
 assert.match(html,/Merner Row Design \/ Lisa Apps/);
 assert.match(html,/2017/);
 assert.match(html,/<details class="project-card-disclosure">/);
 assert.doesNotMatch(html,/Not independently confirmed|No verified date found|Actual completion \/ occupancy/);
 assert.equal((html.match(/A gabled home/g)||[]).length,1);
 assert.equal(JSON.stringify(project),before);
});
test('partial construction, conditional approvals and forecasts remain qualified',()=>{
 assert.equal(projectStatus({status:'under-construction-partly-completed'}).label,'Partly built');
 assert.equal(projectStatus({status:'Tribunal approval in principle; final order pending conditions'}).label,'Approval in principle');
 assert.equal(projectStatus({status:'Zoning approved · demolition underway'}).label,'Demolition / early works');
 const html=completionRowsHTML({actualCompletionDate:null,targetCompletionDate:'Q4 2028'});
 assert.match(html,/Target completion \/ occupancy/);
 assert.match(html,/Q4 2028/);
 assert.doesNotMatch(html,/<dt>Completion \/ occupancy<\/dt>/);
});

test('a received Harborn proposal never becomes approved from the words approval unconfirmed',()=>{
 const project=projects.find(p=>p.id==='harborn-50-60');assert(project);assert.equal(project.status,'Received proposal · approval unconfirmed');assert.deepEqual(projectStatus(project),{label:'Under review',tone:'proposed'});
 for(const status of ['Received proposal · approval unverified','Application received; no approval established','Proposed; not approved'])assert.notEqual(projectStatus({status}).label,'Approved');
 assert.equal(projectStatus({status:'Council passed'}).label,'Approved');assert.equal(projectStatus({status:'Zoning approved; site plan pending'}).label,'Zoning approved');assert.equal(projectStatus({lifecycle:'approved',status:'Planning approved; building permit unconfirmed'}).label,'Approved planning');
});

test('approval qualifiers precede every legacy approval fallback',()=>{
 for(const status of ['Not yet approved','Site plan approved (unconfirmed)','Site plan approved; decision unverified','Approved status not confirmed','Zoning approved (unconfirmed)','Zoning approved; approval not confirmed','Approval in principle (unconfirmed)']){
  assert.deepEqual(projectStatus({status}),{label:'Under review',tone:'proposed'},status);
 }
 assert.equal(projectStatus({status:'Zoning approved; site plan pending'}).label,'Zoning approved');
 assert.equal(projectStatus({status:'Site plan approved; building permit unconfirmed'}).label,'Approved');
 assert.equal(projectStatus({status:'Approval in principle'}).label,'Approval in principle');
 assert.equal(projectStatus({lifecycle:'approved',status:'Site plan approved (unconfirmed)'}).label,'Approved planning');
});


test('approval fallback requires a positive decision rather than the noun approval',()=>{
 for(const status of ['Approval under review','Approval not received','Application for approval','Approval pending','Approval not granted','Approval has not been issued','Approval required; proposal received'])assert.notEqual(projectStatus({status}).label,'Approved',status);
 for(const status of ['Planning approved','Approval granted','Approval issued','Approval received','Approval has been granted','Received approval','Council passed'])assert.equal(projectStatus({status}).label,'Approved',status);
 assert.equal(projectStatus({status:'Proposal received; approval under review'}).label,'Under review');
 assert.deepEqual(projectStatus({lifecycle:'approved',status:'Approval not received'}),{label:'Approved planning',tone:'approved'});
 assert.deepEqual(projectStatus({lifecycle:'proposed',status:'Approval granted'}),{label:'Proposed',tone:'proposed'});
});

test('Harborn has a concise summary while its evidence and uncertainty stay in the disclosure',()=>{
 const project=projects.find(p=>p.id==='harborn-50-60'),before=JSON.stringify(project),html=projectDetailsHTML(project);
 assert.match(html,/<p class="project-card-summary">Twelve proposed townhomes in two four-storey mansard rows\.<\/p>/);
 const disclosure=html.slice(html.indexOf('<details'));
 assert.match(disclosure,/Received proposal · approval unconfirmed/);
 assert.match(disclosure,/Approval and construction are not established\./);
 assert.match(disclosure,/separate statistics sheet lists thirteen homes/);
 assert.equal(JSON.stringify(project),before);
});
