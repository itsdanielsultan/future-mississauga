import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {createModelAppearance,NATURAL_MASSING_COLOUR} from '../public/model-appearance.js';
import {PLANNING_APPEARANCE,planningAppearanceKey,planningAppearanceColour,planningStatusLegendFor} from '../public/planning-appearance.js';
import {applyModelVisibility} from '../public/model-visibility.js';
import {drawPresentationFooter} from '../public/scene-presentation.js';
import {projectStatus,projectDetailsHTML} from '../public/project-cards.js';

const makeMesh=lifecycle=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x445566}));
  mesh.userData={lifecycle,uncertain:true,modelCaveat:'Roof geometry remains approximate.'};return mesh;
};

test('planning colours distinguish recorded stages, unverified status and inactive designs',()=>{
  assert.deepEqual(PLANNING_APPEARANCE.map(x=>x.label),['Existing','Under construction','Approved planning','Proposed','Status unverified','On hold','Cancelled']);
  for(const lifecycle of ['existing','under_construction','approved','proposed','unknown','on_hold','cancelled'])assert.equal(planningAppearanceKey({lifecycle}),lifecycle);
  assert.equal(planningAppearanceKey({lifecycle:'mixed'}),'unknown');
  for(const lifecycle of ['invalid']){
    assert.equal(planningAppearanceKey({lifecycle,Status:'Proposed'}),null,lifecycle);
    assert.equal(planningAppearanceColour(null),NATURAL_MASSING_COLOUR);
  }
  assert.equal(planningAppearanceKey({Status:'Proposed; dated2024 reference'}),'proposed');
  assert.equal(planningAppearanceKey({Status:'Proposed; applicant on hold'}),'on_hold');
  assert.deepEqual(planningStatusLegendFor(['unknown','on_hold','cancelled']).map(x=>x.key),['unknown','on_hold','cancelled']);
});

test('planning colours never change lifecycle, confidence, filters or authored natural finishes',()=>{
  const a=createModelAppearance(THREE),meshes=['existing','under_construction','approved','proposed','unknown','mixed','on_hold','cancelled'].map(makeMesh);
  const originals=meshes.map(x=>x.material),facts=meshes.map(x=>structuredClone(x.userData));
  meshes.forEach(x=>a.register(x,{authored:true}));
  for(const scenario of ['existing','construction','future'])for(const unknownStatuses of [false,true]){
    applyModelVisibility(meshes,scenario,{unknownStatuses});const visibility=meshes.map(x=>x.visible);
    a.setMode('status');
    meshes.forEach((x,i)=>{
      assert.equal(x.material.color.getHex(),planningAppearanceColour(planningAppearanceKey(facts[i])));
      assert.deepEqual(x.userData,facts[i]);
    });
    assert.notEqual(meshes[2].material,meshes[3].material,'approved and proposed remain visually distinct');
    assert.deepEqual(meshes.map(x=>x.visible),visibility);
    a.setMode('natural');meshes.forEach((x,i)=>assert.equal(x.material,originals[i]));
  }
  assert.equal(projectStatus({lifecycle:'approved'}).label,'Approved planning');
  assert.equal(projectStatus({lifecycle:'proposed'}).label,'Proposed');
  assert.equal(projectStatus({lifecycle:'unknown'}).label,'Status unverified');
  const details=projectDetailsHTML({id:'test',name:'Test',lifecycle:'approved',modelCaveat:'Roof geometry remains approximate.'},{asset:{uncertainGeometry:true}});
  assert.match(details,/Approved planning/);assert.match(details,/Approximate model/);assert.match(details,/Roof geometry remains approximate/);
  a.dispose();
});

test('screen and saved-image legends use the same recorded-stage colours as their mesh materials',()=>{
  const a=createModelAppearance(THREE),meshes=['existing','under_construction','approved','proposed','unknown'].map(makeMesh);
  meshes.forEach(x=>a.register(x));a.setMode('status');
  const legend=planningStatusLegendFor(meshes.map(x=>x.userData.lifecycle),{appearance:a.mode});
  assert.deepEqual(legend.map(x=>x.key),['existing','under_construction','approved','proposed','unknown']);
  for(const item of legend){
    const shown=meshes.filter(x=>planningAppearanceKey(x.userData)===item.key);assert(shown.length);
    shown.forEach(x=>assert.equal('#'+x.material.color.getHexString(),item.color));
  }
  for(const width of [390,1400]){
    const labels=[],swatches=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(x,y,w,h){if(w===16)swatches.push(this.fillStyle);},fillText(text){labels.push(text);}};
    drawPresentationFooter(ctx,{width,top:0,title:'Downtown',scenario:'Future scenario',bearing:null,legend});
    assert.deepEqual(swatches,legend.map(x=>x.color));
    assert.deepEqual(labels.slice(-5),['Existing','Under construction','Approved planning','Proposed','Status unverified']);
  }
  a.setMode('natural');assert.deepEqual(planningStatusLegendFor(meshes.map(x=>x.userData.lifecycle),{appearance:a.mode}),[]);a.dispose();
});

test('the actual app shares its visible planning legend with export and does not merge data records',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const source=app.split('\n').find(line=>line.startsWith('function currentStatusLegend()'));
  const context={planningStatusLegendFor,appearance:{mode:'status'},modelMeshes:[{visible:true,userData:{lifecycle:'approved'}},{visible:true,userData:{lifecycle:'proposed'}},{visible:true,userData:{lifecycle:'unknown'}},{visible:false,userData:{lifecycle:'under_construction'}}]};
  runInNewContext(source,context);
  assert.deepEqual(context.currentStatusLegend().map(x=>x.key),['approved','proposed','unknown']);
  context.appearance.mode='natural';assert.deepEqual(context.currentStatusLegend(),[]);
  assert.match(app,/const legend=currentStatusLegend\(\),layout=presentationLayout/);
  assert.match(app,/drawPresentationFooter\(ctx,\{[^\n]*legend,/);
  assert.match(app,/'Appearance':appearance\.mode==='status'\?'Planning status':'Natural'/);
});
