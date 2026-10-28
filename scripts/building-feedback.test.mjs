import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildingFeedbackURL,feedbackViewURL,buildingFeedbackHTML,bindBuildingFeedback} from '../public/building-feedback.js';
import {projectDetailsHTML} from '../public/project-cards.js';

test('feedback encodes building names and opens a draft for the one public address',()=>{
  const name='St Hilary’s & 41 Bay / “West” + #2';
  const mail=new URL(buildingFeedbackURL({name,project:'merner-41-bay',viewURL:'https://futuremississauga.com/explore.html?district=port-credit',scenario:'future'}));
  assert.equal(mail.protocol,'mailto:');
  assert.equal(mail.pathname,'daniel@futuremississauga.com');
  assert.deepEqual([...mail.searchParams.keys()],['subject','body']);
  assert.equal(mail.searchParams.get('subject'),`Model correction: ${name}`);
  assert.match(mail.searchParams.get('body'),/Scenario: Future scenario/);
  assert.ok(mail.searchParams.get('body').includes(`Building: ${name}`));
  assert.ok(mail.searchParams.get('body').includes('project=merner-41-bay'));
  const injected=new URL(buildingFeedbackURL({name:'Building\r\nBcc: person@example.com&bcc=other@example.com'}));
  assert.deepEqual([...injected.searchParams.keys()],['subject','body']);
  assert.doesNotMatch(injected.searchParams.get('subject'),/[\r\n]/);
});

test('view links retain only relevant view state and never forward unrelated URL data',()=>{
  const url=new URL(feedbackViewURL({viewURL:'http://127.0.0.1:4187/explore.html?district=heartland&project=old&model=sgm-maritz-6710&token=secret&email=private@example.com&redirect=https%3A%2F%2Fother.example#private-secret',project:'sgm-maritz-6710',scenario:'comparison'}));
  assert.equal(url.origin,'https://futuremississauga.com');
  assert.equal(url.pathname,'/explore.html');
  assert.deepEqual(Object.fromEntries(url.searchParams),{district:'heartland',project:'sgm-maritz-6710',model:'sgm-maritz-6710',scenario:'comparison'});
  assert.equal(url.hash,'');
  for(const input of ['https://private.example/explore.html?project=secret','javascript:alert(1)','https://futuremississauga.com/private/secret?model=private']){
    assert.equal(feedbackViewURL({viewURL:input}), 'https://futuremississauga.com/explore.html');
  }
  const invalid=new URL(feedbackViewURL({viewURL:'https://futuremississauga.com/model.html?model=avia-1&scenario=secret&project=hello%0Aworld'}));
  assert.deepEqual(Object.fromEntries(invalid.searchParams),{model:'avia-1'});
});

test('dynamic card activation reads the current scenario and leaves email opening to the browser',()=>{
  const handlers=new Map();
  const link={dataset:{buildingName:'6710 Maritz Drive',buildingProject:'sgm-maritz-6710'},href:''};
  const root={contains:value=>value===link,addEventListener:(type,handler)=>handlers.set(type,handler),removeEventListener:type=>handlers.delete(type)};
  let scenario='existing';
  const unbind=bindBuildingFeedback(root,()=>({viewURL:'https://futuremississauga.com/explore.html',district:'heartland',scenario}));
  const event={target:{closest:()=>link},preventDefault:()=>assert.fail('Feedback must not intercept the mail application')};
  handlers.get('click')(event);
  assert.match(new URL(link.href).searchParams.get('body'),/Scenario: Existing city/);
  scenario='construction';handlers.get('click')(event);
  assert.match(new URL(link.href).searchParams.get('body'),/Scenario: Dated construction/);
  unbind();assert.equal(handlers.size,0);
});

test('every research building receives its own escaped correction link without invented revision dates',()=>{
  const projects=JSON.parse(fs.readFileSync(new URL('../public/data/projects.json',import.meta.url)));
  for(const project of projects){
    const html=projectDetailsHTML(project);
    assert.equal((html.match(/data-building-feedback/g)||[]).length,1,project.id);
    assert.doesNotMatch(html,/aria-label="Model revision"/,project.id);
  }
  const html=buildingFeedbackHTML({id:'test',name:'<img src=x onerror=alert(1)> & "Test"'});
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/&lt;img/);
});
