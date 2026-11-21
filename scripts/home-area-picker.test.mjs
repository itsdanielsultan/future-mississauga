import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/home-routes.js',import.meta.url),'utf8');

function pickerHarness(){
  function node(){
    const listeners=new Map();
    return {style:{},attributes:{},listeners,
      addEventListener(type,callback){listeners.set(type,callback);},
      dispatchEvent(event){listeners.get(event.type)?.(event);},
      setAttribute(key,value){this.attributes[key]=value;},
      append(){},before(){},
      showPopover(){this.visible=true;},hidePopover(){this.visible=false;},matches(){return this.visible;},
      focus(options){this.lastFocus=options;},
      getBoundingClientRect(){return {top:650,bottom:694,left:120,width:240};}
    };
  }
  const label=node(),form={querySelector:()=>label},picker=node(),created={};
  picker.id='homeDistrict';picker.classList=new Set(['ui-select']);
  picker.classList.remove=picker.classList.delete.bind(picker.classList);
  picker.value='port-credit';
  const window={visualViewport:{offsetTop:0,height:720},addEventListener(){}};
  const document={createElement(name){return created[name]=node();}};
  const context={URL,location:{href:'https://futuremississauga.com/'},HTMLElement:{prototype:{showPopover(){}}},window,document,form,picker,Event};
  vm.runInNewContext(source+';createAreaMenu(form,picker)',context);
  return {picker,button:created.button,list:created.div};
}

test('an explicitly clicked area commits before the list closes, including when native selection is still pending',()=>{
  const {picker,button,list}=pickerHarness();
  let observed;
  picker.addEventListener('change',()=>{observed={value:picker.value,open:list.visible};});
  button.dispatchEvent({type:'click'});
  assert.equal(picker.size,8);
  assert.equal(picker.classList.has('ui-select'),false);
  assert.equal(list.visible,true);
  assert.equal(picker.lastFocus.preventScroll,true);
  assert(parseFloat(list.style.top)<650,'near the viewport bottom, the options open above the button');
  const option={value:'fairview',closest(selector){return selector==='option'?this:null;}};
  picker.dispatchEvent({type:'click',target:option});
  assert.deepEqual(observed,{value:'fairview',open:true});
  assert.equal(list.visible,false);
  assert.equal(button.lastFocus.preventScroll,true);
});
