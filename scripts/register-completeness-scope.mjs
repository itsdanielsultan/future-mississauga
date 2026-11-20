import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const registerCompletenessScope=JSON.parse(readFileSync(new URL('./register-completeness-scope.json',import.meta.url)));
export function restoreRegisterCompletion(text){
 const lines=text.split('\n'),indices=lines.flatMap((line,index)=>line.startsWith(registerCompletenessScope.projectId+',')?[index]:[]);
 if(!indices.length)return text;
 assert.equal(indices.length,1,'only one missing-project register row may be appended');
 const index=indices[0];
 assert.equal(index,lines.length-2,'the approved row is appended without reordering historical records');
 assert.equal(createHash('sha256').update(lines[index]).digest('hex'),registerCompletenessScope.appendedRowSHA256,'exact source-qualified Superior register fields');
 lines.splice(index,1);return lines.join('\n');
}
