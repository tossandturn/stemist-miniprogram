import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..')
assert.ok(fs.existsSync(path.join(root,'bundles/curricula/ieltsPaperAudio.js')),'Cambridge paper cards need canonical matching audio directly below their PDFs')
const p={id:'cam12-l-test1',book:12,test:5,module:'listening',meta:'听力 · Test 5（站内第 1 套）',title:'Cambridge 12 Test 5',qp:{id:'qp',url:'https://stem.ieltsist.com/api/stem/ielts-papers/files/ielts-cam12-l-test1-qp',pages:4,bytes:1024,sha256:'a'.repeat(64),fileName:'Cambridge_IELTS_12_Test_5_Listening.pdf'},ak:{pages:1,bytes:512,sha256:'b'.repeat(64)}}
const track=(n,extra={})=>({id:'audio-'+String(n).repeat(32),taskId:p.id,book:12,test:5,practiceTest:1,track:n,trackCount:4,bytes:1024,fileName:'Cambridge_IELTS_12_Test_5_Listening_Audio_'+n+'.mp3',sha256:'c'.repeat(64),url:'https://stem.ieltsist.com/api/stem/ielts-audio/files/audio-'+String(n).repeat(32),...extra})
const audio=[track(4),track(2),track(1),track(3),track(5,{taskId:'cam12-l-test2',test:6}),track(6,{book:13}),track(7,{test:1})]
const helper=miniRuntime().load('bundles/curricula/ieltsPaperAudio')
assert.deepEqual(Array.from(helper.tracksForPaper(p,audio),x=>x.track),[1,2,3,4],'join by canonical ID, book and original Test, not practice Test or array position')
assert.equal(helper.tracksForPaper({...p,module:'reading'},audio).length,0)
assert.equal(helper.tracksForPaper({...p,id:'cam12-l-test2',test:5},audio).length,0)
assert.equal(helper.tracksForPaper(p,[track(1),track(2,{trackCount:3})]).length,0,'conflicting original track counts must not be guessed')
assert.deepEqual(Array.from(helper.tracksForPaper(p,[track(3),track(1)]),x=>x.track),[1,3],'keep explicitly available tracks without inventing missing ones')

function harness({audioFetch=async()=>({items:audio,offline:false}),paperFetch=async()=>({items:[p,{...p,id:'reading',module:'reading'}],books:[12]}),pdfReady=async()=>{},profile={windowWidth:375,windowHeight:812,deviceType:'phone',model:'iPhone'}}={}){
 let audioState,pdfState;const calls=[]
 const audioController={setScope:s=>calls.push(['audio-scope',s]),download:async item=>{calls.push(['audio-download',item]);audioState({itemId:item.id,active:true,sharing:false,ready:false,progress:{phase:'downloading'}})},share:()=>calls.push(['audio-share']),retry:()=>calls.push(['audio-retry']),cancel:()=>calls.push(['audio-cancel']),suspend:()=>calls.push(['audio-hide']),dispose:()=>calls.push(['audio-dispose'])}
 const pdfController={setScope:s=>calls.push(['pdf-scope',s]),open:async item=>calls.push(['pdf-open',item]),resume:()=>calls.push(['pdf-resume']),suspend:()=>calls.push(['pdf-hide']),dispose:()=>calls.push(['pdf-dispose']),retry:()=>calls.push(['pdf-retry'])}
 const rt=miniRuntime({wx:{getSystemInfoSync:()=>profile},modules:{'bundles/curricula/ieltsPaperService':{fetchCatalogue:paperFetch,MODULES:{listening:'听力',reading:'阅读'}},'bundles/curricula/ieltsAudioService':{fetchCatalogue:audioFetch},'bundles/curricula/audioDownload':{createAudioDownloadController:o=>{audioState=o.onState;return audioController}},'utils/pdfDownload':{formatBytes:n=>n+' B',initialPdfDownloadState:()=>({active:false}),createPdfDownloadController:o=>{pdfState=o.onState;return pdfController}},'utils/nativeSession':{refreshNativeSession:pdfReady}}})
 const page=rt.page('bundles/curricula/ieltsPapers')
 return{rt,page,calls,audioState:s=>audioState(s),pdfState:s=>pdfState(s)}
}
const event=(id,audioId)=>({currentTarget:{dataset:{id,audioId}}})
{
 const h=harness();await h.page.onLoad({module:'listening'});assert.equal(h.page.data.items[0].audioTracks.length,4);assert.equal(h.calls.filter(x=>x[0]==='audio-download').length,0,'opening the page must not download audio')
 await h.page.downloadAudio(event(p.id,track(2).id));assert.ok(h.rt.calls.some(x=>x.url==='/pages/account/auth'));assert.equal(h.calls.filter(x=>x[0]==='audio-download').length,0)
 h.rt.storage.set('stemistUser',{id:'ielts:1'});await h.page.downloadAudio(event(p.id,track(2).id));assert.equal(h.calls.find(x=>x[0]==='audio-download')[1].fileName,track(2).fileName)
 h.page.chooseModule({currentTarget:{dataset:{module:'reading'}}});assert.equal(h.page.data.module,'listening','do not abandon an active transfer by filtering')
 await h.page.openPdf({currentTarget:{dataset:{id:p.id,kind:'qp'}}});assert.equal(h.calls.filter(x=>x[0]==='pdf-open').length,0,'one transfer at a time across PDF/audio')
 h.audioState({itemId:track(2).id,active:false,sharing:false,ready:true});h.page.shareAudio();assert.ok(h.calls.some(x=>x[0]==='audio-share'))
 h.audioState({active:false,sharing:false});h.pdfState({active:true});await h.page.downloadAudio(event(p.id,track(1).id));h.page.retryAudio();assert.equal(h.calls.filter(x=>x[0]==='audio-download').length,1);assert.equal(h.calls.filter(x=>x[0]==='audio-retry').length,0)
 h.pdfState({active:false});h.page.chooseModule({currentTarget:{dataset:{module:'reading'}}});assert.equal(h.page.data.items[0].audioTracks.length,0)
 h.page.onHide();h.page.onUnload();for(const name of ['audio-hide','audio-dispose','pdf-hide','pdf-dispose'])assert.ok(h.calls.some(x=>x[0]===name))
}
{
 let fail=true;const h=harness({audioFetch:async()=>{if(fail)throw Error('音频目录暂不可用');return{items:audio,offline:true}}});await h.page.onLoad({module:'listening'});assert.equal(h.page.data.items.length,1);assert.equal(h.page.data.error,'');assert.ok(h.page.data.audioError);h.rt.storage.set('stemistUser',{id:'ielts:2'});await h.page.openPdf({currentTarget:{dataset:{id:p.id,kind:'qp'}}});assert.equal(h.calls.filter(x=>x[0]==='pdf-open').length,1,'audio lookup failure must not block PDFs')
 fail=false;await h.page.retryAudioCatalogue();assert.equal(h.page.data.audioError,'');assert.equal(h.page.data.audioOffline,true);assert.equal(h.page.data.items[0].audioTracks.length,4);h.page.onUnload()
}
{
 const wait=deferred(),h=harness({audioFetch:()=>wait.promise});const pending=h.page.onLoad({module:'listening'});await settle();assert.equal(h.page.data.loading,false,'PDF list does not wait for audio metadata');assert.equal(h.page.data.items.length,1);h.page.onUnload();wait.resolve({items:audio,offline:false});await pending;assert.equal(h.page.data.items[0].audioTracks.length,0,'unloaded page ignores late audio metadata')
}
const markup=fs.readFileSync(path.join(root,'bundles/curricula/ieltsPapers.wxml'),'utf8')
assert.ok(markup.includes('class="audio-catalog-state"')&&markup.indexOf('class="audio-catalog-state"')<markup.indexOf('class="papers"'),'catalogue-level errors/loading/retry appear only once above the paper loop')
assert.equal((markup.match(/bindtap="retryAudioCatalogue"/g)||[]).length,1)
for(const [windowWidth,windowHeight,deviceType,model,tablet]of[[375,812,'phone','iPhone',false],[844,390,'phone','iPhone',false],[768,1024,'tablet','iPad',true],[1194,834,'tablet','iPad',true]]){
 const h=harness({profile:{windowWidth,windowHeight,deviceType,model}});await h.page.onLoad({module:'listening'});assert.equal(h.page.data.isTablet,tablet);assert.equal(h.page.data.items[0].audioTracks.length,4);h.page.onResize();assert.equal(h.page.data.windowWidth,windowWidth);h.page.onUnload()
}
assert.match(fs.readFileSync(path.join(root,'bundles/curricula/ieltsPapers.wxss'),'utf8'),/\.device-tablet\.portrait \.papers\{grid-template-columns:minmax\(0,1fr\)\}/)
assert.ok(markup.indexOf('class="paper-audio"')>markup.indexOf('bindtap="openPdf"'),'audio is below PDFs within the same card')
for(const binding of ['downloadAudio','shareAudio','cancelAudio','retryAudio','retryAudioCatalogue'])assert.ok(markup.includes('"'+binding+'"'))
assert.match(markup,/wx:for="\{\{item\.audioTracks\}\}"/);assert.match(markup,/wx:for-item="audio"/);assert.match(markup,/audioDownload\.itemId === audio\.id/)
assert.ok(!markup.includes('/bundles/curricula/ieltsAudio'),'inline download must not be a detour to another page')
for(const file of ['pages/practice/index.wxml','pages/ielts/library.wxml']){
 const view=fs.readFileSync(path.join(root,file),'utf8');assert.ok(view.includes('/bundles/curricula/ieltsPapers'));assert.ok(!view.includes('/bundles/curricula/ieltsAudio'),'primary downloads entry should be unified, with legacy audio deep links still supported')
}
console.log('PASS unified Cambridge downloads: canonical audio below PDFs, independent metadata loading, transfer locks, retry and lifecycle isolation')
