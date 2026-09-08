import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const paper={id:'paper-1',subject:'9702',year:2025,seasonLabel:'夏季',file:'9702_s25_qp_22.pdf',title:'Physics Paper 2',paperNumber:'9702/22',stages:['as'],routeIds:['cie-9702-as-physics'],localUrl:'/local-pdf/9702/9702_s25_qp_22.pdf',markScheme:{localUrl:'/local-pdf/9702/9702_s25_ms_22.pdf'}}
let progressListener=null
let catalogDownloadOptions=null,catalogDownloads=0,catalogAborts=0,catalogOpenCalls=0
const downloadTask={onProgressUpdate(listener){progressListener=listener},offProgressUpdate(){},abort(){catalogAborts++}}
const runtime=miniRuntime({
 wx:{downloadFile(options){catalogDownloads++;catalogDownloadOptions=options;return downloadTask},openDocument(){catalogOpenCalls++}},
 modules:{
  'utils/page':{deviceState:value=>({deviceClass:'device-phone',orientation:'portrait',...value}),syncDevice(){}},
  'utils/paperCatalog':{PAPER_SUBJECTS:[{code:'9702',label:'Physics'}],fetchPaperPage:async()=>({items:[paper],facets:{years:[2025],seasons:[]},total:1,subjectTotal:1,pairedTotal:1,page:1,pageCount:1})},
  'utils/stemCatalog':{normalizeStemCategory:value=>value||'alevel',subjectsForCategory:()=>[{code:'9702',label:'Physics'}],categoryForSubject:()=> 'alevel'},
  'utils/stemRoutes':{STEM_ROUTES:[{subjectCode:'9702',stage:'AS',routeId:'cie-9702-as-physics',components:'P1 + P2'}],routeById:id=>id==='cie-9702-as-physics'?{subjectCode:'9702',stage:'AS',routeId:id,components:'P1 + P2'}:null},
 }
})
const page=runtime.page('pages/papers/index')
await page.onLoad({subject:'9702',stage:'AS',routeId:'cie-9702-as-physics'})
page.openPdf({currentTarget:{dataset:{id:paper.id,kind:'qp'}}})
assert.equal(typeof progressListener,'function','openPdf must register DownloadTask.onProgressUpdate so students see real PDF bytes and progress')
page.openPdf({currentTarget:{dataset:{id:paper.id,kind:'qp'}}});assert.equal(catalogDownloads,1,'repeated taps must not create parallel downloads')
progressListener({progress:100,totalBytesWritten:1000,totalBytesExpectedToWrite:1000})
assert.equal(page.data.pdfDownload.percent,99,'a progress event cannot claim 100% before HTTP 200 success')
page.onSearch({detail:{value:'different scope'}})
assert.equal(catalogAborts,1,'changing the catalog scope must abort the active network download')
catalogDownloadOptions.success({statusCode:200,tempFilePath:'wxfile://late.pdf'})
assert.equal(catalogOpenCalls,0,'a late success from the previous catalog scope must not open a document')
page.setData({mode:'exam-simulation'});page.openPdf({currentTarget:{dataset:{id:paper.id,kind:'ms'}}});assert.equal(catalogDownloads,1,'the catalog must not expose or download a mark scheme during exam simulation')
page.onUnload()

const {createPdfDownloadController,initialPdfDownloadState}=miniRuntime().load('utils/pdfDownload')
assert.deepEqual(Object.keys(initialPdfDownloadState()).sort(),['active','canCancel','canRetry','collapsed','downloadedBytes','downloadedLabel','error','itemId','knownTotal','label','message','ownerKey','percent','phase','totalBytes','totalLabel','visible'].sort())

function manualClock(){
 let time=1000,id=0
 const timers=new Map()
 return {
  now:()=>time,
  setTimer(fn,delay){const key=++id;timers.set(key,{fn,at:time+delay});return key},
  clearTimer(key){timers.delete(key)},
  tick(ms){time+=ms;for(const [key,timer] of [...timers])if(timer.at<=time){timers.delete(key);timer.fn()}},
 }
}

function controllerHarness({openDocument=true,cacheLimit=4}={}){
 const storage=new Map([['stemistUser',{id:'student-1'}],['stemistPrivacyEpoch',3],['stemistSessionToken','session-1']])
 const downloads=[],opens=[],states=[],clock=manualClock()
 let cachedPathExists=true,scope='scope-a'
 const manager={
  access({success,fail}){cachedPathExists?success({}):fail({errMsg:'not found'})},
 }
 const wxApi={
  getStorageSync:key=>storage.get(key),
  getFileSystemManager:()=>manager,
  downloadFile(options){
   const task={options,progress:null,aborted:0,onProgressUpdate(listener){this.progress=listener},offProgressUpdate(listener){if(this.progress===listener)this.progress=null},abort(){this.aborted++}}
   downloads.push(task);return task
  },
 }
 if(openDocument)wxApi.openDocument=options=>opens.push(options)
 const controller=createPdfDownloadController({wxApi,onState:state=>states.push({...state}),isScopeCurrent:value=>value===scope,now:clock.now,setTimer:clock.setTimer,clearTimer:clock.clearTimer,cacheLimit})
 controller.setScope(scope)
 return {controller,downloads,opens,states,storage,clock,wxApi,get state(){return controller.getState()},setScope(value){scope=value;controller.setScope(value)},setCachedPathExists(value){cachedPathExists=value}}
}

const request=(suffix='a')=>({url:`https://stem.ieltsist.com/local-pdf/9702/${suffix}.pdf`,ownerKey:`paper-${suffix}:qp`,itemId:`paper-${suffix}`,label:'原卷',scope:`scope-${suffix}`})

{
 const h=controllerHarness();h.setScope('scope-a')
 await h.controller.open(request('a'))
 const task=h.downloads[0]
 assert.equal(typeof task.progress,'function')
 const before=h.states.length
 const lateProgress=task.progress;task.progress({progress:40,totalBytesWritten:400,totalBytesExpectedToWrite:1000})
 assert.equal(h.state.percent,40);assert.equal(h.state.downloadedBytes,400);assert.equal(h.state.totalBytes,1000);assert.equal(h.state.knownTotal,true)
 h.clock.tick(10);task.progress({progress:75,totalBytesWritten:750,totalBytesExpectedToWrite:1000});task.progress({progress:100,totalBytesWritten:1000,totalBytesExpectedToWrite:1000})
 assert.equal(h.states.length,before+1,'progress setData notifications must be throttled instead of emitting every event')
 h.clock.tick(90);assert.equal(h.state.percent,99);assert.equal(h.state.phase,'downloading')
 task.options.success({statusCode:200,tempFilePath:'wxfile://download-a.pdf'})
 assert.equal(h.state.phase,'opening');assert.equal(h.state.percent,100);assert.match(h.state.message,/正在打开/)
 lateProgress({progress:100,totalBytesWritten:1000,totalBytesExpectedToWrite:1000});assert.equal(h.state.phase,'opening','late progress cannot move an opening document back to downloading')
 assert.equal(h.opens.length,1);h.opens[0].success({});h.opens[0].fail({errMsg:'late failure'});assert.equal(h.state.phase,'opened');assert.equal(h.state.active,false)
 assert.doesNotMatch(JSON.stringify(h.states),/wxfile:|https:\/\/|session-1/,'paths, URLs, credentials and file bodies must stay out of setData state')
}

{
 const h=controllerHarness();h.setScope('scope-u');await h.controller.open(request('u'))
 h.downloads[0].progress({progress:62,totalBytesWritten:262144,totalBytesExpectedToWrite:0})
 assert.equal(h.state.knownTotal,false);assert.equal(h.state.percent,null);assert.equal(h.state.totalLabel,'');assert.match(h.state.downloadedLabel,/KB/)
}

{
 const h=controllerHarness();h.setScope('scope-f');await h.controller.open(request('f'));const task=h.downloads[0]
 task.progress({progress:13,totalBytesWritten:15580,totalBytesExpectedToWrite:117880})
 h.clock.tick(10);task.progress({progress:100,totalBytesWritten:117880,totalBytesExpectedToWrite:117880})
 task.options.success({statusCode:200,tempFilePath:'wxfile://fast-final.pdf'})
 assert.equal(h.state.phase,'opening');assert.equal(h.state.percent,100)
 assert.equal(h.state.downloadedBytes,117880,'HTTP 200 must converge a throttled known-total download to the complete byte count')
 assert.equal(h.state.totalBytes,117880);assert.equal(h.state.downloadedLabel,h.state.totalLabel,'opening must not render a partial byte label beside 100%')
 h.opens[0].success({});assert.equal(h.state.downloadedBytes,117880);assert.equal(h.state.downloadedLabel,h.state.totalLabel,'opened state must retain the normalized complete byte label')
}

{
 const h=controllerHarness();h.setScope('scope-z');await h.controller.open(request('z'));const task=h.downloads[0]
 task.progress({progress:13,totalBytesWritten:15580,totalBytesExpectedToWrite:0})
 h.clock.tick(10);task.progress({progress:100,totalBytesWritten:117880,totalBytesExpectedToWrite:0})
 task.options.success({statusCode:200,tempFilePath:'wxfile://unknown-total.pdf'})
 assert.equal(h.state.downloadedBytes,117880,'HTTP 200 should retain the latest throttled byte count even when total length is unknown')
 assert.equal(h.state.knownTotal,false);assert.equal(h.state.totalBytes,0);assert.equal(h.state.totalLabel,'');assert.equal(h.state.percent,null,'unknown totals must never fabricate a completion percentage')
}

{
 const h=controllerHarness();h.setScope('scope-c');await h.controller.open(request('c'));const task=h.downloads[0]
 h.controller.cancel();assert.equal(task.aborted,1);assert.equal(h.state.phase,'cancelled');assert.equal(h.state.canRetry,true)
 task.options.success({statusCode:200,tempFilePath:'wxfile://late-cancelled.pdf'});assert.equal(h.opens.length,0);assert.equal(h.state.phase,'cancelled')
}

{
 const h=controllerHarness();h.setScope('scope-r');await h.controller.open(request('r'));h.downloads[0].options.success({statusCode:503,tempFilePath:'wxfile://error.pdf'})
 assert.equal(h.state.phase,'error');assert.equal(h.state.canRetry,true);assert.match(h.state.error,/503/);assert.equal(h.opens.length,0)
 await h.controller.retry();assert.equal(h.downloads.length,2,'HTTP failure must expose a real retry that starts a new DownloadTask')
}

{
 const h=controllerHarness();h.setScope('scope-k');const req=request('k');await h.controller.open(req)
 h.downloads[0].options.success({statusCode:200,tempFilePath:'wxfile://cache-k.pdf'});h.opens[0].success({})
 await h.controller.open(req);assert.equal(h.downloads.length,1,'a validated in-memory temp-file cache should open without downloading again');assert.equal(h.opens.length,2);h.opens[1].success({})
 h.setCachedPathExists(false);await h.controller.open(req);assert.equal(h.downloads.length,2,'a missing cached path must be evicted and downloaded again')
}

{
 const h=controllerHarness();h.setScope('scope-o');await h.controller.open(request('o'));h.downloads[0].options.success({statusCode:200,tempFilePath:'wxfile://open-fail.pdf'})
 h.opens[0].fail({errMsg:'openDocument:fail cannot open'});assert.equal(h.state.phase,'error');assert.equal(h.state.canRetry,true);assert.match(h.state.error,/未能打开/);assert.notEqual(h.state.phase,'opened')
 h.setCachedPathExists(true);await h.controller.retry();assert.equal(h.downloads.length,1,'opening failure keeps the valid temp file for a direct retry');assert.equal(h.opens.length,2)
 const simulator=controllerHarness({openDocument:false});simulator.setScope('scope-s');await simulator.controller.open(request('s'));simulator.downloads[0].options.success({statusCode:200,tempFilePath:'wxfile://simulator.pdf'});assert.equal(simulator.state.phase,'error');assert.match(simulator.state.error,/真机微信/)
}

{
 const h=controllerHarness();h.setScope('scope-l');await h.controller.open(request('l'));const first=h.downloads[0]
 h.setScope('scope-next');assert.equal(first.aborted,1);first.options.success({statusCode:200,tempFilePath:'wxfile://late-scope.pdf'});assert.equal(h.opens.length,0)
 await h.controller.open({...request('n'),scope:'scope-next'});const second=h.downloads[1];h.storage.set('stemistUser',{id:'student-2'});second.progress({progress:20,totalBytesWritten:20,totalBytesExpectedToWrite:100});second.options.success({statusCode:200,tempFilePath:'wxfile://late-account.pdf'});assert.equal(second.aborted,1);assert.equal(h.opens.length,0,'an account change must invalidate progress and late success callbacks')
 h.setScope('scope-next');assert.equal(h.state.phase,'idle','the next explicit lifecycle/scope sync clears stale busy UI after an account change')
 h.controller.dispose();assert.equal(h.controller.getState().active,false)
}

{
 const h=controllerHarness({cacheLimit:2});
 for(const key of ['1','2','3']){h.setScope(`scope-${key}`);await h.controller.open(request(key));h.downloads.at(-1).options.success({statusCode:200,tempFilePath:`wxfile://cache-${key}.pdf`});h.opens.at(-1).success({})}
 assert.equal(h.controller.cacheSize(),2,'temporary PDF references must stay in a bounded in-memory cache')
}

{
 let paperDownloads=0,paperOpenCalls=0,paperTask=null
 const draft={storageKey:'paper-draft',id:'mini-paper-fixture',schema:1,index:1,answers:{},startedAt:Date.now(),submitted:false,cloudSynced:false,selfScore:''}
 const paperRuntime=miniRuntime({
  wx:{downloadFile(options){paperDownloads++;paperTask={options,progress:null,aborted:0,onProgressUpdate(fn){this.progress=fn},offProgressUpdate(){},abort(){this.aborted++}};return paperTask},openDocument(){paperOpenCalls++}},
  modules:{
   'utils/page':{deviceState:value=>({deviceClass:'device-phone',orientation:'portrait',...value}),syncDevice(){}},
   'utils/paperCatalog':{fetchPaperDetail:async()=>paper},
   'utils/stemRoutes':{routeById:()=>({routeId:'cie-9702-as-physics',subjectCode:'9702',stage:'AS'})},
   'utils/stemCatalog':{categoryForSubject:()=> 'alevel',familyForCategoryStage:()=> 'exam'},
   'utils/nativePaper':{createPaperDraft:()=>draft,savePaperDraft(){},readPaperDraft:()=>draft,current:()=>true},
   'utils/image':{readAsJpegDataUrl:async()=>''},'utils/coach':{runCoach:async()=>({})},
   'utils/nativePaperService':{paperSources:async()=>({questions:[]}),paperContext:async()=>({questions:[]}),syncPaperAttempt:async()=>{},markPaperQuestion:async()=>{}},
   'utils/nativeRecords':{rememberRecord(){}},
  }
 })
 const p=paperRuntime.page('pages/stem/paper');await p.onLoad({paperId:paper.id,subject:'9702',routeId:'cie-9702-as-physics',mode:'exam-simulation'})
 p.openDocument({currentTarget:{dataset:{kind:'ms'}}});assert.equal(paperDownloads,0,'the mark scheme remains disabled during an unsubmitted exam')
 p.openDocument({currentTarget:{dataset:{kind:'qp'}}});assert.equal(paperDownloads,1);assert.equal(typeof paperTask.progress,'function')
 p.onUnload();assert.equal(paperTask.aborted,1);paperTask.options.success({statusCode:200,tempFilePath:'wxfile://late-unload.pdf'});assert.equal(paperOpenCalls,0)
}

const root=path.resolve(import.meta.dirname,'..')
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
for(const pagePath of ['pages/papers/index','pages/stem/paper']){
 const config=JSON.parse(read(`${pagePath}.json`));assert.equal(config.usingComponents['pdf-download-progress'],'/components/pdf-download-progress/index')
 assert.match(read(`${pagePath}.wxml`),/<pdf-download-progress/)
}
const componentWxml=read('components/pdf-download-progress/index.wxml'),componentWxss=read('components/pdf-download-progress/index.wxss')
assert.match(componentWxml,/bindtap="cancel"/);assert.match(componentWxml,/bindtap="retry"/);assert.match(componentWxml,/收起/);assert.match(componentWxml,/aria-label/)
assert.match(componentWxss,/min-height:\s*44px/);assert.doesNotMatch(componentWxss,/@keyframes|animation\s*:/,'progress must reflect network events, not a fabricated animation')

console.log('PDF download progress: real bytes/percent, throttle, open phase, cancel/retry/cache, lifecycle scope, exam MS gate and inline accessible UI passed.')
