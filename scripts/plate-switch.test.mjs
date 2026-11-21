import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPlateSwitchDrag} from '../public/plate-switch-drag.js';
import {syncComparisonLinks} from '../public/skyline-scenarios.js';

function setup() {
  const frames = [0, 80, 200].map((x, i) => ({x,y:4,width:[80,120,80][i],height:44}));
  let selected = 0, focus = 0, capture, draws = 0;
  const moved = [], commits = [], events = new Map();
  const choices = frames.map((_, i) => ({
    closest:() => choices[i],
    click() { selected = i; commits.push(i); },
    focus(opts) { assert.equal(opts.preventScroll,true); focus = i; }
  }));
  const group = {
    querySelectorAll:() => choices,
    addEventListener:(name, fn) => events.set(name,fn),
    setAttribute() {}, removeAttribute() {},
    setPointerCapture(id) { capture = id; }, hasPointerCapture:id => id === capture,
    releasePointerCapture() { capture = null; },
    getBoundingClientRect:() => ({left:0,right:280,top:0,bottom:52})
  };
  bindPlateSwitchDrag(group, {
    current:() => choices[selected], measure:button => frames[choices.indexOf(button)],
    move:box => moved.push(box), draw:() => ++draws
  });
  function event(name, properties = {}, choice = 0) {
    const e = {target:choices[choice], pointerId:1, button:0, clientX:40, clientY:20,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...properties};
    events.get(name)(e);
    return e;
  }
  return {moved, commits, event, state:() => ({selected, focus, capture, draws})};
}

test('drag follows the pointer between unequal-width labels and commits once on release', () => {
  const {event, moved, commits, state} = setup();
  event('pointerdown');
  event('pointermove',{clientX:90});
  assert.deepEqual(moved.at(-1),{x:40,y:4,width:100,height:44});
  event('pointermove',{clientX:235});
  assert.equal(state().capture,1);
  assert.deepEqual(commits,[]);
  event('pointerup',{clientX:235});
  assert.deepEqual(state(),{focus:2, selected:2, capture:null, draws:1});
  assert.equal(event('click',{detail:1},2).stopped,true);
  assert.deepEqual(commits,[2]);
});

test('vertical touch, modified presses, secondary buttons and ordinary taps are left alone', () => {
  for (const properties of [{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{button:1},{isPrimary:false}]) {
    const {event,moved} = setup();
    event('pointerdown',properties);
    event('pointermove',{clientX:140});
    assert.equal(moved.length,0);
  }
  const {event,moved,commits} = setup();
  event('pointerdown');
  event('pointermove',{clientX:43,clientY:33});
  event('pointermove',{clientX:200});
  event('pointerup',{clientX:200});
  assert.equal(moved.length,0);
  event('pointerdown');
  event('pointerup');
  assert.equal(event('click',{detail:1}).prevented,undefined);
  assert.deepEqual(commits,[]);
});

test('cancel, Escape, and releasing outside return to the selected scenario', () => {
  for (const [name, details] of [['pointercancel',{}],['keydown',{key:'Escape'}],['pointerup',{clientX:350}]]) {
    const {event,state} = setup();
    event('pointerdown');
    event('pointermove',{clientX:140});
    event(name,details);
    assert.deepEqual(state(),{focus:0, selected:0, capture:null, draws:1});
  }
});

test('arrow, Home and End keys change the stage, and modified or native keys pass through', () => {
  const {event,state,commits} = setup();
  for (const [key, start] of [['ArrowRight',0],['End',1],['Home',2],['ArrowLeft',0]]) event('keydown',{key},start);
  assert.deepEqual(commits,[1,2,0,2]);
  assert.equal(state().focus,2);
  for (const key of ['Tab',' ','Enter']) assert.equal(event('keydown',{key},2).prevented,undefined);
  assert.equal(event('keydown',{key:'Home',metaKey:true},2).prevented,undefined);
});

test('archived scenario selections carry through the film and clear when the clean compare URL is restored', () => {
  const root = {baseURI:'https://example.com/compare.html', querySelectorAll:() => links};
  const links = ['pair','film','stages'].map(mode => ({dataset:{compareMode:mode},
    href:new URL(mode === 'film' ? 'film.html' : 'compare.html' + (mode === 'stages' ? '?mode=stages' : ''),root.baseURI).href}));
  syncComparisonLinks(root,new URL('compare.html?area=clarkson&split=74&scenario=construction',root.baseURI));
  assert.equal(new URL(links[1].href).searchParams.get('t'),'4');
  assert.equal(new URL(links[2].href).searchParams.get('scenario'),'construction');
  for (const link of links) assert.equal(new URL(link.href).searchParams.get('area'),'clarkson');
  syncComparisonLinks(root,new URL(root.baseURI));
  for (const link of links) for (const key of ['t','area','split','scenario','stage']) {
    assert.equal(new URL(link.href).searchParams.has(key),false);
  }
});

test('old skyline and file-edition bookmarks resolve to the selected homepage stage without reopening a hidden tab', async () => {
  const {legacyStageHome,requestedStage} = await import('../public/skyline-route.js');
  const root = 'https://example.com/compare.html';
  for (const [suffix, selected] of [
    ['?mode=stages&scenario=existing','existing'], ['#skyline','future'],
    ['?scenario=unknown','future'], ['#?scenario=construction','construction'],
    ['?mode=stages&stage=future','future']
  ]) {
    const landing=legacyStageHome(new URL(root+suffix));
    assert.equal(landing.pathname,'/index.html');
    assert.equal(landing.hash,'#skyline');
    assert.equal(requestedStage(landing),selected);
  }
  const old=legacyStageHome(new URL('file:///local/compare.html#?scenario=existing&area=clarkson&split=74#skyline'));
  assert.equal(old.href,'file:///local/index.html?scenario=existing&area=clarkson&split=74#skyline');
  const direct = new URL(root+'?area=clarkson&split=74&stage=construction');
  assert.equal(legacyStageHome(direct),null);
  assert.equal(requestedStage(direct),'construction');
});
