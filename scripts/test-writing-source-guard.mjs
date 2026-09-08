import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'

const OLD='a'.repeat(64),CURRENT='b'.repeat(64),SECOND='c'.repeat(64),FOURTH='d'.repeat(64),FIFTH='e'.repeat(64)
const task=(number,revision=CURRENT,availability='ready')=>({
 id:`cam15-w-test1-task${number}`,module:'writing',book:15,test:1,type:`Task ${number}`,
 title:`Writing Task ${number}`,prompt:`Current canonical prompt ${number}`,
 images:[{id:'1',page:1,url:'https://ieltsist.com/generated/writing/current.webp'}],
 sourceAvailability:availability,sourceRevision:revision,
})

// The current public index is authoritative even when the bundled detail pack is stale.
{
 const indexTask={...task(1,CURRENT,'pending-review'),writingPageImages:[{page:1,url:'/generated/writing/current.webp'}]}
 const catalog={schemaVersion:'native-ielts-catalog-v1',version:'catalog-current',baseVersion:'pack-old',listeningTests:[],readingTests:[],writingTasks:[indexTask],speakingSets:[]}
 const r=miniRuntime({modules:{
  'utils/ieltsBootstrap':{catalog},
  'utils/ieltsTaskBootstrap':{version:'pack-old'},
  'utils/nativeDataPack':{unpackTask:()=>({...task(1,OLD,'ready'),prompt:'Stale bundled prompt',writingPageImages:[{page:9,url:'/generated/writing/stale.webp'}]})},
  'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{throw new Error('detail request should not be needed')}},
 }})
 const content=r.load('utils/ieltsContent')
 const loaded=await content.getIeltsTask('writing',indexTask.id)
 assert.equal(loaded.sourceAvailability,'pending-review')
 assert.equal(loaded.sourceRevision,CURRENT)
 assert.equal(loaded.prompt,'Stale bundled prompt','source gate metadata overlays the bundle without inventing replacement content')
 assert.equal(content.normalizeTask({id:'cam9-w-test1-task1',prompt:'legacy'},'writing').sourceAvailability,'pending-review','canonical Writing without a valid revision fails closed')
 const item=content.catalogPage([loaded]).items[0]
 assert.equal(item.sourceAvailability,'pending-review');assert.equal(item.sourceRevision,CURRENT)
}

// A packaged index without source metadata refreshes once so online ready tasks do not stay falsely blocked.
{
 const id=task(1).id,legacy={id,module:'writing',book:15,test:1,type:'Task 1',title:'Legacy index'}
 const oldCatalog={schemaVersion:'native-ielts-catalog-v1',version:'legacy-index',baseVersion:'legacy-pack',listeningTests:[],readingTests:[],writingTasks:[legacy],speakingSets:[]}
 const currentTask={...task(1),writingPageImages:[]};const currentCatalog={...oldCatalog,version:'current-index',writingTasks:[currentTask]}
 const requests=[]
 const r=miniRuntime({modules:{
  'utils/ieltsBootstrap':{catalog:oldCatalog},'utils/ieltsTaskBootstrap':{version:'legacy-pack'},'utils/nativeDataPack':{unpackTask:()=>({...legacy,prompt:'Unverified bundled prompt'})},
  'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async path=>{requests.push(path);return path.endsWith('/catalog')?currentCatalog:{schemaVersion:'native-ielts-task-v1',task:currentTask}}},
 }})
 const loaded=await r.load('utils/ieltsContent').getIeltsTask('writing',id)
 assert.deepEqual(requests,['/api/native/ielts/catalog','/api/native/ielts/tasks/writing/'+id]);assert.equal(loaded.sourceAvailability,'ready');assert.equal(loaded.sourceRevision,CURRENT)
}

// An old full-exam link cannot start a fresh Writing clock for a source that is now blocked.
{
 let clocks=0
 const exam={key:'exam-source-gate',sources:{writing:[task(1).id,task(2).id]},clocks:{}}
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async()=>task(1,CURRENT,'pending-review')},
  'utils/nativeExam':{readExam:()=>exam,completeExamModule:()=>{},startExamModuleClock:()=>{clocks++;return {startedAt:Date.now(),deadlineAt:Date.now()+3600000,limitSeconds:3600}},clockState:clock=>clock?{label:'60:00',expired:false}:null},
 }})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id,examKey:exam.key});await settle();assert.equal(clocks,0,'blocked source cannot begin a new timed attempt');p.onUnload()
}

// A late source response and restored private fields cannot cross an account/privacy epoch.
{
 const latest=deferred();let polls=0
 const r=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:()=>latest.promise},'utils/ieltsWriting':{writingJob:async()=>{polls++;return {status:'pending'}}}}})
 r.storage.set('stemistUser',{id:'ielts:old'})
 const key='stemistDraft:ielts-writing:'+task(1).id
 r.storage.set(key,{owner:'ielts:old',epoch:0,inputMode:'photo',text:'Private old essay',prompt:'Private restored prompt',photoPath:'/owned/private.jpg',answer:'Private feedback',warning:'Private warning',jobId:'private-old-job',sourceAvailability:'ready',sourceRevision:OLD})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});r.storage.set('stemistUser',{id:'ielts:new'});r.storage.set('stemistPrivacyEpoch',1);latest.resolve(task(1));await settle();p.onShow()
 assert.equal(polls,0);assert.equal(p.data.text,'');assert.equal(p.data.photoPath,'');assert.equal(p.data.prompt,'');assert.equal(p.data.answer,'');assert.equal(p.data.warning,'');assert.equal(p.__jobId,'');assert.equal(r.storage.get(key).text,'Private old essay','the old owner draft remains isolated rather than being rewritten as the new account');p.onUnload()
}

// A direct review-required response stays fail-closed even if a rolling catalog refresh is stale.
{
 let starts=0
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async()=>task(1)},
  'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;throw Object.assign(new Error('review'),{statusCode:409,code:'writing_source_review_required'})}},
 }})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});await settle();p.onInput({detail:{value:'Preserve during rolling release'}});await p.submit()
 assert.equal(starts,1);assert.equal(p.data.sourceAvailability,'pending-review');assert.equal(p.data.sourceReviewRequired,false);assert.equal(p.data.text,'Preserve during rolling release')
 await p.submit();assert.equal(starts,1,'stale ready metadata cannot retry after the authoritative review-required response');p.onUnload()
}

// A ready catalog revision can use bundled details only when the bundle carries the exact same revision.
{
 let detailRequests=0
 const currentTask={...task(1),writingPageImages:[]}
 const catalog={schemaVersion:'native-ielts-catalog-v1',version:'catalog-ready',baseVersion:'pack-stale',listeningTests:[],readingTests:[],writingTasks:[currentTask],speakingSets:[]}
 const r=miniRuntime({modules:{
  'utils/ieltsBootstrap':{catalog},'utils/ieltsTaskBootstrap':{version:'pack-stale'},
  'utils/nativeDataPack':{unpackTask:()=>({...task(1,OLD),prompt:'Stale ready prompt'})},
  'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{detailRequests++;return {schemaVersion:'native-ielts-task-v1',task:currentTask}}},
 }})
 const loaded=await r.load('utils/ieltsContent').getIeltsTask('writing',currentTask.id)
 assert.equal(detailRequests,1,'a stale ready bundle must not be relabelled with a newer source revision')
 assert.equal(loaded.prompt,currentTask.prompt)
}

// Every canonical grading request carries its own authoritative revision; free input remains compatible.
{
 const payloads=[]
 const r=miniRuntime({modules:{'utils/ieltsLearning':{requestIeltsLearning:async(_path,payload)=>{payloads.push(payload);return {jobId:'writing-source-job'}}}}})
 const service=r.load('utils/ieltsWriting')
 await assert.rejects(()=>service.startWritingFeedback('Prompt','Essay',task(1).id,[]),/来源|更新|核验/)
 assert.equal(payloads.length,0,'canonical tasks cannot reach the network without a source revision')
 await service.startWritingFeedback('Free prompt','Free essay')
 await service.startWritingFeedback('Prompt','Essay',task(1).id,[],CURRENT)
 await service.startWritingPairFeedback([task(1,CURRENT),task(2,SECOND)].map(item=>({...item,essay:'Student essay'})))
 assert.equal(payloads[1].sourceRevision,CURRENT)
 assert.deepEqual(payloads[2].items.map(item=>item.sourceRevision),[CURRENT,SECOND])
}

// A server-side changed race reloads the source and returns to the same explicit confirmation gate.
{
 let revision=OLD,starts=0,polls=0
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async(_module,_id,options={})=>task(1,options.refresh?CURRENT:revision)},
  'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;if(starts===1)throw Object.assign(new Error('changed'),{statusCode:409,code:'writing_source_changed'});return 'race-new-job'},writingJob:async()=>{polls++;return {status:'done',result:{ai:true,gradeReady:true,feedback:'Race-safe feedback',band:7,criteria:[],warning:'',reportUrl:''}}}},
 }})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});await settle();p.onInput({detail:{value:'Race-safe essay'}});revision=CURRENT;await p.submit()
 assert.equal(p.data.sourceReviewRequired,true);assert.equal(p.data.text,'Race-safe essay');assert.equal(polls,0)
 p.viewSourceUpdate();p.confirmSourceUpdate();await p.submit();assert.equal(starts,2);assert.equal(p.data.answer,'Race-safe feedback');p.onUnload()
}

// A restored old draft/photo/result/job is frozen until a real two-step learner confirmation.
{
 const latest=deferred();let starts=0,polls=0,sent
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:()=>latest.promise},
  'utils/image':{readAsJpegDataUrl:async()=>'data:image/jpeg;base64,fixture'},
  'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}},
  'utils/ieltsWriting':{startWritingFeedback:async(...args)=>{starts++;sent=args;return 'new-source-job'},writingJob:async()=>{polls++;return {status:'done',result:{ai:true,gradeReady:true,feedback:'New feedback',band:7,criteria:[],warning:'',reportUrl:''}}}},
 }})
 const key='stemistDraft:ielts-writing:'+task(1).id
 r.storage.set(key,{owner:'guest',epoch:0,inputMode:'photo',text:'My preserved essay',photoPath:'/owned/old-answer.jpg',prompt:'Old source prompt',taskType:'Task 1',answer:'Old feedback',band:6,criteria:[{label:'TR',score:6}],warning:'Old warning',reportUrl:'/api/report/pdf/old',jobId:'old-source-job',sourceAvailability:'ready',sourceRevision:OLD})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});p.onShow()
 assert.equal(polls,0,'onShow must wait for current source metadata before touching a restored job')
 latest.resolve(task(1));await settle();await settle()
 assert.equal(p.data.sourceReviewRequired,true)
 assert.equal(p.data.prompt,'Old source prompt');assert.equal(p.data.text,'My preserved essay');assert.equal(p.data.photoPath,'/owned/old-answer.jpg');assert.equal(p.data.answer,'Old feedback')
 assert.equal(polls,0);assert.equal(starts,0)
 const guardedCoach=p.getCoachContext();assert.doesNotMatch(guardedCoach.contextText,/Old source prompt|Current canonical prompt/,'AI Coach does not receive an unconfirmed task prompt')
 p.viewSourceUpdate();assert.equal(p.data.sourcePreview,true);assert.equal(p.data.latestPrompt,'Current canonical prompt 1')
 p.confirmSourceUpdate();assert.equal(p.data.sourceReviewRequired,false);assert.equal(p.data.prompt,'Current canonical prompt 1');assert.equal(p.data.sourceRevision,CURRENT)
 assert.equal(p.data.text,'My preserved essay');assert.equal(p.data.photoPath,'/owned/old-answer.jpg');assert.equal(p.data.answer,'','old feedback cannot masquerade as feedback for the new task')
 p.onHide();const confirmed=r.storage.get(key),archives=r.load('utils/writingSourceArchive').listWritingSourceArchives(p.__scope,'guest',0)
 assert.ok(confirmed.sourceArchiveRef?.archiveId);assert.equal(confirmed.sourceArchive,undefined);assert.equal(archives.total,1);assert.equal(archives.items[0].jobId,'old-source-job');assert.equal(archives.items[0].feedback,'Old feedback');assert.equal(archives.items[0].text,'My preserved essay');assert.equal(archives.items[0].photoPath,'/owned/old-answer.jpg');assert.equal(archives.items[0].prompt,'Old source prompt')
 await p.submit();assert.equal(starts,1);assert.equal(sent[4],CURRENT);assert.equal(p.data.answer,'New feedback');p.onUnload()
}

// Weak-network source loading keeps every old artifact and cannot resume the job.
{
 let starts=0,polls=0
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async()=>{throw new Error('网络连接失败，输入已保留。')}},
  'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;return 'never'},writingJob:async()=>{polls++;return {status:'pending'}}},
 }})
 const key='stemistDraft:ielts-writing:'+task(1).id
 r.storage.set(key,{owner:'guest',epoch:0,inputMode:'typed',text:'Offline essay',photoPath:'/owned/offline.jpg',prompt:'Offline old prompt',answer:'Offline feedback',jobId:'offline-job',sourceRevision:OLD,sourceAvailability:'ready'})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});p.onShow();await settle();await p.submit()
 assert.equal(starts,0);assert.equal(polls,0);assert.equal(p.data.text,'Offline essay');assert.equal(p.data.photoPath,'/owned/offline.jpg');assert.equal(p.data.prompt,'Offline old prompt');assert.equal(p.data.answer,'Offline feedback');p.onUnload()
}

// Same-revision jobs resume normally; a new ready task submits normally; pending review submits nothing.
{
 let samePolls=0
 const same=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async()=>task(1)},
  'utils/ieltsWriting':{startWritingFeedback:async()=>{throw new Error('must not restart')},writingJob:async()=>{samePolls++;return {status:'done',result:{ai:true,gradeReady:true,feedback:'Recovered same-source feedback',band:7,criteria:[],warning:'',reportUrl:''}}}},
 }})
 same.storage.set('stemistDraft:ielts-writing:'+task(1).id,{owner:'guest',epoch:0,inputMode:'typed',text:'Same source essay',prompt:task(1).prompt,jobId:'same-source-job',sourceRevision:CURRENT,sourceAvailability:'ready'})
 const restored=same.page('pages/ielts/writing');restored.onLoad({taskId:task(1).id});restored.onShow();await settle();await settle();assert.equal(samePolls,1);assert.equal(restored.data.answer,'Recovered same-source feedback');restored.onUnload()

 let starts=0,revision=''
 const fresh=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:async()=>task(1)},'utils/ieltsWriting':{startWritingFeedback:async(_p,_e,_id,_images,rev)=>{starts++;revision=rev;return 'fresh-source-job'},writingJob:async()=>({status:'done',result:{ai:true,gradeReady:true,feedback:'Fresh feedback',band:7,criteria:[],warning:'',reportUrl:''}})}}})
 const page=fresh.page('pages/ielts/writing');page.onLoad({taskId:task(1).id});await settle();page.onInput({detail:{value:'Fresh essay'}});await page.submit();assert.equal(starts,1);assert.equal(revision,CURRENT);page.onUnload()

 let blockedStarts=0
 const blocked=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:async()=>task(1,CURRENT,'pending-review')},'utils/ieltsWriting':{startWritingFeedback:async()=>{blockedStarts++;return 'blocked'}}}})
 const pending=blocked.page('pages/ielts/writing');pending.onLoad({taskId:task(1).id});await settle();pending.onInput({detail:{value:'Saved but not graded'}});await pending.submit();assert.equal(blockedStarts,0);assert.equal(pending.data.sourceAvailability,'pending-review');assert.doesNotMatch(pending.getCoachContext().contextText,/Current canonical prompt/);pending.onUnload()
}

// Full Writing applies one explicit confirmation to both tasks and carries two revisions.
{
 const tasks=[task(1),task(2,SECOND)];let starts=0,polls=0,sent
 const real=miniRuntime().load('utils/ieltsWriting')
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{loadIeltsContent:async()=>({writing:tasks}),getIeltsTask:async(_module,id)=>tasks.find(item=>item.id===id)},
  'utils/image':{readAsJpegDataUrl:async()=>'data:image/jpeg;base64,fixture'},
  'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}},
  'utils/ieltsWriting':{writingPairs:real.writingPairs,startWritingPairFeedback:async items=>{starts++;sent=items;return 'new-pair-job'},writingJob:async()=>{polls++;return {status:'done',result:{ai:true,gradeReady:true,feedback:'New pair feedback',band:7,taskScores:[],warning:'',reportUrl:''}}}},
 }})
 const key='stemistDraft:writing-pair:guest:cam15-test1'
 r.storage.set(key,{items:[{text:'Old essay 1',photo:'',inputMode:'typed',prompt:'Old pair prompt 1',sourceRevision:OLD,sourceAvailability:'ready'},{text:'',photo:'/owned/pair-task2.jpg',inputMode:'photo',prompt:'Old pair prompt 2',sourceRevision:OLD,sourceAvailability:'ready'}],jobId:'old-pair-job',feedback:'Old pair feedback',band:6,taskScores:[],warning:'Old pair warning',reportUrl:'/api/report/pdf/old-pair'})
 const p=r.page('pages/ielts/writing-full');p.onLoad({pairId:'cam15-test1'});await settle();await settle()
 assert.equal(p.data.sourceReviewRequired,true);assert.equal(p.data.items[0].prompt,'Old pair prompt 1');assert.equal(p.data.items[1].photo,'/owned/pair-task2.jpg');assert.equal(p.data.feedback,'Old pair feedback');assert.equal(starts,0);assert.equal(polls,0);assert.equal(p.__clock,null,'an unconfirmed replacement pair cannot start a fresh 60-minute clock')
 p.viewSourceUpdate();p.confirmSourceUpdate();assert.ok(p.__clock);assert.equal(p.data.items[0].text,'Old essay 1');assert.equal(p.data.items[1].photo,'/owned/pair-task2.jpg');assert.equal(p.data.feedback,'')
 p.onHide();const confirmed=r.storage.get(key),archives=r.load('utils/writingSourceArchive').listWritingSourceArchives(p.__scope,'guest',0)
 assert.ok(confirmed.sourceArchiveRef?.archiveId);assert.equal(confirmed.sourceArchive,undefined);assert.equal(archives.total,1);assert.equal(archives.items[0].jobId,'old-pair-job');assert.equal(archives.items[0].items[0].text,'Old essay 1');assert.equal(archives.items[0].items[1].photo,'/owned/pair-task2.jpg')
 await p.submit();assert.equal(starts,1);assert.deepEqual(Array.from(sent,item=>item.sourceRevision),[CURRENT,SECOND]);p.onUnload()
}

// Three consecutive source corrections retain three independent revision archives without putting history in setData.
{
 const revisions=[OLD,CURRENT,SECOND,FOURTH];let current=1
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{getIeltsTask:async()=>task(1,revisions[current])},
  'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}},
  'utils/ieltsWriting':{startWritingFeedback:async()=>{throw new Error('no grading during archive test')}},
 }})
 const scope='ielts-writing:'+task(1).id,key='stemistDraft:'+scope
 r.storage.set(key,{owner:'guest',epoch:0,inputMode:'photo',text:'Archive essay A',photoPath:'/owned/archive-a.jpg',prompt:'Archive prompt A',answer:'Archive feedback A',jobId:'archive-job-a',sourceAvailability:'ready',sourceRevision:revisions[0]})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});await settle()
 for(let index=0;index<3;index++){
  assert.equal(p.data.sourceReviewRequired,true);p.viewSourceUpdate();p.confirmSourceUpdate();assert.equal(p.data.sourceRevision,revisions[index+1])
  if(index===2)break
  const label=String.fromCharCode(66+index)
  p.setData({text:'Archive essay '+label,photoPath:'/owned/archive-'+label.toLowerCase()+'.jpg',prompt:'Archive prompt '+label,answer:'Archive feedback '+label,sourceRevision:revisions[index+1],sourceAvailability:'ready'});p.__jobId='archive-job-'+label.toLowerCase();p.saveDraft();p.onHide();current=index+2;await p.loadTask({refresh:true})
 }
 p.onHide();const archiveApi=r.load('utils/writingSourceArchive'),history=archiveApi.listWritingSourceArchives(scope,'guest',0)
 assert.equal(history.total,3);assert.equal(history.pageCount,1)
 const byRevision=Object.fromEntries(history.items.map(item=>[item.sourceRevision,item]))
 for(const [index,label] of ['A','B','C'].entries()){const item=byRevision[revisions[index]];assert.equal(item.text,'Archive essay '+label);assert.equal(item.photoPath,'/owned/archive-'+label.toLowerCase()+'.jpg');assert.equal(item.feedback,'Archive feedback '+label);assert.equal(item.jobId,'archive-job-'+label.toLowerCase())}
 assert.doesNotMatch(JSON.stringify(p.data),/Archive feedback A|Archive feedback B/);assert.doesNotMatch(JSON.stringify(r.storage.get(key)),/Archive feedback A|Archive feedback B/,'main draft stores only a lightweight archive reference');p.onUnload()
}

// Storage capacity/write failure leaves the old source binding fully active and unconfirmed.
{
 const r=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:async()=>task(1)},'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}}}})
 const scope='ielts-writing:'+task(1).id,key='stemistDraft:'+scope
 r.storage.set(key,{owner:'guest',epoch:0,inputMode:'typed',text:'Capacity-safe essay',prompt:'Capacity-safe old prompt',answer:'Capacity-safe feedback',jobId:'capacity-old-job',sourceAvailability:'ready',sourceRevision:OLD})
 r.wx.getStorageInfoSync=()=>({keys:[...r.storage.keys()],currentSize:10239,limitSize:10240})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});await settle();p.viewSourceUpdate();p.confirmSourceUpdate()
 assert.equal(p.data.sourceReviewRequired,true);assert.equal(p.data.sourcePreview,true);assert.equal(p.data.sourceRevision,OLD);assert.equal(p.data.prompt,'Capacity-safe old prompt');assert.equal(p.data.text,'Capacity-safe essay');assert.equal(p.data.answer,'Capacity-safe feedback');assert.equal(p.__jobId,'capacity-old-job');assert.match(p.data.error,/空间|保存/)
 assert.equal([...r.storage.keys()].some(name=>name.includes('writing-source-archive')),false);p.onUnload()
}

// Full Writing also keeps three independent pair revisions rather than truncating a nested snapshot.
{
 const revisionPairs=[[OLD,OLD],[CURRENT,SECOND],[SECOND,FOURTH],[FOURTH,FIFTH]];let generation=1
 const currentTasks=()=>[task(1,revisionPairs[generation][0]),task(2,revisionPairs[generation][1])]
 const real=miniRuntime().load('utils/ieltsWriting')
 const r=miniRuntime({modules:{
  'utils/ieltsContent':{loadIeltsContent:async()=>({writing:currentTasks()}),getIeltsTask:async(_module,id)=>currentTasks().find(item=>item.id===id)},
  'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}},
  'utils/ieltsWriting':{writingPairs:real.writingPairs,startWritingPairFeedback:async()=>{throw new Error('no grading during archive test')}},
 }})
 const scope='writing-pair:guest:cam15-test1',key='stemistDraft:'+scope
 r.storage.set(key,{items:[{text:'Pair essay A1',photo:'',inputMode:'typed',prompt:'Pair prompt A1',sourceRevision:OLD,sourceAvailability:'ready'},{text:'',photo:'/owned/pair-a2.jpg',inputMode:'photo',prompt:'Pair prompt A2',sourceRevision:OLD,sourceAvailability:'ready'}],jobId:'pair-archive-job-a',feedback:'Pair feedback A',sourceAvailability:'ready'})
 const p=r.page('pages/ielts/writing-full');p.onLoad({pairId:'cam15-test1'});await settle();await settle()
 for(let index=0;index<3;index++){
  assert.equal(p.data.sourceReviewRequired,true);p.viewSourceUpdate();p.confirmSourceUpdate();assert.deepEqual(Array.from(p.data.items,item=>item.sourceRevision),revisionPairs[index+1])
  if(index===2)break
  const label=String.fromCharCode(66+index),items=p.data.items.map((item,slot)=>({...item,text:slot?'':'Pair essay '+label+'1',photo:slot?'/owned/pair-'+label.toLowerCase()+'2.jpg':'',inputMode:slot?'photo':'typed',prompt:'Pair prompt '+label+(slot+1)}))
  p.setData({items,feedback:'Pair feedback '+label});p.__jobId='pair-archive-job-'+label.toLowerCase();p.save();p.onHide();generation=index+2;await p.load()
 }
 p.onHide();const history=r.load('utils/writingSourceArchive').listWritingSourceArchives(scope,'guest',0)
 assert.equal(history.total,3);const byFirstRevision=Object.fromEntries(history.items.map(item=>[item.sourceRevisions[0],item]));for(const [index,label] of ['A','B','C'].entries()){const item=byFirstRevision[revisionPairs[index][0]];assert.equal(item.feedback,'Pair feedback '+label);assert.equal(item.jobId,'pair-archive-job-'+label.toLowerCase());assert.equal(item.items[1].photo,'/owned/pair-'+label.toLowerCase()+'2.jpg')}
 assert.doesNotMatch(JSON.stringify(r.storage.get(key)),/Pair feedback A|Pair feedback B/);p.onUnload()
}

// Archive indexes page forward without deleting the oldest revisions.
{
 const r=miniRuntime(),api=r.load('utils/writingSourceArchive'),scope='ielts-writing:archive-pagination'
 for(let index=0;index<api.PAGE_SIZE+2;index++)api.archiveWritingSource(scope,'guest',0,{sourceRevision:index.toString(16).padStart(64,'0'),text:'archive-'+index})
 const newest=api.listWritingSourceArchives(scope,'guest',0,{page:0}),oldest=api.listWritingSourceArchives(scope,'guest',0,{page:1})
 assert.equal(newest.total,api.PAGE_SIZE+2);assert.equal(newest.pageCount,2);assert.equal(newest.items.length,2);assert.equal(oldest.items.length,api.PAGE_SIZE)
 assert.equal(new Set([...newest.items,...oldest.items].map(item=>item.text)).size,api.PAGE_SIZE+2,'pagination must retain every archive without a silent count cap')
 const largeScope='ielts-writing:archive-too-large';assert.throws(()=>api.archiveWritingSource(largeScope,'guest',0,{sourceRevision:OLD,text:'x'.repeat(api.MAX_RECORD_BYTES)}),/过大/);assert.equal([...r.storage.keys()].some(name=>name.includes(largeScope)),false)
}

// If the independent archive succeeds but the active draft write fails, the visible source never switches.
{
 const r=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:async()=>task(1)},'utils/nativeWritingPhoto':{removeWritingPhoto:()=>{}}}}),scope='ielts-writing:'+task(1).id,key='stemistDraft:'+scope
 r.storage.set(key,{owner:'guest',epoch:0,inputMode:'typed',text:'Transactional essay',prompt:'Transactional old prompt',answer:'Transactional feedback',jobId:'transactional-job',sourceAvailability:'ready',sourceRevision:OLD})
 const p=r.page('pages/ielts/writing');p.onLoad({taskId:task(1).id});await settle();p.onHide();p.viewSourceUpdate()
 const set=r.wx.setStorageSync;r.wx.setStorageSync=(name,value)=>{if(name===key&&value?.sourceArchiveRef)throw new Error('main draft full');return set(name,value)}
 p.confirmSourceUpdate();assert.equal(p.data.sourceReviewRequired,true);assert.equal(p.data.sourceRevision,OLD);assert.equal(p.data.prompt,'Transactional old prompt');assert.equal(p.data.text,'Transactional essay');assert.equal(p.data.answer,'Transactional feedback');assert.equal(p.__jobId,'transactional-job');assert.match(p.data.error,/尚未切换/)
 assert.equal(r.storage.get(key).sourceRevision,OLD);assert.equal(r.load('utils/writingSourceArchive').listWritingSourceArchives(scope,'guest',0).total,1,'the independently completed archive remains readable');p.onUnload()
}

// A real existing archiveId is a collision: retrying cannot overwrite the stored record.
{
 const fixedMath=Object.create(Math);fixedMath.random=()=>0.5
 const r=miniRuntime({globals:{Date:{now:()=>1000},Math:fixedMath}}),api=r.load('utils/writingSourceArchive'),scope='ielts-writing:archive-collision'
 const first=api.archiveWritingSource(scope,'guest',0,{sourceRevision:OLD,text:'first immutable archive'})
 assert.throws(()=>api.archiveWritingSource(scope,'guest',0,{sourceRevision:OLD,text:'must not overwrite'}),/冲突/)
 const history=api.listWritingSourceArchives(scope,'guest',0);assert.equal(history.total,1);assert.equal(history.items[0].archiveId,first.archiveId);assert.equal(history.items[0].text,'first immutable archive')
}

// Full/random exams exclude unreviewed sources and refuse stale completed modules before job creation.
{
 const source={book:15,test:1,title:'Cambridge 15 Test 1'}
 const readyWriting=[{...source,...task(1)},{...source,...task(2,SECOND)}]
 const bank={listening:[{...source,id:'cam15-l-test1'}],reading:[{...source,id:'cam15-r-test1'}],writing:readyWriting,speaking:[{...source,id:'cam15-s-test1'}]}
 let starts=0
 const r=miniRuntime({modules:{'utils/ieltsContent':{loadIeltsContent:async()=>bank},'utils/ieltsWriting':{startWritingFeedback:async()=>{starts++;return 'exam-job'},writingJob:async()=>({status:'done'})},'utils/ieltsLearning':{requestIeltsLearning:async()=>({feedback:'report',mode:'ai'})}}})
 const api=r.load('utils/nativeExam');assert.equal(api.completeSets(bank).length,1)
 assert.equal(api.completeSets({...bank,writing:[{...readyWriting[0],sourceAvailability:'pending-review'},readyWriting[1]]}).length,0)
 assert.equal(api.completeSets({...bank,writing:readyWriting.map(({sourceRevision,...item})=>item)}).length,0,'stale catalog entries cannot form a full exam')
 const exam={key:'stale-exam',owner:'guest',epoch:0,context:'random-exam',sources:{writing:readyWriting.map(item=>item.id)},modules:{listening:{complete:true,submission:{}},reading:{complete:true,submission:{}},writing1:{complete:true,prompt:'P1',essay:'E1'},writing2:{complete:true,prompt:'P2',essay:'E2'},speaking:{complete:true}},submitted:false}
 api.saveExam(exam);await assert.rejects(()=>api.submitExam(exam.key),/来源|更新|核验/);assert.equal(starts,0)
 const revised={...exam,key:'revised-exam',writingJobs:['old-owned-job'],writingJobRevisions:[OLD],modules:{...exam.modules,writing1:{complete:true,prompt:'Old exam prompt',essay:'Preserved exam essay',photoPath:'/owned/exam.jpg',sourceAvailability:'ready',sourceRevision:OLD}}}
 api.saveExam(revised);api.completeExamModule(revised.key,'writing1',{complete:true,prompt:'Current canonical prompt 1',essay:'Preserved exam essay',photoPath:'/owned/exam.jpg',sourceAvailability:'ready',sourceRevision:CURRENT})
 const stored=api.readExam(revised.key);assert.equal(stored.writingSourceHistory[0].jobId,'old-owned-job');assert.equal(stored.writingSourceHistory[0].value.prompt,'Old exam prompt');assert.equal(stored.writingSourceHistory[0].value.photoPath,'/owned/exam.jpg')
}

const root=path.resolve(import.meta.dirname,'..')
const singleWxml=fs.readFileSync(path.join(root,'pages/ielts/writing.wxml'),'utf8')
const pairWxml=fs.readFileSync(path.join(root,'pages/ielts/writing-full.wxml'),'utf8')
for(const source of [singleWxml,pairWxml]){
 assert.match(source,/bindtap="viewSourceUpdate"/)
 assert.match(source,/bindtap="confirmSourceUpdate"/)
 assert.match(source,/sourceReviewRequired/)
}

console.log('Writing source guard: authoritative metadata, old draft/photo/job preservation, explicit confirmation, fail-closed grading, pair and exam propagation passed.')
