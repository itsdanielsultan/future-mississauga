import fs from 'node:fs';
import {MeshoptDecoder} from '../../../../public/vendor/meshopt_decoder.mjs';
await MeshoptDecoder.ready;
const [input,output]=process.argv.slice(2), source=fs.readFileSync(input), size=source.readUInt32LE(12);
const doc=JSON.parse(source.subarray(20,20+size).toString()), bytes=source.subarray(28+size);
const parts=[];let offset=0;
for (const view of doc.bufferViews){
  const ex=view.extensions?.EXT_meshopt_compression;
  let data;
  if(ex){
    data=Buffer.alloc(view.byteLength);
    MeshoptDecoder.decodeGltfBuffer(data,ex.count,ex.byteStride,bytes.subarray(ex.byteOffset??0,(ex.byteOffset??0)+ex.byteLength),ex.mode,ex.filter??'NONE');
    delete view.extensions.EXT_meshopt_compression;
    if(!Object.keys(view.extensions).length)delete view.extensions;
  }else{
    if(view.buffer!==0)throw Error('Unknown input buffer');
    data=bytes.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  }
  view.buffer=0;view.byteOffset=offset;parts.push(data);offset+=data.length;
  const padding=(4-offset%4)%4;if(padding){parts.push(Buffer.alloc(padding));offset+=padding}
}
for (const field of ['extensionsRequired','extensionsUsed'])if(doc[field])doc[field]=doc[field].filter(v=>v!=='EXT_meshopt_compression');
doc.buffers=[{byteLength:offset}];
const json=Buffer.from(JSON.stringify(doc)),text=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),header=Buffer.alloc(20),bin=Buffer.alloc(8);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+offset,8);header.writeUInt32LE(text.length,12);header.write('JSON',16);bin.writeUInt32LE(offset,0);bin.write('BIN\0',4);
fs.writeFileSync(output,Buffer.concat([header,text,bin,...parts]));
