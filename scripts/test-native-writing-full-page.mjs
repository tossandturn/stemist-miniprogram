import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const tasks=[1,2].map(number=>({id:'cam15-w-test1-task'+number,prompt:'Task '+number+' canonical prompt',images:[]}))
let sent, starts=0
const real=miniRuntime().load('utils/ieltsWriting')
const r=miniRuntime({modules:{
 'utils/ieltsContent':{loadIeltsContent:async()=>({writing:tasks}),getIeltsTask:async(module,id)=>tasks.find(task=>task.id===id)},
 'utils/image':{readAsJpegDataUrl:async()=>'data:image/jpeg;base64,fixture'},
 'utils/ieltsWriting':{writingPairs:real.writingPairs,startWritingPairFeedback:async items=>{starts++;sent=items;return 'pair-job-fixture'},writingJob:async()=>({status:'done',result:{ai:true,gradeReady:true,feedback:'Combined feedback',band:7,taskScores:[],warning:'',reportUrl:'/api/report/pdf/fixture'}})}
}})
let p=r.page('pages/ielts/writing-full');p.onLoad({pairId:'cam15-test1'});await settle()
assert.equal(p.data.items.length,2);const deadline=p.__clock.deadlineAt
p.input({currentTarget:{dataset:{index:0}},detail:{value:'My Task 1 essay.'}})
p.input({currentTarget:{dataset:{index:1}},detail:{value:'My independent Task 2 essay.'}})
p.onUnload();p=r.page('pages/ielts/writing-full');p.onLoad({pairId:'cam15-test1'});await settle()
assert.equal(p.__clock.deadlineAt,deadline);assert.equal(p.data.items[0].text,'My Task 1 essay.');assert.match(p.data.items[1].text,/Task 2/)
r.storage.set('stemistWritingPhoto','/owned/photo-task2.jpg');r.storage.set('stemistWritingPhotoMeta',{owner:'guest',epoch:0,scope:p.__scope,slot:1});p.onShow()
assert.equal(p.data.items[0].photo,'');assert.equal(p.data.items[1].photo,'/owned/photo-task2.jpg')
await p.submit();assert.equal(sent.length,2);assert.equal(sent[0].id,tasks[0].id);assert.equal(sent[1].essay,'');assert.equal(sent[1].imageDataUrls[0],'data:image/jpeg;base64,fixture','the photograph itself reaches grading without an OCR detour');assert.equal(p.data.band,7)
p.onUnload();p=r.page('pages/ielts/writing-full');p.onLoad({pairId:'cam15-test1'});await settle()
assert.equal(p.data.feedback,'Combined feedback')
assert.equal(p.data.reportUrl,'/api/report/pdf/fixture','restored feedback retains the matching report')
assert.equal(p.data.phase,'done')
await p.submit();assert.equal(starts,1,'reopening a result cannot submit or charge again')
p.input({currentTarget:{dataset:{index:0}},detail:{value:'Silent change'}})
assert.equal(p.data.items[0].text,'My Task 1 essay.','a scored attempt is immutable until an explicit new practice')
p.onUnload()
console.log('Native full Writing: separate essays/photos, one restored clock, paired submission and feedback recovery passed.')
