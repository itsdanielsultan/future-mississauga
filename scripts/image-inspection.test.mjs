import test from 'node:test';
import assert from 'node:assert/strict';
import {imageViewportGeometry,bindImageViewport} from '../public/image-viewport.js';
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

test('trackpad swipes advance once per gesture and move the image when zoomed in',()=>{
 const handlers={},stage={clientWidth:600,clientHeight:500,classList:{toggle(){}},setAttribute(){},
  getBoundingClientRect:()=>({width:600,height:500,left:0,top:0}),addEventListener:(key,fn)=>{handlers[key]=fn;}};
 const control=()=>({setAttribute(){},addEventListener(){}}),image={style:{}},navigation=[];
 const viewport=bindImageViewport({stage,image,zoomIn:control(),zoomOut:control(),fitButton:control(),readout:{},onNavigate:step=>navigation.push(step)});
 viewport.setImage({width:1800,height:1400});
 const wheel=(timeStamp,deltaX,deltaY,ctrlKey=false)=>handlers.wheel({timeStamp,deltaX,deltaY,deltaMode:0,ctrlKey,clientX:300,clientY:250,preventDefault(){}});
 wheel(0,20,1);wheel(16,32,1);viewport.setImage({width:1800,height:1400});wheel(40,118,2);
 assert.deepEqual(navigation,[1]);
 wheel(350,-90,2);assert.deepEqual(navigation,[1,-1]);
 wheel(600,0,-120,true);
 wheel(930,90,4);
 assert.deepEqual(navigation,[1,-1]);assert.match(image.style.transform,/translate\(-90px/);
});
