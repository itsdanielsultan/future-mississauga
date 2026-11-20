import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url),'utf8');
function section(start,end) {return app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));}
test('camera-only frames reuse the directional shadow map, and changed scene, layers or light refresh it',()=>{
 const shadow = {needsUpdate:false};
 const state = {daylight:{sun:{shadow}}, scene:{}, camera:{}, visibleAttribution:{update:mode=>mode},
  lastLayerVisibilityKey:'',frameScheduler:{invalidate(){}}, updates:0};
 state.applyVisibility=mode=>{state.lastLayerVisibilityKey=mode;};
 state.renderer={render(){if(shadow.needsUpdate){state.updates++;shadow.needsUpdate=false;}}};
 vm.createContext(state);
 vm.runInContext(section('let shadowSceneDirty','const scene=') + section('function renderScenario','function render(){'),state);
 state.renderScenario('existing');assert.equal(state.updates,1);
 for(let i=0;i<12;i++){state.invalidateCamera();state.renderScenario('existing');}
 assert.equal(state.updates,1);
 state.invalidate();state.renderScenario('existing');assert.equal(state.updates,2);
 shadow.needsUpdate=true;state.renderScenario('existing');assert.equal(state.updates,3);
 state.renderScenario('future');state.renderScenario('existing');assert.equal(state.updates,5);
 assert.match(app,/daylight\.sun\.shadow\.autoUpdate = false/);
 assert.match(app,/controls\.addEventListener\('change',invalidateCamera\)/);
});
test('primary and secondary mouse buttons have opposite actions in both modes, and touch gets a complementary gesture',()=>{
 const buttons=['orbit','pan'].map(mode=>({dataset:{navigation:mode},setAttribute(k,v){this[k]=v;}}));
 const hint={},canvas={focus(){}},controls={mouseButtons:{},touches:{}};
 const state={document:{querySelectorAll:()=>buttons},THREE:{MOUSE:{ROTATE:1,PAN:2},TOUCH:{ROTATE:3,PAN:4,DOLLY_PAN:5,DOLLY_ROTATE:6}},controls,canvas,coarsePointer:{matches:true},$:()=>hint};
 vm.createContext(state);
 vm.runInContext(section('const navigationButtons', "$('#northReset')"),state);
 assert.deepEqual(controls.mouseButtons,{LEFT:2,RIGHT:1});assert.deepEqual(controls.touches,{ONE:4,TWO:6});
 assert.equal(buttons[1]['aria-pressed'],'true');assert.match(canvas.title,/One finger to move/);
 buttons[0].onclick();assert.deepEqual(controls.mouseButtons,{LEFT:1,RIGHT:2});assert.deepEqual(controls.touches,{ONE:3,TWO:5});
 assert.equal(buttons[0]['aria-pressed'],'true');assert.match(canvas.title,/One finger to rotate/);
});
