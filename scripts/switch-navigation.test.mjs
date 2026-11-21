import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/site-ui.js',import.meta.url),'utf8')
  .replace(/^import .*?;\n/, '');
const path = address => new URL(address,'https://example.com/');

function visit(address, index, storage, reducedMotion = false) {
  const callbacks = [], animation = [], location = path(address);
  const groupBounds = {left:10,top:8,width:325,height:48};
  const items = [0,1,2].map(i => ({
    getBoundingClientRect:() => ({left:10+i*100,top:8,width:100+i*5,height:44})
  }));
  const marker = {
    style:{},isConnected:true, setAttribute(){},getAnimations:()=>[],
    animate(frames,timing) { animation.push({frames,timing}); }
  };
  const group = {
    classList:{contains:()=>false},clientLeft:0,clientTop:0,scrollTop:0,scrollLeft:0,
    querySelector:()=>items[index], querySelectorAll:()=>items,
    getBoundingClientRect:()=>groupBounds, append(){},setAttribute(){},hasAttribute(){return false;},
    getAttribute(name){if(name==='aria-label')return 'Main navigation';},addEventListener(){}
  };
  const document = {
    baseURI:location.href, querySelector:()=>null,querySelectorAll:()=>[group],createElement:()=>marker,
    addEventListener(name,callback,opts){if(name==='click' && opts?.capture) callbacks.push(callback);}
  };
  class Observer { observe(){} }
  vm.runInNewContext(script,{URL,URLSearchParams,location,document,
    window:{matchMedia:()=>({matches:reducedMotion}),addEventListener(){}},
    sessionStorage:storage,MutationObserver:Observer,ResizeObserver:Observer
  });
  function click(dest, props={}, attrs={}) {
    const link={href:new URL(dest,location).href,target:attrs.target||'',hasAttribute:key=>Object.hasOwn(attrs,key)};
    for(const callback of callbacks) callback({button:0,target:{closest:()=>link},...props});
  }
  return {animation,marker,click};
}

function storage() {
  const data=new Map();
  return {getItem:k=>data.get(k)||null, setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};
}

test('a contextual link outside the menu animates the header from the actual previous section',()=>{
  const session=storage(), compare=visit('compare.html',2,session);
  assert.deepEqual(compare.animation,[]);
  compare.click('place-clarkson.html');
  const area=visit('place-clarkson.html',0,session);
  assert.equal(area.animation.length,1);
  const [{frames,timing}]=area.animation;
  assert.deepEqual(Object.keys(frames[0]),['transform']);
  assert.match(frames[0].transform,/translate3d\(200px,0px,0\) scale\(1.1,1\)/);
  assert.equal(frames[1].transform,'translate3d(0px,0px,0)');
  assert.equal(timing.duration,240);
  assert.equal(session.data.size,0);
});

test('reduced motion draws the correct active rectangle immediately',()=>{
  const session=storage();
  visit('compare.html',2,session).click('place-clarkson.html');
  const result=visit('place-clarkson.html',0,session,true);
  assert.equal(result.animation.length,0);
  assert.equal(result.marker.style.transform,'translate3d(0px,0px,0)');
});

test('external links, downloads, other tabs, modifiers and same-page anchors do not affect the next visit',()=>{
  const session=storage(), page=visit('compare.html',2,session);
  page.click('https://elsewhere.test/');
  page.click('compare.html#main');
  page.click('a.pdf',{}, {download:''});
  page.click('film.html',{}, {target:'_blank'});
  for(const modifier of ['metaKey','ctrlKey','altKey','shiftKey'])page.click('film.html',{[modifier]:true});
  page.click('film.html',{button:1});
  assert.equal(session.data.size,0);
});
