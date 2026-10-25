import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingPolicy, createFrameScheduler} from '../public/viewer-runtime.js';

test('touch rendering remains bounded through Duo folding and browser-bar changes', () => {
  for (const [width, heights] of [[382,[580,618]],[594,[368,406]],[669,[867,902]],[951,[585,620]],[385,[571,609]]]) {
    for (const height of heights) {
      const policy = drawingPolicy({width,height,pixelRatio:3,coarse:true});
      assert.ok(width * height * policy.pixelRatio ** 2 <= 1_500_001);
      assert.ok(policy.pixelRatio <= 1.5);
      assert.equal(policy.shadowSize, 2048);
    }
  }
  assert.equal(drawingPolicy({width:1440,height:900,memory:4}).compact,true);
});

test('static, hidden and lost-context views stop frames and resume with pending changes', () => {
  const pending=new Map();let sequence=0,visible=true,draws=0,animating=false;
  const scheduler=createFrameScheduler({draw:()=>{draws++;return animating;},canDraw:()=>visible,
    request:fn=>{pending.set(++sequence,fn);return sequence;},cancel:id=>pending.delete(id)});
  const frame=()=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn(0);};
  scheduler.invalidate();scheduler.invalidate();assert.equal(pending.size,1);
  frame();assert.equal(draws,1);assert.equal(pending.size,0);
  animating=true;scheduler.invalidate();frame();assert.equal(pending.size,1);
  visible=false;scheduler.pause();assert.equal(pending.size,0);
  scheduler.invalidate();assert.equal(pending.size,0);
  visible=true;animating=false;scheduler.invalidate();frame();assert.equal(draws,3);assert.equal(pending.size,0);
});
