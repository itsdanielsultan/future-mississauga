import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareImageLinks} from '../public/file-actions.js';

function fixture(caption){
 const attributes=new Map(),classes=new Set(),dataset={};let markup='';
 const anchor={href:'https://futuremississauga.com/gallery/downtown.png',download:'',textContent:'Download PNG ↓',dataset,
  matches:()=>false,querySelector:()=>null,
  closest:selector=>selector==='figure'&&caption?{querySelector:()=>({textContent:caption})}:null,
  hasAttribute:name=>name==='data-file-action'?Object.hasOwn(dataset,'fileAction'):attributes.has(name),
  setAttribute:(name,value)=>attributes.set(name,value),classList:{add:value=>classes.add(value)},
  get innerHTML(){return markup;},set innerHTML(value){markup=value;this.textContent='';}};
 return {anchor,attributes,classes,root:{querySelectorAll:()=>[anchor]}};
}

test('hero download label uses its figure title and remains stable after repeated enhancement',()=>{
 globalThis.location={href:'https://futuremississauga.com/',origin:'https://futuremississauga.com'};
 const {anchor,attributes,root}=fixture('Downtown');
 const originalURL=anchor.href;prepareImageLinks(root);
 assert.equal(attributes.get('aria-label'),'Download Downtown PNG');assert.equal(anchor.title,'Download Downtown PNG');
 assert.equal(anchor.href,originalURL);assert.equal(anchor.download,'');assert.equal(anchor.dataset.download,'');
 const icon=anchor.innerHTML;prepareImageLinks(root);
 assert.equal(attributes.get('aria-label'),'Download Downtown PNG');assert.equal(anchor.innerHTML,icon);assert.equal(anchor.href,originalURL);
});

test('a download without a figure caption does not duplicate the action or format',()=>{
 globalThis.location={href:'https://futuremississauga.com/',origin:'https://futuremississauga.com'};
 const {anchor,attributes,root}=fixture();prepareImageLinks(root);
 assert.equal(attributes.get('aria-label'),'Download PNG');assert.equal(anchor.title,'Download PNG');
});

test('a picture download keeps its own title inside a broad updates section',()=>{
 globalThis.location={href:'https://futuremississauga.com/updates.html',origin:'https://futuremississauga.com'};
 const {anchor,attributes,root}=fixture('1225 Dundas Street East');
 const originalClosest=anchor.closest;
 anchor.closest=selector=>selector==='section,article'?{querySelector:()=>({textContent:'A simpler way to browse.'})}:originalClosest(selector);
 prepareImageLinks(root);
 assert.equal(attributes.get('aria-label'),'Download 1225 Dundas Street East PNG');
 const second=fixture('A longer descriptive caption');
 second.anchor.dataset.previewTitle='1225 Dundas Street East';
 prepareImageLinks(second.root);
 assert.equal(second.attributes.get('aria-label'),'Download 1225 Dundas Street East PNG');
});
