import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export const PUBLIC_STANDALONE_ADDITIONS=JSON.parse(readFileSync(new URL('./public-standalone-additions.json',import.meta.url)));
// Historical geometry guards may remove only these exact presentation bindings.
// The already-public model assets and their city registration remain untouched.
export function restorePublicStandaloneAdditions(data){
 for(const kind of ['assets','views'])for(const approved of PUBLIC_STANDALONE_ADDITIONS[kind]){
  const row=data[kind].find(row=>row.id===approved.id);
  if(row){assert.deepEqual(row,approved,approved.id+' accepted standalone binding');data[kind]=data[kind].filter(row=>row.id!==approved.id);}
 }
 return data;
}
