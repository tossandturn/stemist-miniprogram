import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const clone=value=>JSON.parse(JSON.stringify(value))
const key='stemistIeltsSpeaking:guest:general'
const saved={sessionId:'speech-previous',epoch:0,taskId:'',turns:Array.from({length:150},(_,i)=>({role:i%2?'assistant':'user',text:'saved turn '+i,at:i})),elapsed:90,note:'saved examiner note',feedback:'saved detailed feedback',band:7,warning:'saved warning',audioFiles:['/owned/previous-recording.wav'],extraMetadata:{keep:true}}
let engine,deny=true
class FakeSpeaking{
 constructor(options){this.options=options;this.turns=options.turns;this.closed=false;engine=this}
 async start(){if(deny)throw Object.assign(new Error('Microphone permission denied'),{code:'record_permission_denied',action:'mini'})}
 close(){this.closed=true}
}
const r=miniRuntime({modules:{'utils/nativeSpeaking':{NativeSpeaking:FakeSpeaking}}});r.storage.set(key,clone(saved));r.storage.set('unrelated-bank',{keep:'original'})
assert.equal(r.load('utils/speakingStore').readSession('guest',saved.sessionId,0).feedback,saved.feedback,'legacy task records remain readable before any migration')
assert.deepEqual(clone(r.storage.get(key)),saved)
const page=r.page('pages/ielts/speaking');page.onLoad();await page.start()
assert.equal(page.data.feedback,saved.feedback,'permission denial must not clear existing feedback')
assert.equal(page.data.band,7);assert.equal(page.__turns.length,150)
page.onHide();assert.deepEqual(clone(r.storage.get(key)),saved,'failure/hide must not rewrite an unchanged saved record')
deny=false;page.onShow();await page.start();assert.equal(page.data.feedback,saved.feedback,'connecting is not a successful new session')
engine.options.onReady()
assert.equal(page.data.feedback,'');assert.notEqual(page.__sessionId,saved.sessionId)
const committedId=page.__sessionId;engine.options.onReady();assert.equal(page.__sessionId,committedId,'reconnecting must not create another session or reset its clock')
const store=r.load('utils/speakingStore'),archive=store.readSession('guest',saved.sessionId,0)
assert.equal(archive.turns.length,150);assert.equal(archive.feedback,saved.feedback);assert.deepEqual(clone(archive.audioFiles),saved.audioFiles);assert.deepEqual(clone(archive.extraMetadata),saved.extraMetadata)
page.onUnload();assert.deepEqual(r.storage.get('unrelated-bank'),{keep:'original'})
const historical=r.page('pages/ielts/speaking');historical.onLoad({sessionId:saved.sessionId});assert.equal(historical.data.viewingArchive,true);assert.equal(historical.data.feedback,saved.feedback)
for(let i=0;i<13;i++)historical.showEarlier();assert.equal(historical.data.turns[0].text,'saved turn 0');historical.onUnload()
const failed=miniRuntime({wx:{setStorageSync(){throw Error('storage full')}},modules:{'utils/nativeSpeaking':{NativeSpeaking:FakeSpeaking}}});failed.storage.set(key,clone(saved));const q=failed.page('pages/ielts/speaking');q.onLoad();await q.start();engine.options.onReady();assert.equal(q.data.feedback,saved.feedback);assert.equal(q.__sessionId,saved.sessionId);assert.ok(engine.closed);q.onUnload();assert.deepEqual(clone(failed.storage.get(key)),saved)
const conflict=miniRuntime(),s=conflict.load('utils/speakingStore');conflict.storage.set(key,{...clone(saved),revision:2});assert.throws(()=>s.saveSession(key,'guest',{...clone(saved),revision:1}),/其他页面/);assert.equal(conflict.storage.get(key).revision,2)
const parent=conflict.page('pages/ielts/speaking');parent.onLoad();conflict.storage.set(key,{...clone(saved),sessionId:'speech-newer',feedback:'newer page feedback',revision:3});parent.onShow();assert.equal(parent.data.feedback,'newer page feedback');parent.onUnload();assert.equal(conflict.storage.get(key).sessionId,'speech-newer')
for(const reverse of [false,true]){
 const duplicate=miniRuntime(),store=duplicate.load('utils/speakingStore'),archiveKey='stemistIeltsSpeaking:guest:session:'+saved.sessionId
 const older={...clone(saved),owner:'guest',revision:1,updatedAt:2000,feedback:'old copy',band:6},newer={...clone(saved),owner:'guest',revision:2,updatedAt:1000,feedback:'latest practice',band:8}
 for(const [k,v] of (reverse?[[archiveKey,older],[key,newer]]:[[key,newer],[archiveKey,older]]))duplicate.storage.set(k,v)
 assert.equal(store.readSession('guest',saved.sessionId,0).feedback,'latest practice','history must read highest revision regardless of key order or clock skew')
 assert.equal(store.sessionHistory('guest',0)[0].band,8,'history summary must use the same latest revision')
 duplicate.storage.set(archiveKey,newer)
 assert.throws(()=>store.archiveSession('guest',older),/更新|旧/,'stale snapshot cannot overwrite newer archive')
 assert.equal(duplicate.storage.get(archiveKey).revision,2)
 duplicate.storage.set(key,{...older,revision:2,updatedAt:3000,feedback:'latest timestamp'})
 assert.equal(store.readSession('guest',saved.sessionId,0).feedback,'latest timestamp','same revision legacy snapshots use update time as tie breaker')
}
const paged=miniRuntime();for(let i=0;i<45;i++)paged.storage.set('stemistIeltsSpeaking:guest:session:older-'+i,{...clone(saved),owner:'guest',sessionId:'older-'+i,updatedAt:i})
const history=paged.page('pages/ielts/speaking');history.onLoad();history.showSaved();assert.equal(history.data.historyRows.length,20);history.moreHistory();assert.equal(history.data.historyRows.length,20);history.moreHistory();assert.equal(history.data.historyRows.length,5);history.previousHistory();assert.equal(history.data.historyRows.length,20);history.onUnload();assert.equal(paged.storage.size,45,'history paging never rewrites the saved sessions')

function scoringFixture(ownerId='guest'){
 const note=deferred(),feedback=deferred(),requests=[],records=[]
 const runtime=miniRuntime({modules:{
  'utils/ieltsLearning':{requestIeltsLearning:async(...args)=>{requests.push(args);return feedback.promise}},
  'utils/nativeRecords':{rememberRecord:record=>records.push(record)},
 }})
 if(ownerId!=='guest')runtime.storage.set('stemistUser',{id:ownerId})
 const page=runtime.page('pages/ielts/speaking');page.onLoad();page.__turns=[{role:'user',text:'A completed spoken answer.',at:1}]
 let closeCount=0
 page.__engine={closed:false,stageState:{phase:'part3'},end:()=>note.promise,close(){closeCount++;this.closed=true;note.resolve('examiner note')}}
 page.setData({active:true})
 return {runtime,page,note,feedback,requests,records,get closeCount(){return closeCount}}
}
const scoreResult={mode:'ai',feedback:'Background scoring completed.',band:7,evidence:{realtimeNote:true}}

{
 const item=scoringFixture(),finishing=item.page.finish(),duplicate=item.page.finish()
 await settle();assert.equal(item.requests.length,0,'text scoring waits for the committed realtime note')
 item.page.onHide();await settle()
 assert.ok(item.closeCount>0&&item.page.__engine.closed,'hiding closes realtime capture/playback before background scoring')
 assert.equal(item.requests.length,1,'an explicitly submitted score may continue while the same account page is hidden')
 item.feedback.resolve(scoreResult);await Promise.all([finishing,duplicate])
 assert.equal(item.requests.length,1,'repeated finish while scoring must not issue a duplicate request')
 assert.equal(item.runtime.storage.get(item.page.__scope).feedback,scoreResult.feedback)
 assert.equal(item.records.length,1);assert.equal(item.runtime.storage.get('stemistSubmission:speaking').answer,scoreResult.feedback)
}

for(const boundary of ['dispose','owner','epoch']){
 const item=scoringFixture(boundary==='owner'?'student-a':'guest'),finishing=item.page.finish();await settle()
 if(boundary==='dispose')item.page.onUnload()
 if(boundary==='owner'){item.runtime.storage.set('stemistUser',{id:'student-b'});item.page.onHide()}
 if(boundary==='epoch'){item.runtime.storage.set('stemistPrivacyEpoch',1);item.page.onHide()}
 await finishing
 assert.equal(item.requests.length,0,`${boundary} before note completion must not start text scoring`)
 assert.equal(item.records.length,0);assert.equal(item.runtime.storage.has('stemistSubmission:speaking'),false)
}

for(const boundary of ['dispose','owner','epoch']){
 const item=scoringFixture(boundary==='owner'?'student-a':'guest'),finishing=item.page.finish();await settle();item.note.resolve('examiner note');await settle()
 assert.equal(item.requests.length,1)
 const storedBefore=item.runtime.storage.get(item.page.__scope)
 if(boundary==='dispose')item.page.onUnload()
 if(boundary==='owner')item.runtime.storage.set('stemistUser',{id:'student-b'})
 if(boundary==='epoch')item.runtime.storage.set('stemistPrivacyEpoch',1)
 item.feedback.resolve(scoreResult);await finishing
 assert.equal(item.runtime.storage.get(item.page.__scope)?.feedback,storedBefore?.feedback,`${boundary} after request must not write the returned result`)
 assert.equal(item.records.length,0);assert.equal(item.runtime.storage.has('stemistSubmission:speaking'),false)
}

{
 const item=scoringFixture(),finishing=item.page.finish();await settle();item.note.resolve('examiner note');await settle()
 const current=item.runtime.storage.get(item.page.__scope)
 item.runtime.storage.set(item.page.__scope,{...current,sessionId:'speech-newer-page',revision:(current.revision||0)+1,feedback:'Newer page result.'})
 item.feedback.resolve(scoreResult);await finishing
 const retained=item.runtime.storage.get(item.page.__scope)
 assert.equal(retained.sessionId,'speech-newer-page');assert.equal(retained.feedback,'Newer page result.','late scoring must not overwrite a newer session revision')
 assert.equal(item.records.length,0);assert.equal(item.runtime.storage.has('stemistSubmission:speaking'),false)
}

console.log('Speaking retention: denial, connecting, archive-before-replacement, >120 turns, background-score intent/isolation, revision conflicts, history and storage failure passed.')
