import assert from 'node:assert/strict'
import { miniRuntime, settle } from './helpers/mini-runtime.mjs'

const university={id:'mit-synthetic',nameZh:'合成大学',nameEn:'Synthetic University',country:'United States',rankLabel:'=12',website:'https://www.synthetic.edu/'}
const ranking={id:'qs-world',label:'QS 世界大学排名',editionYear:2027,verifiedAt:'2026-10-10',sourceUrl:'https://www.topuniversities.com/world-university-rankings'}
const board={id:'ap',label:'AP',organization:'College Board',url:'https://apstudents.collegeboard.org/'}
let sends=0,modal=null
const runtime=miniRuntime({wx:{showModal:options=>{modal=options}},modules:{'bundles/coach/admissionsConversation':{
 cleanAdmissionsMessage:value=>String(value||'').trim(),newClientTurnId:()=> 'synthetic-directory-turn',
 resumeAdmissions:async()=>({conversation:{id:'synthetic-admissions-conversation',persona:'admissions-advisor',revision:0,turnCount:0},messages:[],nextBefore:''}),
 fetchAdmissionsMessages:async()=>({}),deleteAdmissions:async()=>({deleted:true}),sendAdmissions:async()=>{sends++;throw Error('not expected during entry')},
}}})
const sender=runtime.load('bundles/curricula/directoryCoachEntry'),receiver=runtime.load('bundles/coach/directoryCoachEntry')
runtime.storage.set('stemistUser',{id:'ielts:99880'});runtime.storage.set('stemistSessionToken','synthetic-local-only')
const first=sender.openDirectoryCoach({kind:'university',entity:university,ranking})
assert.match(runtime.calls.at(-1).url,/^\/bundles\/coach\/admissions\?directoryEntry=[a-z0-9-]+$/)
assert.ok(!runtime.calls.at(-1).url.includes('synthetic.edu'))
const page=runtime.page('bundles/coach/admissions');page.onLoad({directoryEntry:first});page.onShow();await settle()
assert.equal(page.data.directoryEntry.title,university.nameZh)
assert.match(page.data.message,/合成大学/);assert.match(page.data.message,/https:\/\/www.synthetic.edu/);assert.match(page.data.message,/2027/)
assert.match(page.data.message,/未.*核验|不编造|待核实/);assert.equal(sends,0)
assert.equal(receiver.consumeDirectoryEntry(first),null,'consumed once')
page.onHide();page.onUnload()

const second=sender.openDirectoryCoach({kind:'course',entity:board})
const next=runtime.page('bundles/coach/admissions');next.onLoad({directoryEntry:second});next.onShow();await settle()
assert.equal(next.data.directoryEntry.title,'AP');assert.equal(next.data.directoryEntryPending,true)
assert.match(next.data.message,/合成大学/,'unsent old draft is not silently replaced')
next.useDirectoryQuestion();assert.ok(modal);modal.success({confirm:false});assert.match(next.data.message,/合成大学/)
next.useDirectoryQuestion();modal.success({confirm:true});assert.match(next.data.message,/College Board/);assert.match(next.data.message,/apstudents.collegeboard.org/)
assert.equal(next.data.canRestoreDirectoryDraft,true);next.restoreDirectoryDraft();assert.match(next.data.message,/合成大学/)
assert.equal(sends,0)

for(const mode of ['wrong-owner','wrong-epoch','expired']){
 const nonce=sender.openDirectoryCoach({kind:'course',entity:board})
 const key=sender.DIRECTORY_ENTRY_KEY,raw=runtime.storage.get(key)
 if(mode==='wrong-owner')raw.owner='ielts:other'
 if(mode==='wrong-epoch')raw.epoch+=1
 if(mode==='expired')raw.at-=receiver.DIRECTORY_ENTRY_MAX_AGE_MS+1
 runtime.storage.set(key,raw);assert.equal(receiver.consumeDirectoryEntry(nonce),null,mode+' blocked')
}
assert.throws(()=>sender.openDirectoryCoach({kind:'university',entity:{...university,website:'javascript:bad'},ranking}),/无效|invalid/)
assert.throws(()=>sender.openDirectoryCoach({kind:'system',entity:board}),/无效|invalid/)

next.onUnload();runtime.storage.clear()
const guestNonce=sender.openDirectoryCoach({kind:'course',entity:board}),guest=runtime.page('bundles/coach/admissions')
guest.onLoad({directoryEntry:guestNonce});guest.onShow();assert.equal(guest.data.authRequired,true);assert.match(guest.data.message,/AP/)
guest.openAccount();guest.onHide();runtime.storage.set('stemistUser',{id:'ielts:99881'});runtime.storage.set('stemistSessionToken','synthetic-local-only');guest.onShow();await settle()
assert.match(guest.data.message,/AP/,'explicit guest login preserves only selected public context')
runtime.storage.set('stemistUser',{id:'ielts:99882'});guest.onShow();await settle();assert.equal(guest.data.directoryEntry,null);assert.equal(guest.data.message,'')
assert.equal(sends,0,'entering, logging in or changing identities never auto-sends')
guest.onUnload()
console.log('PASS directory Coach: selected entity, editable prompt, no auto-send, draft conflict/undo, owner/epoch/TTL, guest login')
