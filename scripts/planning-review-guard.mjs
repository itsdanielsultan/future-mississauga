import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const manifestURL = new URL('./editions/20261121/planning-review-scope.json', import.meta.url);
const base = 'fd99a98675e28662c6a274780af017f5f1eedd49';
const historicalFiles = new Map();
const verifiedFiles = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
const sorted = value => Array.isArray(value) ? value.map(sorted) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const valueHash = value => hash(JSON.stringify(sorted(value)));

function csvCells(line) {
  const cells = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (line[i] === ',' && !quoted) {
      cells.push(field); field = '';
    } else field += line[i];
  }
  assert.equal(quoted, false, 'CSV row ends inside a quoted field');
  return [...cells,field];
}

// Keep raw row text alongside its fields. Dated checks must retain the original
// bytes, including CSV quoting, line endings and the JSON Unicode spelling.
export function planningRows(file, text) {
  const rows = new Map();
  function add(key, fields, raw) {
    assert(key && !rows.has(key), file+' duplicate or missing ID '+key);
    rows.set(key, {fields,raw});
  }
  if (file.endsWith('.csv')) {
    const [header,...lines] = text.trimEnd().split(/\r?\n/);
    const keys = csvCells(header);
    for (const raw of lines) {
      const values = csvCells(raw);
      assert.equal(values.length, keys.length, file+' CSV width');
      add(values[0], Object.fromEntries(keys.map((k,i)=>[k,values[i]])),raw);
    }
  } else if (file.endsWith('.html')) {
    for (const [raw] of text.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)) {
      const id = /(?:\?|&(?:amp;)?)project=([^"&]+)/.exec(raw)?.[1];
      if (!id) continue;
      const cells = [...raw.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/g)].map(m=>m[0]);
      const status = /\bdata-status="([^"]*)"/.exec(raw)?.[1];
      const structure = raw.replace(/\bdata-status="[^"]*"/,'data-status=""').replace(/<td\b[^>]*>[\s\S]*?<\/td>/g,'<td/>');
      add(id,{structure,status,...Object.fromEntries(cells.map((cell,i)=>['column'+i,cell]))},raw);
    }
  } else if (file.endsWith('projects.json')) {
    const complete = JSON.parse(text);
    for (const [raw] of text.matchAll(/^  \{\n[\s\S]*?^  \}/gm)) {
      const record = JSON.parse(raw);
      add(record.id,record,raw);
    }
    assert.deepEqual([...rows.keys()],complete.map(x=>x.id),file+' row boundaries');
  } else {
    const complete = JSON.parse(text);
    for (const [,id,raw] of text.matchAll(/^  "([^"]+)": (\{\n[\s\S]*?^  \})/gm)) add(id, JSON.parse(raw),raw);
    assert.deepEqual([...rows.keys()],Object.keys(complete),file+' row boundaries');
  }
  return rows;
}

export function reviewFingerprints(rows, changed) {
  const approved = [], protectedRows = [];
  for (const [id,{fields}] of rows) {
    const keys = changed[id] || [];
    if (keys.length) approved.push([id,keys.map(key => [key, Object.hasOwn(fields,key),fields[key] ?? null])]);
    protectedRows.push([id,Object.fromEntries(Object.entries(fields).filter(([key]) => !keys.includes(key)))]);
  }
  for (const id of Object.keys(changed)) assert(rows.has(id),'Missing reviewed record '+id);
  return {reviewedSHA256:valueHash(approved),protectedSHA256:valueHash(protectedRows)};
}

const scope = () => JSON.parse(readFileSync(manifestURL));
function validateRows(file, rows, spec) {
  const proof = reviewFingerprints(rows,spec.fields);
  assert.equal(proof.reviewedSHA256,spec.reviewedSHA256,file+' exact November 21 reviewed values');
  assert.equal(proof.protectedSHA256,spec.protectedSHA256,file+' protected fields, IDs and row order');
}
export function validatePlanningReview(site) {
  const manifest = scope();
  for (const [file,spec] of Object.entries(manifest)) {
    const bytes = readFileSync(join(site,file),'utf8');
    validateRows(file,planningRows(file,bytes),spec);
  }
  return Object.keys(manifest).length;
}

export function beforePlanningReview(file, text) {
  const spec = scope()[file];
  if (!spec) return text;
  const key = file+' '+hash(text);
  if (verifiedFiles.has(key)) return verifiedFiles.get(key);
  if (!historicalFiles.has(file)) {
    const bytes = execFileSync('git',['show',base+':public/'+file],{cwd:repository,maxBuffer:32*1024*1024,encoding:'utf8'});
    assert.equal(hash(bytes),spec.priorFileSHA256,file+' dated byte pin');
    historicalFiles.set(file,bytes);
  }
  const baseline = historicalFiles.get(file);
  const rows = planningRows(file,text);
  validateRows(file,rows,spec);
  const prior = planningRows(file,baseline);
  const oldProof = reviewFingerprints(prior,spec.fields);
  assert.equal(oldProof.protectedSHA256,spec.protectedSHA256,file+' unreviewed fields match the dated source');
  for (const id of Object.keys(spec.fields)) {
    const from = rows.get(id).raw, to = prior.get(id).raw;
    assert.equal(text.indexOf(from),text.lastIndexOf(from),file+' unique patch '+id);
    text = text.replace(from,()=>to);
  }
  // HTML presentation outside the table may change in a redesign.
  if (!file.endsWith('.html')) assert.equal(hash(text),spec.priorFileSHA256,file+' only reviewed rows changed');
  verifiedFiles.set(key,text);
  return text;
}

// Historical suites use this at their public-file boundary. Other file types
// and dated supporting artefacts are always independently read from disk.
export function readBeforePlanningReview(url, encoding) {
  const pathname = fileURLToPath(url);
  const file = pathname.split('/public/').at(-1);
  const data = readFileSync(url);
  if (!Object.hasOwn(scope(),file)) return encoding ? data.toString(encoding) : data;
  const restored = beforePlanningReview(file,data.toString('utf8'));
  return encoding ? restored : Buffer.from(restored);
}
