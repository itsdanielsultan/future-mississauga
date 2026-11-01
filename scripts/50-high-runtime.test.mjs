import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {register} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {assetURL} from '../public/asset-delivery.js';
const review=path.dirname(fileURLToPath(import.meta.url)),site=path.resolve(review,'..');
register(pathToFileURL(path.join(site,'scripts/recovery-three-loader.mjs')));
const {GLTFLoader}=await import(pathToFileURL(path.join(site,'public/vendor/addons/loaders/GLTFLoader.js')));
const {MeshoptDecoder}=await import(pathToFileURL(path.join(site,'public/vendor/meshopt_decoder.mjs')));
const {applyModelVisibility}=await import(pathToFileURL(path.join(site,'public/model-visibility.js')));
const {resolveModelLifecycle}=await import(pathToFileURL(path.join(site,'public/model-status-materials.js')));
const {projectDetailsHTML}=await import(pathToFileURL(path.join(site,'public/project-cards.js')));
const read=p=>readFile(path.join(site,p));
const assets=JSON.parse(await read('public/data/refinement-models.json')).assets,projects=JSON.parse(await read('public/data/projects.json'));
const a=assets.find(a=>a.id==='wf-50high-current-plan'),p=projects.find(p=>p.id===a.projectId);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const parse=async bytes=>{if(bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes);return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
const meshes=root=>{const out=[];root.traverse(n=>{if(n.isMesh)out.push(n)});return out;};
const dispose=root=>root.traverse(n=>{n.geometry?.dispose();for(const m of [n.material].flat().filter(Boolean))m.dispose()});
test('50 High loads with source normals intact and every PBR mesh finite',async()=>{
 const root=await parse(await read('public/'+a.url)),all=meshes(root);assert.equal(all.length,25);
 let flat=0,normal=0;
 for(const m of all){assert(m.material.isMeshStandardMaterial);assert([...m.geometry.attributes.position.array].every(Number.isFinite));if(m.geometry.attributes.normal){normal++;assert([...m.geometry.attributes.normal.array].every(Number.isFinite));}else {flat++;assert(m.material.flatShading);}}
 assert.equal(flat,13);assert.equal(normal,12);dispose(root);
});
test('50 High future detail hides only its source replacement; existing and failed-load baseline survive',async()=>{
 const source=await parse(await read('public/models/port-credit.glb')),detail=await parse(await read('public/'+a.url));
 const original=meshes(source).filter(m=>m.userData.id==='92-749');assert.equal(original.length,1);
 for(const m of original)Object.assign(m.userData,{lifecycle:'existing',sourceReplacements:[{assetId:a.id,modes:a.replacementModes}]});
 const detailed=meshes(detail);for(const m of detailed)Object.assign(m.userData,{assetId:a.id,lifecycle:resolveModelLifecycle({lifecycle:a.lifecycle},{},p),modes:a.modes,uncertain:true});
 assert(detailed.every(m=>m.userData.lifecycle==='approved'));
 for(const mode of ['existing','construction','future']){applyModelVisibility([...original,...detailed],mode,{unknownStatuses:false});assert(original.every(m=>m.visible===(mode!=='future')),mode+' baseline');assert(detailed.every(m=>m.visible===(mode==='future')),mode+' detail');}
 applyModelVisibility(original,'future',{unknownStatuses:false});assert(original.every(m=>m.visible));dispose(source);dispose(detail);
});
test('50 High panel credits Chamberlain and preserves approval and dated demolition qualifications',()=>{
 const html=projectDetailsHTML(p,{asset:a});assert.match(html,/Chamberlain Architect Services/);assert.match(html,/Approved/);assert.match(html,/site-plan.*permit.*pending/i);assert.match(html,/Demolition does not establish new-building construction/);assert.match(html,/December 2025/);assert.doesNotMatch(html,/arched facade frames.*omitted/);
 const notes=html.match(/<section aria-label="Model details">([\s\S]*?)<\/section>/)?.[1];assert(notes);
 assert.equal([...notes.matchAll(/<p>/g)].length,2);
 assert.match(notes,/facade frames and roof arches/);assert.match(notes,/Frame depths, glazing and finishes are approximate/);
 assert.match(notes,/future view.*planned building/);assert.match(notes,/dated City model.*older building.*extent of demolition is not mapped/);
 assert.doesNotMatch(notes,/Terrace relief|display artifact|new source level|Survey-registered|January 2028/);
 assert.match(p.modelCaveat,/Terrace relief/,'technical source metadata is retained');
 assert.match(p.completion.note,/January 2028/,'forecast qualification is retained in the source record');
 assert.match(html,/<dt>Target completion \/ occupancy<\/dt><dd>January 2028 · City programme forecast<\/dd>/);
 assert.equal(p.targetCompletionDate,'2028-01','the stored target date remains unchanged');
});

test('50 High accuracy notes match its concise model panel without changing its status or sources',async()=>{
 const html=await read('public/accuracy-review.html');
 const row=[...html.toString().matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(m=>m[0]).find(r=>r.includes('project=port-credit-50-high'));
 assert(row);assert.match(row,/<td>Approved<small>Zoning by-law passed; later approvals not confirmed/);assert.match(row,/15 linked sources/);
 const notes=row.match(/<details><summary>Model notes<\/summary>([\s\S]*?)<\/details>/)?.[1];assert(notes);
 const panel=projectDetailsHTML(p,{asset:a}).match(/<section aria-label="Model details"><h4>The model<\/h4>([\s\S]*?)<\/section>/)?.[1];
 assert.equal(notes,panel);
});

test('50 High uses its accepted versioned bytes without changing the old hosted identity',async()=>{
 const sha=b=>createHash('sha256').update(b).digest('hex');
 const encoded=await read('public/'+a.url),decoded=gunzipSync(encoded);
 assert.equal(a.url,'models/studies-20261101/50-high-exterior.glb.gz');
 assert.equal(sha(encoded),'19076afc33d61c6bd21d480ce58b133aa83b862feaee7351cfe46257c6042d7f');
 assert.equal(sha(decoded),'5f367841de44129bebba0dc20fffc2a7c6d4fe9a2688e641159289ee43de78cc');
 assert.equal(assetURL(a.url),a.url,'the new URL has no old CDN redirect');
 assert.equal(sha(await read('public/models/refinement/50-high-current-plan.glb')),'a29d2aaab4d41e70ea9a8e5c12b107748f472ef6e59c2da6a9269c29543e760e');
 assert.equal(sha(await read('public/asset-delivery-map.js')),'1bc2df98e8208de63b17c5b330217999cd82a500c5ce09fc002884f65719b1c4');
 const oldURL=assetURL('models/refinement/50-high-current-plan.glb');assert.match(oldURL,/a29d2aaab4d41e70ea9a8e5c12b107748f472ef6e59c2da6a9269c29543e760e/);
});
