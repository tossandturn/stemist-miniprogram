// Lossless PNG compression only: IDAT inflates to exactly the same filtered pixels.
import fs from 'node:fs'
import zlib from 'node:zlib'
import assert from 'node:assert/strict'
const file=new URL('../design-system/share-card.png',import.meta.url),original=fs.readFileSync(file),chunks=[]
assert.equal(original.subarray(1,4).toString(),'PNG')
for(let offset=8;offset<original.length;){const length=original.readUInt32BE(offset);chunks.push({type:original.toString('ascii',offset+4,offset+8),bytes:original.subarray(offset,offset+length+12),data:original.subarray(offset+8,offset+8+length)});offset+=length+12}
const raw=zlib.inflateSync(Buffer.concat(chunks.filter(c=>c.type==='IDAT').map(c=>c.data)))
const compressed=[0,1,2,3,4].map(strategy=>zlib.deflateSync(raw,{level:9,strategy})).sort((a,b)=>a.length-b.length)[0]
assert.ok(zlib.inflateSync(compressed).equals(raw))
const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0)}return (value^0xffffffff)>>>0}
const idat=Buffer.alloc(compressed.length+12);idat.writeUInt32BE(compressed.length);idat.write('IDAT',4);compressed.copy(idat,8);idat.writeUInt32BE(crc(idat.subarray(4,-4)),idat.length-4)
let inserted=false
const next=Buffer.concat([original.subarray(0,8),...chunks.flatMap(c=>{if(c.type!=='IDAT')return[c.bytes];if(inserted)return[];inserted=true;return[idat]})])
if(next.length<original.length)fs.writeFileSync(file,next)
console.log(JSON.stringify({before:original.length,after:Math.min(original.length,next.length),pixelBytesUnchanged:true}))
