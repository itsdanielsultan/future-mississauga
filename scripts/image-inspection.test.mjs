import test from 'node:test';
import assert from 'node:assert/strict';
import {imageViewportGeometry} from '../public/image-viewport.js';
import {savedAppearance,prepareAppearancePreference,APPEARANCE_STORAGE_KEY} from '../public/appearance-preference.js';

test('fit keeps complete landscape and portrait images inside a phone viewport',()=>{
 for(const [width,height] of [[6144,2240],[3240,4050]]){
  const g=imageViewportGeometry(width,height,354,470,1,999,-999);
  assert(g.width<=354+.001);assert(g.height<=470+.001);assert.equal(g.x,0);assert.equal(g.y,0);
  assert(Math.abs(g.width/g.height-width/height)<.0001);
 }
});
test('full detail reaches native pixels and clamps pan at each image edge',()=>{
 const fit=imageViewportGeometry(6144,2240,354,470);
 const g=imageViewportGeometry(6144,2240,354,470,fit.maxScale,1e6,-1e6);
 assert.equal(g.pixelScale,1);assert.equal(g.x,(6144-354)/2);assert.equal(g.y,-(2240-470)/2);
 const reset=imageViewportGeometry(6144,2240,354,470,1,g.x,g.y);assert.equal(reset.x,0);assert.equal(reset.y,0);
});
test('Architectural starts by default and deliberate early choice survives engine initialization',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.equal(savedAppearance(storage),'natural');data.set(APPEARANCE_STORAGE_KEY,'unsupported');assert.equal(savedAppearance(storage),'natural');
 const listeners={},select={value:'status',dataset:{},addEventListener:(name,fn)=>listeners[name]=fn};
 assert.equal(prepareAppearancePreference(select,storage),'natural');
 select.value='status';listeners.change();assert.equal(data.get(APPEARANCE_STORAGE_KEY),'status');
 assert.equal(prepareAppearancePreference(select,storage),'status');
 assert.equal(savedAppearance({getItem(){throw new Error('unavailable')}}),'natural');
});
