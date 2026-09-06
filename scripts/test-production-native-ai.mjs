import assert from 'node:assert/strict'
if(!process.argv.includes('--run-production'))throw new Error('Use --run-production explicitly; this performs one billable Coach request.')
const started=Date.now()
const response=await fetch('https://ieltsist.com/api/help/chat',{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({message:'Explain the difference between skimming and scanning for IELTS Reading in two short sentences.',history:[],helpContext:{product:'IELTSist',activeModule:'reading',source:'stemist-native-qa',surface:{viewId:'mini-practice',module:'reading',mode:'practice'}}}),
 signal:AbortSignal.timeout(60000),
})
const result=await response.json()
console.log(JSON.stringify({httpStatus:response.status,mode:result.mode||null,answerPresent:typeof result.answer==='string'&&result.answer.trim().length>0,latencyMs:Date.now()-started,requestedProviderCalls:1,sensitiveUploads:0}))
assert.equal(response.status,200)
assert.equal(result.mode,'ai','fallback text does not count as live AI acceptance')
assert.ok(String(result.answer||'').trim())
