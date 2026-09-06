import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
let copied,removed=[],requests=[]
const r=miniRuntime({wx:{env:{USER_DATA_PATH:'/owned'},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile:opts=>{copied=opts.destPath;opts.success()},unlink:opts=>removed.push(opts.filePath)})},modules:{'utils/image':{compressImage:async p=>p,readAsJpegDataUrl:async()=> 'data:image/jpeg;base64,test'},'utils/api':{requestJson:async(path,payload)=>{requests.push({path,payload});return{attempt:{attemptId:payload.attemptId}}}}}})
const papers=r.load('utils/nativePaper'),scope={routeId:'cie-9702-as-physics',stage:'AS'},paper={id:'cie-9702-9702_m25_qp_22',subject:'9702'}
let draft=papers.createPaperDraft(paper,scope);papers.savePaperDraft(draft)
await papers.attachPaperPhoto({storageKey:draft.storageKey,sessionId:draft.id,questionNumber:1},'/camera/one.jpg')
draft=papers.readPaperDraft(draft.storageKey);assert.equal(draft.answers[1].photo,copied);assert.ok(copied.startsWith('/owned/native-paper/'))
await papers.attachPaperPhoto({storageKey:draft.storageKey,sessionId:draft.id,questionNumber:1},'/camera/two.jpg');assert.equal(removed.length,1)
await assert.rejects(()=>papers.attachPaperPhoto({storageKey:draft.storageKey,sessionId:'wrong',questionNumber:1},'/camera/x.jpg'))
const service=r.load('utils/nativePaperService')
await service.syncPaperAttempt(draft,{questions:[]},60)
assert.equal(requests[0].payload.mode,'full-paper');assert.equal(requests[0].payload.attempt.paperStudyMode,'past-paper-practice')
r.storage.set('stemistPrivacyEpoch',1)
assert.equal(papers.readPaperDraft(draft.storageKey),null)
await assert.rejects(()=>papers.attachPaperPhoto({storageKey:draft.storageKey,sessionId:draft.id,questionNumber:1},'/camera/x.jpg'))
const nav=miniRuntime({modules:{'utils/api':{getJson:async()=>({schemaVersion:2,items:[]})}}})
const p=nav.page('pages/papers/index');p.onLoad({category:'competition',subject:'amc12'});await settle()
p.setData({items:[{id:'amc12-test',subject:'amc12',stages:['competition'],routeIds:[],file:'test.pdf'}]})
p.openPaper({currentTarget:{dataset:{id:'amc12-test'}}});assert.ok(nav.calls[0].url.startsWith('/pages/stem/paper?'));assert.doesNotMatch(nav.calls[0].url,/webview/)
console.log('Native paper: photo ownership, durable copy/replacement, full-paper API mode, privacy epoch and competition-native navigation passed.')
