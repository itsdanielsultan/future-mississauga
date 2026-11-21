import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const publicRoot=new URL('../public/',import.meta.url);
const html=fs.readFileSync(new URL('reference-updates.html',publicRoot),'utf8');
const notes=fs.readFileSync(new URL('study-notes.html',publicRoot),'utf8');
const records=JSON.parse(fs.readFileSync(new URL('data/revision-panels-20261121.json',publicRoot))).panels;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('each previously published revision panel has a real source render, signed print and dated archive link',()=>{
 assert.equal(records.length,62);
 assert.equal(new Set(records.map(record=>record.archive)).size,62);
 assert.equal(new Set(records.map(record=>record.renderSHA256)).size,62);
 assert.equal(new Set(records.map(record=>record.project)).size,23);
 for(const row of records){
   assert(row.sourceHashes.length>0,row.project);
   assert(row.renderSize[0]>=2200,row.project);
   assert.deepEqual([row.display.width,row.display.height],[row.download.width,row.download.height]);
   assert.equal(row.display.width,row.renderSize[0]);
   assert(row.display.height>row.renderSize[1],'credited footer has its own space');
   assert(notes.includes('href="'+row.archive+'"'),row.archive);
   for(const file of [row.download,row.display,row.thumbnail]){
     assert(file.url.startsWith('gallery/edition-20261121/revision-panels/'));
     const bytes=fs.readFileSync(new URL(file.url,publicRoot));
     assert.equal(hash(bytes),file.sha256,file.url);
     assert(html.includes(file.url),file.url);
   }
 }
 assert.equal((html.match(/data-revision-panel=/g)||[]).length,62);
});
