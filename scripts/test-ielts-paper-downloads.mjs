import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const qp={id:'ielts-cam21-l-test1-qp',sourceId:'cam21-l-test1',book:21,test:1,module:'listening',kind:'qp',title:'Cambridge 21 Test 1',fileName:'Cambridge_IELTS_21_Test_1_Listening_Question_Paper.pdf',sha256:'a'.repeat(64),bytes:10240,pages:6,answerStatus:'available'}
qp.url='/api/stem/ielts-papers/files/'+qp.id
const ak={...qp,id:'ielts-cam21-l-test1-ak',kind:'ak',sha256:'b'.repeat(64),bytes:1200,pages:2,fileName:'Cambridge_IELTS_21_Test_1_Listening_Answer_Key.pdf'};ak.url='/api/stem/ielts-papers/files/'+ak.id
const source={schemaVersion:'ielts-paper-downloads-v1',version:'c'.repeat(24),items:[qp,ak]}
let opened,disposed=0
const r=miniRuntime({modules:{
 'utils/api':{getJson:async()=>source},
 'utils/nativeSession':{refreshNativeSession:async()=>{}},
 'utils/pdfDownload':{formatBytes:v=>v+' B',initialPdfDownloadState:()=>({active:false}),createPdfDownloadController:()=>({setScope(){},open:async v=>{opened=v;return true},dispose(){disposed++},resume(){},suspend(){}})},
}})
const service=r.load('bundles/curricula/ieltsPaperService'),catalog=service.parseCatalogue(source)
assert.equal(catalog.items.length,1);assert.equal(catalog.items[0].ak.sha256,'b'.repeat(64))
assert.throws(()=>service.parseCatalogue({...source,items:[{...qp,url:'https://other.invalid/file'}]}))
const page=r.page('bundles/curricula/ieltsPapers');await page.onLoad({});assert.equal(page.data.book,21);assert.equal(page.data.items.length,1)
await page.openPdf({currentTarget:{dataset:{id:qp.sourceId,kind:'ak'}}});assert.equal(opened,undefined);assert.ok(r.calls.some(x=>x.url==='/pages/account/auth'))
r.storage.set('stemistUser',{id:'ielts:1'});await page.openPdf({currentTarget:{dataset:{id:qp.sourceId,kind:'ak'}}});assert.equal(opened.sha256,ak.sha256);assert.equal(opened.expectedBytes,ak.bytes);assert.equal(opened.fileName,ak.fileName)
page.chooseModule({currentTarget:{dataset:{module:'writing'}}});assert.equal(page.data.items.length,0);page.onUnload();assert.equal(disposed,1)
const access=miniRuntime().load('utils/pdfRangeCache')
assert.equal(access.pdfAccessHeaders('https://stem.ieltsist.com'+qp.url,'fixture').Authorization,'Bearer fixture')
for(const url of ['https://ieltsist.com'+qp.url,'https://other.invalid'+qp.url,'https://stem.ieltsist.com'+qp.url+'?next=evil','https://stem.ieltsist.com/api/stem/ielts-papers/files/../secret'])assert.equal(access.pdfAccessHeaders(url,'fixture').Authorization,undefined)
console.log('PASS IELTS download page: remote grouped catalogue, question/answer binding, login, original hash/name, filters and scoped auth.')
