import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const stages=[];let pending,failed=false
const r=miniRuntime({wx:{request:options=>{if(failed)options.fail({errMsg:'not in domain list'});else pending=options}},modules:{'utils/nativeSession':{refreshNativeSession:async()=>{},captureNativeCookie(){}},'utils/ieltsLearning':{requestIeltsLearning:async(path,payload,options)=>{assert.equal(payload.onStage,undefined);options.onDispatched();return{mode:'ai',providerStatus:'connected',answer:'IELTS feedback'}}}}})
const {runCoach}=r.load('utils/coach')
const call=runCoach({message:'synthetic question',onStage:s=>stages.push(s)})
await settle()
assert.deepEqual(stages,['calling'],'analysis starts after the server accepts the job, not while the photo is uploading')
assert.equal(pending.data.onStage,undefined,'callbacks never enter API JSON')
pending.success({statusCode:202,data:{id:pending.url.split('/').pop(),status:'succeeded',result:{mode:'ai',providerStatus:'connected',answer:'feedback'}}})
assert.equal((await call).answer,'feedback')
assert.deepEqual(stages,['calling','arranging'])
stages.length=0
await runCoach({message:'synthetic IELTS',context:{product:'IELTSist'},onStage:s=>stages.push(s)})
assert.deepEqual(stages,['calling','analysis','arranging'])
stages.length=0;failed=true
await assert.rejects(runCoach({message:'synthetic',onStage:s=>stages.push(s)}),e=>e.code==='network_domain_blocked')
assert.deepEqual(stages,['calling'],'synchronous failure cannot pretend to analyze or arrange a response')
console.log('Coach progress lifecycle: actual STEM/IELTS dispatch, actual response, callback-only telemetry and failure passed.')
