import assert from 'node:assert/strict'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

const sent=[]
const record={id:'directory-target-conversation',persona:'admissions-advisor',revision:0,turnCount:0}
const runtime=miniRuntime({modules:{'bundles/coach/admissionsConversation':{
  cleanAdmissionsMessage:value=>String(value||'').trim(),newClientTurnId:()=> 'directory-target-turn',
  resumeAdmissions:async()=>({conversation:record,messages:[],nextBefore:''}),fetchAdmissionsMessages:async()=>({}),deleteAdmissions:async()=>({deleted:true}),
  sendAdmissions:async request=>{sent.push(request);throw Object.assign(Error('断线测试'),{code:'network_error'})},
}}})
runtime.storage.set('stemistUser',{id:'ielts:99880'});runtime.storage.set('stemistSessionToken','synthetic')
const sender=runtime.load('bundles/curricula/directoryCoachEntry')
const nonce=sender.openDirectoryCoach({kind:'course',entity:{id:'alevel',label:'A-Level',organization:'Cambridge International',url:'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/'}})
const page=runtime.page('bundles/coach/admissions');page.onLoad({directoryEntry:nonce});page.onShow();await settle();await page.submit()
assert.deepEqual(JSON.parse(JSON.stringify(sent[0].directoryTarget||null)),{kind:'course',id:'alevel'})
page.onHide();page.onUnload()
const restored=runtime.page('bundles/coach/admissions');restored.onLoad({});restored.onShow();await settle();await restored.submit()
assert.equal(sent[1].clientTurnId,sent[0].clientTurnId)
assert.deepEqual(JSON.parse(JSON.stringify(sent[1].directoryTarget)),{kind:'course',id:'alevel'},'retry identity includes the original typed target after reload')
runtime.storage.set('stemistUser',{id:'ielts:99881'});restored.onShow();await settle()
assert.equal(restored.__pending,null)
assert.equal(restored.data.directoryEntry,null)
restored.onUnload()

let requestBody
const api=miniRuntime({modules:{'utils/api':{COACH_TEXT_TIMEOUT_MS:55000,requestJson:async(_path,body)=>{requestBody=body;return{mode:'ai',providerStatus:'connected',answer:'ok',clientTurnId:body.clientTurnId,conversation:{...record,revision:1,turnCount:2},turns:[{id:body.clientTurnId+':user',role:'user',content:body.message,sequence:1,status:'complete'},{id:body.clientTurnId+':assistant',role:'assistant',content:'ok',sequence:2,status:'complete'}]}}}}})
api.storage.set('stemistUser',{id:'ielts:99880'});api.storage.set('stemistSessionToken','synthetic')
const client=api.load('bundles/coach/admissionsConversation')
await client.sendAdmissions({message:'课程结构？',conversationId:record.id,clientTurnId:'directory-api-turn',expectedRevision:0,directoryTarget:{kind:'course',id:'alevel'}})
assert.deepEqual(JSON.parse(JSON.stringify(requestBody.directoryTarget)),{kind:'course',id:'alevel'})
await assert.rejects(client.sendAdmissions({message:'test',conversationId:record.id,clientTurnId:'directory-bad-turn',expectedRevision:0,directoryTarget:{kind:'course',id:'alevel',url:'http://localhost/'}}))

const normalized=api.load('bundles/coach/admissionsSources').normalizeSources([{id:'S1-1234567890abcdef12345678',url:'https://apstudents.collegeboard.org/what-is-ap',title:'What is AP?',retrievedAt:new Date().toISOString(),verification:{kind:'curriculum-information'},excerpt:'Official curriculum overview'}])
assert.equal(normalized[0].verification.kind,'curriculum-information')
assert.match(normalized[0].yearLabel,/课程说明.*不是大学录取线/)
console.log('PASS directory target client: structured payload, saved retry identity, owner reset, strict fields and curriculum source label')
