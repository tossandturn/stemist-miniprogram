import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const requests=[]
const r=miniRuntime({modules:{'utils/ieltsLearning':{requestIeltsLearning:async(path,payload,options)=>{
 requests.push({path,payload,options});return {mode:'ai',providerStatus:'connected',answer:'Exact student text',reviewRequired:true}
}}}})
const result=await r.load('utils/api').askIeltsCoach({message:'Check the argument in my photograph',context:{skill:'writing',inputMode:'photo'},imageDataUrls:['data:image/jpeg;base64,fixture']})
assert.equal(requests[0].path,'/api/help/chat')
assert.equal(requests[0].payload.imageDataUrl,'data:image/jpeg;base64,fixture')
assert.equal(result.reviewRequired,true)
assert.equal(requests[0].options.timeout,60000)
console.log('Native photo Coach sends the image to multimodal chat without an intermediate transcription endpoint.')
