import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {serveMedia} from '../cloudflare/media-worker.mjs';
const schema = readFileSync(new URL('../cloudflare/suggestions.sql',import.meta.url),'utf8');
const origin = 'https://example.invalid';
const token = 'private-local-fixture-key-0123456789';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schema);
  const db = {prepare(sql){return {bind(...params){const statement = sqlite.prepare(sql); return {
    all:async () => ({results:statement.all(...params)}), run:async () => ({meta:statement.run(...params)}),
    first:async () => statement.get(...params)
  };}};}};
  const env = {SUGGESTIONS_DB:db,SUGGESTIONS_ADMIN_TOKEN:token,ASSETS:{fetch:() => new Response('static')}};
  const worker = serveMedia({});
  const fetch = (url = '',method = 'GET',data,extra = {},config = env) => worker.fetch(
    new Request(origin + '/api/suggestions' + url,{method,headers:{Origin:origin,
      'Content-Type':'application/json',...extra},body:data === undefined ? undefined : JSON.stringify(data)}),config);
  return {sqlite,env,fetch};
}
const mod = {Authorization:'Bearer '+token};
test('intake stays private through draft, approval without a reply, publication and withdrawal',async () => {
  const {fetch} = fixture();
  const original = 'Private fixture including personal details.';
  assert.equal((await fetch('','POST',{suggestion:original,approved:true,response:'injected',question:'also injected'})).status,201);
  assert.deepEqual((await (await fetch()).json()).items,[]);
  for (const headers of [{},{Authorization:'Bearer '+token+'X'},{'Cf-Access-Authenticated-User-Email':'pretend@example.invalid'}]) {
    assert.equal((await fetch('/admin','GET',undefined,headers)).status,401);
    assert.equal((await fetch('/admin/1','PUT',{approved:true,question:'test',response:'test'},headers)).status,401);
  }
  assert.equal((await (await fetch('/admin','GET',undefined,mod)).json()).items[0].original,original);
  for (const payload of [{approved:true,question:'Question',response:'  '},{approved:true,question:'',response:'Reply'},{question:'Q',response:'A'}]) {
    assert.equal((await fetch('/admin/1','PUT',payload,mod)).status,400);
  }
  const review = {question:'Which street is this?',response:'Here is the answer.'};
  assert.equal((await fetch('/admin/1','PUT',{approved:false,...review},mod)).status,200);
  assert.deepEqual((await (await fetch()).json()).items,[]);
  assert.equal((await fetch('/admin/1','PUT',{approved:true,...review},mod)).status,200);
  const data = await (await fetch()).json();
  assert.deepEqual(Object.keys(data.items[0]).sort(),['id','public_question','response','reviewed_at']);
  assert(!JSON.stringify(data).includes(original)); assert.equal(data.items[0].response,review.response);
  assert.equal((await fetch('/admin/1','PUT',{approved:false,...review},mod)).status,200);
  assert.deepEqual((await (await fetch()).json()).items,[]);
});
test('missing configuration, cross-origin writes, oversized bodies, invalid pages and unknown routes fail closed',async () => {
  const {fetch,env} = fixture();
  for (const config of [{},{...env,SUGGESTIONS_DB:null}]) {
    assert.equal((await fetch('','POST',{suggestion:'test'},{},config)).status,503);
    assert.equal((await fetch('/admin','GET',undefined,mod,config)).status,503);
  }
  const dashboardOnly = {...env,SUGGESTIONS_ADMIN_TOKEN:''};
  assert.equal((await fetch('','POST',{suggestion:'Private from the web form'},{},dashboardOnly)).status,201);
  assert.deepEqual((await (await fetch('','GET',undefined,{},dashboardOnly)).json()).items,[]);
  assert.equal((await fetch('/admin','GET',undefined,mod,dashboardOnly)).status,401);
  for (const [headers,status] of [[{Origin:'https://elsewhere.invalid'},403],[{'Content-Type':'text/plain'},415]]) {
    assert.equal((await fetch('','POST',{suggestion:'test'},headers)).status,status);
  }
  assert.equal((await fetch('','POST',{suggestion:'x'.repeat(18000)})).status,413);
  assert.equal((await fetch('','POST',{suggestion:'x'.repeat(1201)})).status,400);
  assert.equal((await fetch('/admin/999','PUT',{approved:false},mod)).status,404);
  assert.equal((await fetch('/other')).status,404);
  assert.equal((await fetch('?before=-1')).status,400);
  assert.equal((await fetch()).headers.get('Cache-Control'),'private, no-store');
});
test('daily storage admission is bounded and editorial pagination retains every row', async () => {
  const {fetch,sqlite} = fixture();
  const insert = sqlite.prepare('INSERT INTO suggestions (created_at,original) VALUES (?,?)');
  for (let i=0;i<249;i++) insert.run(new Date().toISOString(),'Synthetic question '+i);
  assert.equal((await fetch('','POST',{suggestion:'last'})).status,201);
  assert.equal((await fetch('','POST',{suggestion:'too many'})).status,429);
  const seen = new Set();
  let next = null;
  do {
    const result = await (await fetch('/admin'+(next ? '?before='+next : ''),'GET',undefined,mod)).json();
    result.items.forEach(item=>seen.add(item.id)); next=result.next;
  } while (next);
  assert.equal(seen.size,250);
});

test('retrying the same submission creates only one private entry',async () => {
  const {fetch,sqlite} = fixture();
  const data = {suggestion:'Synthetic retry',submissionKey:crypto.randomUUID()};
  for (let i=0;i<2;i++) assert.equal((await fetch('','POST',data)).status,201);
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM suggestions').get().total,1);
});

test('the private D1 key opens the website review inbox and stays out of every public response', async () => {
  const {sqlite,env,fetch} = fixture();
  const config = {...env,SUGGESTIONS_ADMIN_TOKEN:undefined};
  const key = sqlite.prepare('SELECT access_key FROM suggestion_moderator WHERE id=1').get().access_key;
  assert.match(key,/^[a-f0-9]{64}$/);
  sqlite.exec(schema);
  const contents = await fetch('','POST',{suggestion:'A private review example'},{},config);
  assert.equal(contents.status,201);
  const good = {Authorization:'Bearer '+key};
  assert.equal((await fetch('/admin','GET',undefined,{Authorization:'Bearer '+'0'.repeat(64)},config)).status,401);
  const inbox = await (await fetch('/admin','GET',undefined,good,config)).json();
  assert.equal(inbox.items[0].original,'A private review example');
  assert(!JSON.stringify(inbox).includes(key));
  assert.equal((await fetch('/admin/1','PUT',{approved:true,question:'A verified change?',response:'Updated.'},good,config)).status,200);
  const feed = await (await fetch('','GET',undefined,{},config)).json();
  assert.equal(feed.items[0].response,'Updated.');
  assert(!JSON.stringify(feed).includes(key));
  assert(!JSON.stringify(feed).includes('A private review example'));
});
