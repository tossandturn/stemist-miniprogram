import assert from 'node:assert/strict'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const clean=value=>String(value||'').trim()
const record=(revision=0,id='ielts-teacher-conversation')=>({id,persona:'ielts-teacher',revision,turnCount:revision})
const turnPair=(clientTurnId,message,answer)=>[
 {id:clientTurnId+':user',role:'user',content:message,sequence:1,status:'complete'},
 {id:clientTurnId+':assistant',role:'assistant',content:answer,sequence:2,status:'complete'},
]
const baseConversation=overrides=>({
 cleanIeltsTeacherMessage:clean,
 newClientTurnId:()=> 'ielts-teacher-recovery-turn',
 resumeIeltsTeacher:async()=>({conversation:record(),messages:[],nextBefore:''}),
 fetchIeltsTeacherMessages:async()=>({conversation:record(),messages:[],nextBefore:''}),
 deleteIeltsTeacher:async({conversationId})=>({deleted:true,conversationId}),
 sendIeltsTeacher:async()=>{throw Error('unused')},
 ...overrides,
})
const teacherPage=(options={})=>miniRuntime({...options,modules:{...(options.modules||{}),'bundles/coach/ieltsTeacherConversation':baseConversation(options.conversation)}})

// A durable receipt retries save-only with the same idempotency identity and preserves a newer draft.
let deferredCalls=[]
const durable=teacherPage({conversation:{sendIeltsTeacher:async request=>{deferredCalls.push(request);if(deferredCalls.length===1)throw Object.assign(Error('deferred'),{code:'ielts_teacher_commit_deferred',statusCode:503,retryable:true,providerRetryRequired:false,receiptStatus:'durable',partialAnswer:'已生成的完整建议。'});return{mode:'ai',providerStatus:'connected',answer:'已生成的完整建议。',clientTurnId:request.clientTurnId,conversation:record(2),turns:turnPair(request.clientTurnId,request.message,'已生成的完整建议。')}}}})
durable.storage.set('stemistUser',{id:'durable-owner'});durable.storage.set('stemistSessionToken','token')
const durablePage=durable.page('bundles/coach/ieltsTeacher');durablePage.onLoad();durablePage.onShow();await settle();await settle();durablePage.onMessage({detail:{value:'保存这条学习建议'}});await durablePage.submit()
assert.equal(durablePage.data.receiptState,'commit-deferred')
assert.equal(durablePage.data.canRetry,true)
assert.match(durablePage.data.error,/重试保存/)
durablePage.onMessage({detail:{value:'下一条雅思问题'}});await durablePage.submit()
assert.deepEqual(deferredCalls.map(item=>item.clientTurnId),['ielts-teacher-recovery-turn','ielts-teacher-recovery-turn'])
assert.equal(durablePage.data.message,'下一条雅思问题')

// An indeterminate receipt blocks every new provider call until canonical history confirms the turn.
let indeterminateCalls=0,committed=false
const indeterminate=teacherPage({conversation:{
 resumeIeltsTeacher:async()=>committed?{conversation:record(2),messages:turnPair('ielts-teacher-recovery-turn','只生成一次','后来确认的回答'),nextBefore:''}:{conversation:record(),messages:[],nextBefore:''},
 sendIeltsTeacher:async()=>{indeterminateCalls++;throw Object.assign(Error('unknown'),{code:'ielts_teacher_generation_indeterminate',statusCode:503,retryable:false,exactlyOnceGuaranteed:false,providerRetryRequired:false,receiptStatus:'volatile',partialAnswer:'可能已生成的回答。'})},
}})
indeterminate.storage.set('stemistUser',{id:'indeterminate-owner'});indeterminate.storage.set('stemistSessionToken','token')
const indeterminatePage=indeterminate.page('bundles/coach/ieltsTeacher');indeterminatePage.onLoad();indeterminatePage.onShow();await settle();await settle();indeterminatePage.onMessage({detail:{value:'只生成一次'}});await indeterminatePage.submit()
assert.equal(indeterminatePage.data.receiptState,'indeterminate')
assert.equal(indeterminatePage.data.sendBlocked,true)
indeterminatePage.onMessage({detail:{value:'不同的新问题'}});await indeterminatePage.submit();assert.equal(indeterminateCalls,1)
committed=true;await indeterminatePage.returnLatestHistory()
assert.equal(indeterminatePage.data.sendBlocked,false)
assert.equal(indeterminatePage.data.message,'不同的新问题')

// A same-owner login after a 401 starts a fresh resume and restores the isolated draft.
let authCalls=0
const firstResume=deferred()
const auth=teacherPage({modules:{'utils/api':{isAuthError:error=>Number(error?.statusCode)===401||error?.code==='auth_required'}},conversation:{resumeIeltsTeacher:async()=>{authCalls++;if(authCalls===1)return firstResume.promise;return{conversation:record(),messages:[],nextBefore:''}}}})
auth.storage.set('stemistUser',{id:'auth-owner'});auth.storage.set('stemistSessionToken','expired-token')
auth.storage.set('stemistIeltsTeacher:auth-owner:0',{owner:'auth-owner',epoch:0,draft:'保留的雅思草稿',conversation:record(),pending:null,clearPending:false})
const authPage=auth.page('bundles/coach/ieltsTeacher');authPage.onLoad();authPage.onShow();await settle()
auth.storage.delete('stemistUser');auth.storage.delete('stemistSessionToken');firstResume.reject(Object.assign(Error('expired'),{statusCode:401,code:'auth_required'}));await settle();await settle()
auth.storage.set('stemistUser',{id:'auth-owner'});auth.storage.set('stemistSessionToken','fresh-token');authPage.onShow();await settle();await settle()
assert.equal(authCalls,2)
assert.equal(authPage.data.message,'保留的雅思草稿')

// A revision conflict rebases once while retaining the same clientTurnId.
let revision=0,conflictRequests=[]
const conflict=teacherPage({conversation:{
 resumeIeltsTeacher:async()=>({conversation:record(revision),messages:[],nextBefore:''}),
 sendIeltsTeacher:async request=>{conflictRequests.push(request);if(conflictRequests.length===1)throw Object.assign(Error('conflict'),{statusCode:409,code:'ielts_teacher_conversation_revision_conflict'});return{mode:'ai',providerStatus:'connected',answer:'rebased',clientTurnId:request.clientTurnId,conversation:record(request.expectedRevision+1),turns:turnPair(request.clientTurnId,request.message,'rebased')}},
}})
conflict.storage.set('stemistUser',{id:'conflict-owner'});conflict.storage.set('stemistSessionToken','token')
const conflictPage=conflict.page('bundles/coach/ieltsTeacher');conflictPage.onLoad();conflictPage.onShow();await settle();await settle();conflictPage.onMessage({detail:{value:'安全重试'}});await conflictPage.submit();revision=1;await conflictPage.returnLatestHistory();await conflictPage.submit()
assert.deepEqual(conflictRequests.map(item=>item.expectedRevision),[0,1])
assert.equal(conflictRequests[0].clientTurnId,conflictRequests[1].clientTurnId)

// A failed durable storage write still masks a deleted cloud conversation after reopening.
let storageBlocked=true,deletes=0
const storage=new Map([
 ['stemistUser',{id:'fence-owner'}],['stemistSessionToken','token'],
 ['stemistIeltsTeacher:fence-owner:0',{owner:'fence-owner',epoch:0,draft:'private teacher draft',conversation:record(),pending:null,clearPending:false}],
])
const fenced=teacherPage({wx:{
 getStorageSync:key=>storage.has(key)?storage.get(key):'',
 setStorageSync:(key,value)=>{if(storageBlocked&&String(key).startsWith('stemistIeltsTeacher:'))throw Error('quota');storage.set(key,value)},
 removeStorageSync:key=>{if(storageBlocked&&String(key).startsWith('stemistIeltsTeacher:'))throw Error('quota');storage.delete(key)},
 getStorageInfoSync:()=>({keys:[...storage.keys()]}),showModal:options=>options.success({confirm:true}),
},conversation:{deleteIeltsTeacher:async({conversationId})=>{deletes++;return{deleted:true,conversationId}}}})
const fencePage=fenced.page('bundles/coach/ieltsTeacher');fencePage.onLoad();await fencePage.clearConversation();assert.equal(deletes,1)
const reopened=fenced.page('bundles/coach/ieltsTeacher');reopened.onLoad();assert.equal(reopened.data.message,'');assert.equal(reopened.data.clearPending,true)
storageBlocked=false;await reopened.clearConversation();assert.equal(reopened.data.clearPending,false);assert.equal(deletes,1)

// Existing conversation identity and revision are binding, never advisory.
const binding=teacherPage({conversation:{resumeIeltsTeacher:async()=>({conversation:record(2,'different-conversation'),messages:turnPair('wrong-turn','wrong','thread'),nextBefore:''})}})
binding.storage.set('stemistUser',{id:'binding-owner'});binding.storage.set('stemistSessionToken','token')
binding.storage.set('stemistIeltsTeacher:binding-owner:0',{owner:'binding-owner',epoch:0,draft:'',conversation:record(3,'expected-conversation'),pending:null,clearPending:false})
const bindingPage=binding.page('bundles/coach/ieltsTeacher');bindingPage.onLoad();bindingPage.onShow();await settle();await settle()
assert.equal(bindingPage.__conversation.id,'expected-conversation')
assert.equal(bindingPage.data.turns.length,0)
assert.match(bindingPage.data.error,/对话|记录|刷新/)

console.log('PASS IELTS teacher recovery: receipts, indeterminate block, 401 restore, rebase, clear fences and canonical binding')
