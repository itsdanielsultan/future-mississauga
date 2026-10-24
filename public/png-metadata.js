// Text chunks preserve source acknowledgements without changing PNG image data.
export async function withPNGMetadata(blob, entries){
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
 if(bytes.length<20||view.getUint32(0)!==0x89504e47)throw new Error('Expected PNG');
 const encoder=new TextEncoder(),chunks=[];
 for(const [key,value] of Object.entries(entries)){
  if(!/^[A-Za-z][A-Za-z ]{0,78}$/.test(key))throw new Error('Invalid PNG text key');
  const data=encoder.encode(key+'\0\0\0\0\0'+value),chunk=new Uint8Array(data.length+12),cv=new DataView(chunk.buffer);
  cv.setUint32(0,data.length);chunk.set(encoder.encode('iTXt'),4);chunk.set(data,8);
  let crc=0xffffffff;for(let i=4;i<chunk.length-4;i++){crc^=chunk[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  cv.setUint32(chunk.length-4,(crc^0xffffffff)>>>0);chunks.push(chunk);
 }
 let offset=8;while(offset+12<=bytes.length){const length=view.getUint32(offset);if(offset+length+12>bytes.length)throw new Error('Invalid PNG chunk');if(view.getUint32(offset+4)===0x49454e44)return new Blob([bytes.slice(0,offset),...chunks,bytes.slice(offset)],{type:'image/png'});offset+=length+12;}
 throw new Error('Missing PNG end chunk');
}
