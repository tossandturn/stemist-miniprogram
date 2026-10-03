import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
if(!process.argv.includes('--run-production'))throw new Error('Use --run-production explicitly; this performs one billable Coach request.')
const started=Date.now()
const response=await fetch('https://ieltsist.com/api/help/chat',{
 method:'POST',headers:{'Content-Type':'application/json'},
 // General vocabulary has no passage evidence requirement. A Reading task
 // without its source is intentionally guarded locally, not an AI outage.
 body:JSON.stringify({message:'Explain lifelong learning in two short sentences.',history:[],helpContext:{product:'IELTSist',activeModule:'vocabulary',source:'stemist-native-qa',surface:{viewId:'mini-practice',module:'vocabulary',mode:'practice'}}}),
 signal:AbortSignal.timeout(60000),
})
const result=await response.json()
const evidence={httpStatus:response.status,mode:result.mode||null,answerPresent:typeof result.answer==='string'&&result.answer.trim().length>0,latencyMs:Date.now()-started,requestedProviderCalls:1,sensitiveUploads:0}
const outputIndex=process.argv.indexOf('--output')
if(outputIndex>=0){const output=path.resolve(process.argv[outputIndex+1]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2),'utf8')}
console.log(JSON.stringify(evidence))
assert.equal(response.status,200)
assert.equal(result.mode,'ai','fallback text does not count as live AI acceptance')
assert.ok(String(result.answer||'').trim())
