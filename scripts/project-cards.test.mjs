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
