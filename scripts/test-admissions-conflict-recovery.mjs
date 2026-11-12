import assert from 'node:assert/strict'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'
const record = revision => ({ id:'admissions-conflict-conversation', persona:'admissions-advisor', revision, turnCount:revision })
const pair = pending => [
 {id:pending.clientTurnId+':user',role:'user',content:pending.message,sequence:3,status:'complete'},
 {id:pending.clientTurnId+':assistant',role:'assistant',content:'已保存的建议。',sequence:4,status:'complete'},
]
function identify(runtime){runtime.storage.set('stemistUser',{id:'ielts:42'});runtime.storage.set('stemistSessionToken','synthetic-token');runtime.storage.set('stemistSessionMeta',{owner:'ielts:42',kind:'wechat',expiresAt:new Date(Date.now()+300000).toISOString()});runtime.load('utils/entryAccess').acceptConsent()}
async function open(runtime){identify(runtime);const page=runtime.page('bundles/coach/admissions');page.onLoad();page.onShow();await settle();await settle();page.onMessage({detail:{value:'请分析我的申请计划。'}});return page}

// Use the real API wrapper and conversation client: text-mode non-2xx
// responses lose their JSON error code, unlike the old object-only mocks.
{
 let reads=0,writes=0;const bodies=[]
 const runtime=miniRuntime({wx:{request:o=>{
  if(o.url.endsWith('/conversations/resume')){reads++;o.success({statusCode:200,data:{conversation:record(reads===1?0:2),messages:[],nextBefore:''}})}
  else if(o.url.endsWith('/admissions/stream')){
   writes++;bodies.push(o.data)
   assert.equal(o.dataType,'text')
   if(writes===1)o.success({statusCode:409,data:JSON.stringify({code:'admissions_conversation_revision_conflict',error:'Conversation changed.'})})
   else{const result={mode:'ai',providerStatus:'connected',answer:'已保存的建议。',clientTurnId:o.data.clientTurnId,conversation:record(3),turns:pair(o.data)};o.success({statusCode:200,data:'event: done\ndata: '+JSON.stringify(result)+'\n\n'})}
  }else throw Error('Unexpected fixture path')
  return {abort(){}}
 }}})
 const page=await open(runtime)
 await page.submit()
 assert.equal(reads,2,'one state conflict triggers exactly one same-conversation recovery read')
 assert.equal(writes,1,'reconciliation must never auto-resend an AI turn')
 assert.equal(page.__pending.expectedRevision,2)
 assert.equal(page.data.message,'请分析我的申请计划。')
 assert.equal(page.data.canRetry,true)
 await page.submit()
 assert.equal(writes,2);assert.deepEqual(bodies.map(b=>b.expectedRevision),[0,2]);assert.equal(bodies[0].clientTurnId,bodies[1].clientTurnId)
 assert.equal(page.data.message,'');assert.equal(page.__pending,null)
 page.onUnload()
}

function conflictFixture({code='admissions_turn_in_progress',latest=null,readFailure=false,deferredRead=null}={}){
 let reads=0,writes=0,pending
 const runtime=miniRuntime({modules:{'utils/api':{isAuthError:e=>e.statusCode===401},'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:value=>String(value).trim(),newClientTurnId:()=> 'busy-recovery-turn',
  resumeAdmissions:async request=>{reads++;if(reads===1)return{conversation:record(0),messages:[],nextBefore:''};assert.equal(request.conversationId,record(0).id);if(deferredRead)await deferredRead.promise;if(readFailure)throw Object.assign(Error('读取暂时失败'),{code:'network_error'});return {conversation:record(2),messages:latest==='committed'?pair(pending):[],nextBefore:''}},
  sendAdmissions:async request=>{writes++;pending=request;throw Object.assign(Error('会话状态冲突，输入保留'),{statusCode:409,code})},
 }}})
 return {runtime,counts:()=>({reads,writes})}
}
{
 const f=conflictFixture({latest:'committed'}),page=await open(f.runtime)
 await page.submit()
 assert.deepEqual(f.counts(),{reads:2,writes:1})
 assert.equal(page.__pending,null);assert.equal(page.data.message,'');assert.equal(page.data.turns.at(-1).content,'已保存的建议。')
 assert.equal(page.data.canRetry,false,'a completed in-flight turn is recovered, not charged/generated again')
 page.onUnload()
}
{
 const f=conflictFixture({readFailure:true}),page=await open(f.runtime)
 await page.submit()
 assert.deepEqual(f.counts(),{reads:2,writes:1});assert.equal(page.data.message,'请分析我的申请计划。');assert.equal(page.__pending.needsRebase,true)
 await page.submit()
 assert.deepEqual(f.counts(),{reads:3,writes:1},'user retry must finish the state read before any new send')
 page.onUnload()
}
{
 const gate=deferred(),f=conflictFixture({latest:'committed',deferredRead:gate}),page=await open(f.runtime)
 const work=page.submit();await settle();page.onMessage({detail:{value:'这是另一段尚未发送的草稿。'}})
 gate.resolve();await work
 assert.equal(page.data.message,'这是另一段尚未发送的草稿。');assert.equal(page.__pending,null);assert.deepEqual(f.counts(),{reads:2,writes:1})
 page.onUnload()
}
{
 const gate=deferred(),f=conflictFixture({latest:'committed',deferredRead:gate}),page=await open(f.runtime)
 const work=page.submit();await settle();f.runtime.storage.set('stemistUser',{id:'ielts:99'});f.runtime.storage.set('stemistPrivacyEpoch',1)
 gate.resolve();await work
 assert.equal(page.data.turns.length,0,'old owner recovery response must not populate a new account')
 assert.equal(f.runtime.storage.get('stemistAdmissions:ielts:99:1'),undefined)
 page.onUnload()
}
{
 const f=conflictFixture(),page=await open(f.runtime)
 await page.submit();assert.deepEqual(f.counts(),{reads:2,writes:1})
 await settle();await settle();assert.deepEqual(f.counts(),{reads:2,writes:1},'no background polling/send loop')
 await page.submit();assert.deepEqual(f.counts(),{reads:3,writes:2},'each explicit retry allows at most one send and one recovery read')
 page.onUnload()
}
console.log('PASS admissions 409: real text transport, one recovery read, stable turn ID, committed-result recovery, draft/identity preservation and no automatic paid resend')

// A completed turn can be outside the latest 40 visible history rows. The
// server's exact-ID replay then legitimately returns the current revision
// without advancing it or charging another generation.
{
 const pending={clientTurnId:'older-completed-turn',message:'取回早先完成的回答。',expectedRevision:7}
 let calls=0,replayed=true
 const runtime=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55000,requestJson:async()=>{calls++;return{mode:'ai',providerStatus:'connected',answer:'已保存的建议。',conversation:record(7),clientTurnId:pending.clientTurnId,turns:pair(pending),replayed}}}}})
 identify(runtime)
 const client=runtime.load('bundles/coach/admissionsConversation')
 const result=await client.sendAdmissions({...pending,conversationId:record(7).id})
 assert.equal(result.replayed,true);assert.equal(calls,1)
 replayed=false
 await assert.rejects(client.sendAdmissions({...pending,conversationId:record(7).id}),/不匹配/,'a non-replay still must advance revision')
}
console.log('PASS exact completed-turn replay may retain the current revision; new turns still must advance it')
