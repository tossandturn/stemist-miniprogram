import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

const qp={id:'ap-calc-ab-2025-frq-qp',name:'AP_Calculus_AB_2025_FRQ_QP.pdf',bytes:2048,pages:4,sha256:'a'.repeat(64),downloadUrl:'/api/stem/curriculum-papers/files/ap-calc-ab-2025-frq-qp',sourceUrl:'https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam',availability:'downloadable'}
const ms={id:'ap-calc-ab-2025-frq-ms',name:'AP_Calculus_AB_2025_FRQ_MS.pdf',bytes:1024,pages:8,sha256:'b'.repeat(64),downloadUrl:'/api/stem/curriculum-papers/files/ap-calc-ab-2025-frq-ms',sourceUrl:'https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam',availability:'downloadable'}
const item={id:'ap-calc-ab-2025-frq',board:'ap',course:'ap-calculus-ab',courseLabel:'AP Calculus AB',subject:'Mathematics',level:'AP',year:2025,session:'May',paper:'FRQ',variant:'',title:'2025 AP Calculus AB Free-Response Questions',section:'Section II',fullExam:false,practiceReady:false,availability:'downloadable',questionPaper:qp,markScheme:ms,pairStatus:'verified',notice:'Official public source'}
const sourceOnly={...item,id:'ap-statistics-2024-frq',course:'ap-statistics',courseLabel:'AP Statistics',year:2024,title:'2024 AP Statistics Free-Response Questions',availability:'source-only',questionPaper:{...qp,id:'ap-statistics-2024-frq-qp',name:'AP_Statistics_2024_FRQ_QP.pdf',downloadUrl:null,availability:'source-only'},markScheme:null,pairStatus:'missing',notice:'公开分发授权尚未确认'}
const ibItem={...item,id:'ib-math-aa-hl-2023-tz1',board:'ib',course:'math-aa-hl',courseLabel:'IB Mathematics AA HL',level:'HL',year:2023,session:'May',paper:'Paper 1',variant:'TZ1',title:'Mathematics AA HL Paper 1',practiceReady:false,availability:'source-only',questionPaper:{...qp,id:'ib-math-aa-hl-2023-tz1-qp',name:'IB_Math_AA_HL_2023_May_P1_TZ1_QP.pdf',downloadUrl:null,sourceUrl:null,availability:'source-only'},markScheme:{...ms,id:'ib-math-aa-hl-2023-tz1-ms',name:'IB_Math_AA_HL_2023_May_P1_TZ1_MS.pdf',downloadUrl:null,sourceUrl:null,availability:'source-only'},pairStatus:'candidate',notice:'公开分发授权尚未确认'}
const response=(overrides={})=>({schemaVersion:'curriculum-papers-v1',board:'ap',courses:[{id:'ap-calculus-ab',label:'AP Calculus AB',subject:'Mathematics'},{id:'ap-statistics',label:'AP Statistics',subject:'Mathematics'}],filters:{levels:['AP'],years:[2025,2024],sessions:['May'],papers:['FRQ']},total:2,page:1,pageSize:20,pages:1,items:[item,sourceOnly],summary:{papers:2,downloadable:1,sourceOnly:1},...overrides})

{
 const calls=[]
 const r=miniRuntime({modules:{'utils/api':{getJson:async(path,options)=>{calls.push({path,options});return response()}},'utils/apiOrigin':{DEFAULT_API_BASE:'https://stem.ieltsist.com',safeApiBase:()=>''}}})
 const service=r.load('bundles/curricula/service')
 const result=await service.fetchCurriculumPapers({board:'ap',course:'ap-calculus-ab',level:'AP',year:'2025',session:'May',paper:'FRQ',query:'limits and continuity',page:2})
 assert.equal(calls[0].path,'/api/stem/curriculum-papers?board=ap&course=ap-calculus-ab&level=AP&year=2025&session=May&paper=FRQ&query=limits%20and%20continuity&page=2&pageSize=20')
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options)),{timeout:12000,stemAuth:false})
 assert.equal(result.items[0].questionPaper.downloadUrl,'https://stem.ieltsist.com/api/stem/curriculum-papers/files/ap-calc-ab-2025-frq-qp')
 assert.equal(result.items[1].questionPaper.downloadUrl,'')
 assert.equal(result.items[1].practiceReady,false)
 await assert.rejects(()=>service.fetchCurriculumPapers({board:'cie'}),error=>error.code==='invalid_board')
 assert.equal(calls.length,1,'Unknown boards must never fall back to the CIE catalog')
 assert.throws(()=>service.normalizeResponse(response({board:'ib'}),'ap'),/体系不匹配/)
 assert.throws(()=>service.normalizeResponse(response({items:[{...item,practiceReady:true}]}),'ap'),/练习状态/)
 assert.equal(service.safeSourceUrl('https://apcentral.collegeboard.org/example?course=ab'),'https://apcentral.collegeboard.org/example?course=ab')
 assert.equal(service.safeSourceUrl('https://user:secret@example.com/private'),'')
 const normalizedIb=service.normalizeResponse({...response(),board:'ib',courses:[{id:'math-aa-hl',label:'IB Mathematics AA HL',subject:'Mathematics'}],items:[ibItem]},'ib')
 assert.equal(normalizedIb.items[0].variant,'TZ1')
}

function pageRuntime({board='ap',fetchResult=response(),fetchError=null}={}){
 const calls=[],opens=[],scopes=[],clipboard=[]
 let onPdfState=()=>{}
 const service={
  KNOWN_BOARDS:{ap:'AP',ib:'IB'},
  fetchCurriculumPapers:async filters=>{calls.push({...filters});if(fetchError)throw fetchError;return typeof fetchResult==='function'?fetchResult(filters):fetchResult},
 }
 const controller={setScope:value=>scopes.push(value),open:async request=>{opens.push(request);return true},cancel(){},retry(){},toggleCollapsed(){},suspend(){},dispose(){}}
 const r=miniRuntime({
  wx:{setClipboardData:options=>{clipboard.push(options.data);options.success?.({})},showToast(){},pageScrollTo(){}},
  modules:{
   'bundles/curricula/service':service,
   'utils/page':{deviceState:value=>({deviceClass:'device-phone',orientation:'portrait',isTablet:false,...value}),syncDevice(){}},
   'utils/pdfDownload':{formatBytes:value=>value+' B',initialPdfDownloadState:()=>({visible:false,active:false,itemId:''}),createPdfDownloadController:options=>{onPdfState=options.onState;return controller}},
  },
 })
 const page=r.page('bundles/curricula/index')
 return{...r,page,calls,opens,scopes,clipboard,controller,onPdfState:state=>onPdfState(state),load:options=>page.onLoad(options||{board})}
}

{
 const h=pageRuntime();await h.load()
 assert.equal(h.page.data.board,'ap');assert.equal(h.page.data.boardLabel,'AP')
 assert.equal(h.page.data.items.length,2);assert.equal(h.page.data.summary.papers,2)
 assert.equal(h.page.data.items[0].pairLabel,'QP / MS 已核对')
 assert.equal(h.page.data.items[0].canDownloadQp,true);assert.equal(h.page.data.items[0].canDownloadMs,true)
 assert.equal(h.page.data.items[0].displayNotice,'','English backend notices must not leak into student UI')
 assert.equal(h.page.data.items[1].sourceOnly,true);assert.equal(h.page.data.items[1].canDownloadQp,false)
 assert.equal('canPractice' in h.page.data.items[0],false,'Curriculum cards must never create a practice-ready state')
 assert.deepEqual(JSON.parse(JSON.stringify(h.page.data.yearOptions.map(option=>option.value))),['','2025','2024'])
 await h.page.chooseFilter({currentTarget:{dataset:{filter:'year'}},detail:{value:1}})
 assert.equal(h.calls.at(-1).year,'2025');assert.equal(h.calls.at(-1).page,1)
 await h.page.chooseCourse({detail:{value:2}});assert.equal(h.calls.at(-1).course,'ap-statistics')
 h.page.setData({pageNumber:1,pageCount:2});await h.page.nextPage();assert.equal(h.calls.at(-1).page,2)
 h.page.openPdf({currentTarget:{dataset:{id:item.id,kind:'qp'}}});assert.equal(h.opens.length,1);assert.equal(h.opens[0].fileName,qp.name);assert.equal(h.opens[0].label,'AP Calculus AB · 原卷')
 h.page.openPdf({currentTarget:{dataset:{id:sourceOnly.id,kind:'qp'}}});assert.equal(h.opens.length,1,'Source-only records cannot enter the download controller')
 h.page.copySource({currentTarget:{dataset:{id:sourceOnly.id,kind:'qp'}}});assert.equal(h.clipboard[0],qp.sourceUrl)
 const shared=h.page.onShareAppMessage();assert.match(shared.path,/^\/bundles\/curricula\/index\?board=ap/);assert.match(shared.path,/course=ap-statistics/);assert.match(shared.path,/year=2025/);assert.doesNotMatch(shared.path,/query=|ap-calc-ab-2025-frq/)
 const timeline=h.page.onShareTimeline();assert.equal(timeline.query,shared.path.split('?')[1])
 h.page.onHide();h.page.onUnload()
}

{
 const empty=pageRuntime({fetchResult:response({items:[],total:0,summary:{papers:0,downloadable:0,sourceOnly:0}})});await empty.load();assert.equal(empty.page.data.catalog,true);assert.equal(empty.page.data.items.length,0);assert.equal(empty.page.data.error,'')
 const failure=pageRuntime({fetchError:Object.assign(Error('目录服务暂时不可用'),{code:'catalog_unavailable'})});await failure.load();assert.equal(failure.page.data.catalog,false);assert.match(failure.page.data.error,/暂时不可用/);await failure.page.retry();assert.equal(failure.calls.length,2)
 const invalid=pageRuntime();await invalid.load({board:'cie'});assert.equal(invalid.calls.length,0);assert.equal(invalid.page.data.invalidBoard,true);assert.match(invalid.page.data.error,/首页/)
 const ib=pageRuntime({board:'ib',fetchResult:{...response(),board:'ib',courses:[{id:'math-aa-hl',label:'IB Mathematics AA HL',subject:'Mathematics'}],items:[ibItem],total:1,summary:{papers:1,downloadable:0,sourceOnly:1}}});await ib.load();assert.equal(ib.page.data.items[0].pairLabel,'答案关联待核对');assert.equal(ib.page.data.items[0].variantNote,'版本标签沿用来源文件');assert.equal(ib.page.data.items[0].qpSourceUrl,'');assert.equal(ib.page.data.items[0].hasMarkScheme,true);assert.match(ib.page.data.items[0].displayNotice,/公开分发授权/);ib.page.onUnload()
}

const root=new URL('..',import.meta.url)
const wxml=fs.readFileSync(new URL('bundles/curricula/index.wxml',root),'utf8')
const pageSource=fs.readFileSync(new URL('bundles/curricula/index.js',root),'utf8')
const config=JSON.parse(fs.readFileSync(new URL('bundles/curricula/index.json',root),'utf8'))
assert.doesNotMatch(wxml,/开始练习|已下载/)
assert.match(wxml,/资料已整理，暂未开放下载/)
assert.match(pageSource,/版本标签沿用来源文件/)
assert.match(pageSource,/复制 AP 官方链接/);assert.match(pageSource,/复制来源链接/)
assert.match(wxml,/<pdf-download-progress/)
assert.match(wxml,/role="alert"/)
assert.equal(config.usingComponents['pdf-download-progress'],'/components/pdf-download-progress/index')
console.log('AP/IB curriculum client: contract, board isolation, filters, pagination, empty/error, truthful availability, secure PDF, sharing and UI passed.')
