import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let connected=false
const calls=[]
const r=miniRuntime({modules:{
 'utils/image':{readAsJpegDataUrl:async()=> 'data:image/jpeg;base64,synthetic'},
 'utils/coach':{runCoach:async input=>{calls.push(input);return connected?{mode:'ai',providerStatus:'connected',answer:'x = 4',coachState:{label:'AI 已连接',isConnected:true}}:{mode:'offline',providerStatus:'error',retryable:true,answer:'图片请求未完成，内容已保留。',coachState:{label:'AI 暂不可用',isConnected:false,warning:'请求超时'}}}},
}})
r.storage.set('stemistUser',{id:'synthetic-student'});r.storage.set('stemistSessionToken','fixture-token')
const p=r.page('pages/coach/index');p.onLoad({source:'alevel'});p.setData({message:'请检查第二步',imagePath:'/synthetic/photo.jpg'})
await p.submit()
assert.equal(p.data.canRetry,true,'HTTP 200 offline feedback remains retryable')
assert.equal(r.storage.get('stemistDraft:coach')?.message,'请检查第二步','A fallback cannot clear the typed draft')
assert.ok(![...r.storage.keys()].some(k=>k.startsWith('stemistSubmission:coach-')),'An offline hint cannot count as a successful student submission')
assert.equal(p.data.imagePath,'/synthetic/photo.jpg')
assert.equal(p.__history.length,0)
connected=true;await p.retry()
assert.equal(calls.length,2)
assert.equal(calls[1].message,'请检查第二步')
assert.equal(calls[1].imageDataUrls.length,1)
assert.equal(p.data.canRetry,false)
assert.equal(r.storage.has('stemistDraft:coach'),false)
assert.equal(r.storage.get('stemistSubmission:coach-stem-photo')?.coachMode,'ai')
p.onUnload()
console.log('Coach fallback: HTTP 200 failures retain draft/photo, no false completion, and the same input retries successfully.')
