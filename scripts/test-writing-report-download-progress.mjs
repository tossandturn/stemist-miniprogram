import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'

function fixture(){
 let alive=true,reportUrl='/api/report/pdf/writing-fixture',throwSetData=false
 const downloads=[],opens=[],patches=[]
 const runtime=miniRuntime({wx:{
  downloadFile(options){const task={options,aborts:0,off:0,progress:null,onProgressUpdate(listener){this.progress=listener},offProgressUpdate(listener){if(this.progress===listener)this.off++},abort(){this.aborts++}};downloads.push(task);return task},
  openDocument(options){opens.push(options)},
 }})
 const page={data:{reportUrl,downloading:false,reportDownload:null,error:''},setData(patch){if(throwSetData){throwSetData=false;throw Error('synthetic setData failure')}patches.push(patch);Object.assign(this.data,patch)}}
 const {createWritingReportDownload}=runtime.load('pages/ielts/writingReportDownload')
 const controller=createWritingReportDownload(page,{origin:'https://ieltsist.com',current:()=>alive,reportUrl:()=>reportUrl,label:'批改报告'})
 return{runtime,page,controller,downloads,opens,patches,setAlive:value=>{alive=value},setReportUrl:value=>{reportUrl=value;page.data.reportUrl=value},throwNextSetData:()=>{throwSetData=true}}
}

{
 const h=fixture()
 assert.equal(h.controller.start(),true)
 assert.equal(h.downloads.length,1)
 assert.equal(h.downloads[0].options.url,'https://ieltsist.com/api/report/pdf/writing-fixture')
 assert.equal(h.downloads[0].options.header,undefined,'IELTS report download never attaches the STEM bearer')
 assert.equal(h.page.data.reportDownload.phase,'connecting')
 assert.equal(h.page.data.reportDownload.knownTotal,false)
 assert.equal(h.page.data.reportDownload.canCancel,true)
 h.downloads[0].progress({totalBytesWritten:512,totalBytesExpectedToWrite:0,progress:73})
 assert.equal(h.page.data.reportDownload.phase,'downloading')
 assert.equal(h.page.data.reportDownload.downloadedBytes,512)
 assert.equal(h.page.data.reportDownload.percent,null,'unknown total never trusts a standalone SDK percentage')
 h.downloads[0].progress({totalBytesWritten:512,totalBytesExpectedToWrite:1024,progress:50})
 await new Promise(resolve=>setTimeout(resolve,180))
 assert.equal(h.page.data.reportDownload.percent,50)
 assert.equal(h.page.data.reportDownload.downloadedLabel,'512 B')
 assert.equal(h.page.data.reportDownload.totalLabel,'1.0 KB')
 h.downloads[0].options.success({statusCode:200,tempFilePath:'/tmp/writing-report.pdf'})
 assert.equal(h.opens.length,1)
 assert.equal(h.page.data.reportDownload.phase,'opening')
 assert.equal(h.page.data.reportDownload.percent,99,'network completion is capped until the viewer confirms opening')
 h.opens[0].success({})
 assert.equal(h.page.data.reportDownload.phase,'ready')
 assert.equal(h.page.data.reportDownload.percent,100)
 assert.equal(h.page.data.downloading,false)
 const ready=JSON.stringify(h.page.data.reportDownload)
 assert.equal(h.controller.pause(),false)
 assert.equal(JSON.stringify(h.page.data.reportDownload),ready,'onHide after a completed open does not replace ready with a zero-byte pause')
}

{
 const h=fixture();h.controller.start();const first=h.downloads[0]
 first.progress({totalBytesWritten:333,totalBytesExpectedToWrite:1000})
 first.progress({totalBytesWritten:222,totalBytesExpectedToWrite:900})
 h.controller.cancel()
 assert.equal(first.aborts,1)
 assert.equal(first.off,1)
 assert.equal(h.page.data.reportDownload.phase,'paused')
 assert.equal(h.page.data.reportDownload.downloadedBytes,333,'pause preserves the latest monotonic measured bytes')
 assert.equal(h.page.data.reportDownload.totalBytes,1000)
 assert.equal(h.page.data.reportDownload.canRetry,true)
 first.progress?.({totalBytesWritten:900,totalBytesExpectedToWrite:1000})
 first.options.success({statusCode:200,tempFilePath:'/tmp/late.pdf'})
 assert.equal(h.page.data.reportDownload.phase,'paused','late callbacks after cancel cannot overwrite the paused state')
 assert.equal(h.opens.length,0)
 assert.equal(h.controller.retry(),true)
 assert.equal(h.downloads.length,2)
}

{
 const h=fixture();h.controller.start();const first=h.downloads[0]
 h.setReportUrl('/api/report/pdf/new-report');h.controller.reset();assert.equal(first.aborts,1)
 assert.equal(h.controller.start(),true);const second=h.downloads[1],snapshot=JSON.stringify(h.page.data.reportDownload)
 assert.equal(second.options.url,'https://ieltsist.com/api/report/pdf/new-report')
 first.progress?.({totalBytesWritten:1000,totalBytesExpectedToWrite:1000});first.options.success({statusCode:200,tempFilePath:'/tmp/old.pdf'})
 assert.equal(JSON.stringify(h.page.data.reportDownload),snapshot,'report A late callbacks cannot overwrite active report B state')
 assert.equal(h.opens.length,0)
}

{
 const h=fixture();h.controller.start();const task=h.downloads[0],before=h.patches.length
 for(let bytes=10;bytes<=200;bytes+=10)task.progress({totalBytesWritten:bytes,totalBytesExpectedToWrite:1000})
 assert.ok(h.patches.length<=before+1,'high-frequency SDK progress is coalesced instead of calling setData for every event')
 task.options.success({statusCode:200,tempFilePath:'/tmp/coalesced.pdf'})
 assert.equal(h.page.data.reportDownload.phase,'opening')
 assert.equal(h.page.data.reportDownload.downloadedBytes,1000,'terminal transition flushes the known completed byte count')
 assert.equal(h.page.data.reportDownload.percent,99)
}

for(const mode of ['hidden','unloaded','owner-changed','report-changed']){
 const h=fixture();h.controller.start();const task=h.downloads[0]
 if(mode==='hidden')h.controller.pause()
 if(mode==='unloaded')h.controller.dispose()
 if(mode==='owner-changed')h.setAlive(false)
 if(mode==='report-changed')h.setReportUrl('/api/report/pdf/new-report')
 const snapshot=JSON.stringify(h.page.data.reportDownload)
 task.progress?.({totalBytesWritten:800,totalBytesExpectedToWrite:1000})
 task.options.success({statusCode:200,tempFilePath:'/tmp/stale.pdf'})
 assert.equal(JSON.stringify(h.page.data.reportDownload),snapshot,`${mode} late callbacks must be ignored`)
 assert.equal(h.opens.length,0)
}

{
 const h=fixture();h.controller.start();const task=h.downloads[0]
 h.throwNextSetData()
 assert.doesNotThrow(()=>task.progress({totalBytesWritten:300,totalBytesExpectedToWrite:1000}))
 assert.equal(task.aborts,1,'a synchronous state publication failure aborts and clears the active task')
 task.options.success({statusCode:200,tempFilePath:'/tmp/must-not-open.pdf'})
 assert.equal(h.opens.length,0)
}

{
 const h=fixture();h.controller.start();h.downloads[0].options.success({statusCode:403,tempFilePath:'/tmp/error.pdf'})
 assert.equal(h.page.data.reportDownload.phase,'error')
 assert.equal(h.page.data.reportDownload.canRetry,true)
 assert.match(h.page.data.reportDownload.error,/失效/)
}

for(const base of ['writing','writing-full']){
 const js=fs.readFileSync(new URL(`../pages/ielts/${base}.js`,import.meta.url),'utf8')
 const wxml=fs.readFileSync(new URL(`../pages/ielts/${base}.wxml`,import.meta.url),'utf8')
 const json=JSON.parse(fs.readFileSync(new URL(`../pages/ielts/${base}.json`,import.meta.url),'utf8'))
 assert.match(js,/createWritingReportDownload/)
 assert.match(js,/cancelReportDownload\(\)/)
 assert.match(js,/retryReportDownload\(\)/)
 assert.match(wxml,/<pdf-download-progress[^>]*state="{{reportDownload}}"[^>]*compact="{{true}}"[^>]*bind:cancel="cancelReportDownload"[^>]*bind:retry="retryReportDownload"/)
 assert.equal(json.usingComponents['pdf-download-progress'],'/components/pdf-download-progress/index')
}

{
 const downloads=[]
 const runtime=miniRuntime({wx:{downloadFile(options){const task={options,aborts:0,onProgressUpdate(){},offProgressUpdate(){},abort(){this.aborts++}};downloads.push(task);return task},openDocument(){} }})
 const page=runtime.page('pages/ielts/writing');page.onLoad({});page.setData({reportUrl:'/api/report/pdf/auth-switch'})
 page.downloadReport();page.onHide();assert.equal(downloads[0].aborts,1);assert.equal(page.data.reportDownload.phase,'paused')
 page.__authResumeRequested=true;runtime.storage.set('stemistSessionToken','synthetic-token');runtime.storage.set('stemistUser',{id:'ielts:new-owner'});page.onShow()
 assert.equal(page.data.reportDownload,null,'guest-to-account recovery clears the previous owner download state')
 assert.equal(page.data.downloading,false)
 page.onUnload()
}

{
 const downloads=[],opens=[]
 const runtime=miniRuntime({wx:{downloadFile(options){const task={options,progress:null,onProgressUpdate(listener){this.progress=listener},offProgressUpdate(){},abort(){}};downloads.push(task);return task},openDocument(options){opens.push(options)}}})
 const page=runtime.page('pages/ielts/writing');page.onLoad({});page.setData({reportUrl:'/api/report/pdf/native-viewer-order'})
 page.downloadReport();downloads[0].progress({totalBytesWritten:1000,totalBytesExpectedToWrite:1000});downloads[0].options.success({statusCode:200,tempFilePath:'/tmp/native-viewer.pdf'})
 assert.equal(page.data.reportDownload.phase,'opening');assert.equal(page.data.reportDownload.percent,99);assert.equal(opens.length,1)
 page.onHide()
 assert.equal(page.data.reportDownload.phase,'opening','native viewer onHide does not turn a completed download into paused')
 opens[0].success({});page.onShow()
 assert.equal(page.data.reportDownload.phase,'ready')
 assert.equal(page.data.reportDownload.percent,100)
 assert.equal(page.data.downloading,false)
 assert.equal(downloads.length,1,'returning from the native viewer does not redownload the report')
 page.onUnload()
}

console.log('Writing report downloads: measured bytes, unknown totals, open confirmation, pause/retry and stale-callback guards passed.')
