import assert from 'node:assert/strict'
import fs from 'node:fs'
const base='https://stem.ieltsist.com',results=[],subjects=['0580','0606','0610','0625','9231','9700','9701','9702','9708','9709','bpho','amc12','esat','tmua']
async function get(path){const start=Date.now(),r=await fetch(base+path,{signal:AbortSignal.timeout(15000)}),text=await r.text();assert.equal(r.status,200,'public resource '+path);return {value:JSON.parse(text),bytes:Buffer.byteLength(text),ms:Date.now()-start}}
for(let i=0;i<subjects.length;i+=2)await Promise.all(subjects.slice(i,i+2).map(async subject=>{
 const response=await get('/api/stem/paper-catalog?subject='+subject+'&page=1'),data=response.value
 assert.equal(data.schemaVersion,'native-paper-catalog-v1');assert.ok(data.total>0);assert.ok(data.items.length<=30);assert.ok(response.bytes<35000)
 assert.ok(data.items.every(p=>p.subject===subject&&p.routeIds.length>0))
 const result={subject,total:data.total,pageBytes:response.bytes,firstPageMs:response.ms,pageCount:data.pageCount}
 if(data.pageCount>1){const last=await get('/api/stem/paper-catalog?subject='+subject+'&page='+data.pageCount);assert.equal(last.value.page,data.pageCount);assert.ok(last.value.items.length>0&&last.value.items.length<=30);assert.ok(!last.value.items.some(p=>data.items.some(first=>p.id===first.id)));result.lastPageMs=last.ms}
 results.push(result);console.log(JSON.stringify(result))
}))
const sources=await get('/api/stem/papers/cie-9702-9702_m25_qp_22/source-context?routeId=cie-9702-as-physics&stage=AS')
assert.equal(sources.value.questions.length,7);assert.doesNotMatch(JSON.stringify(sources.value),/"(parts|provenance|bindingSignature|answer|markScheme)"\s*:/)
const privateResponse=await fetch(base+'/api/stem/papers/cie-9702-9702_m25_qp_22/native-context?routeId=cie-9702-as-physics&stage=AS',{signal:AbortSignal.timeout(10000)});await privateResponse.text();assert.equal(privateResponse.status,401)
const output={status:'pass',surface:'public HTTPS from Windows',results:results.sort((a,b)=>a.subject.localeCompare(b.subject)),sourceQuestions:7,sourceMs:sources.ms,unauthenticatedMarkingContext:401}
const directory='D:/CodexWork/qa-artifacts/native-materials-runtime-20260907';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/production.json',JSON.stringify(output,null,2)+'\n','utf8');console.log(JSON.stringify({status:'pass',subjects:results.length,sourceQuestions:7}))
