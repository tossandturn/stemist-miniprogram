import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const file=(track,taskId='cam12-l-test1')=>({id:'audio-'+String(track).repeat(32),taskId,book:12,test:5,practiceTest:1,track,trackCount:4,title:'Cambridge 12 Test 5',fileName:'Cambridge_IELTS_12_Test_5_Listening_Audio_'+track+'.mp3',sha256:'a'.repeat(64),bytes:1024,url:'/api/stem/ielts-audio/files/audio-'+String(track).repeat(32)})
const payload={schemaVersion:'ielts-audio-downloads-v1',version:'b'.repeat(24),items:[1,2,3,4].map(n=>file(n)),books:[12],quota:{limit:2,timezone:'Asia/Shanghai',shared:true}},calls=[]
let offline=false
const rt=miniRuntime({modules:{'utils/api':{getJson:async(url,options)=>{calls.push({url,options});if(offline)throw Error('network');return payload}}}})
let service;try{service=rt.load('bundles/curricula/ieltsAudioService')}catch{service={}}
assert.equal(typeof service.fetchCatalogue,'function','Listening exports need a verified catalogue')
let catalog=await service.fetchCatalogue();assert.equal(catalog.items.length,4);assert.equal(catalog.items[0].url,'https://stem.ieltsist.com'+payload.items[0].url);assert.equal(calls[0].options.stemAuth,false)
assert.throws(()=>service.parseCatalogue({...payload,items:[{...file(1),url:'https://evil.invalid/audio.mp3'}]}));assert.throws(()=>service.parseCatalogue({...payload,items:[file(1),file(1)]}))
offline=true;catalog=await service.fetchCatalogue();assert.equal(catalog.offline,true);assert.equal(catalog.items.length,4)
let selected,observer,scope='';const fakeController={setScope:s=>scope=s,download:i=>{selected=i;observer({active:false,ready:true,itemId:i.id,progress:{phase:'ready',visible:true},sharing:false});return true},share(){},cancel(){},retry(){},suspend(){},dispose(){}}
const pageRt=miniRuntime({modules:{'bundles/curricula/ieltsAudioService':{fetchCatalogue:async()=>catalog},'bundles/curricula/audioDownload':{createAudioDownloadController:o=>{observer=o.onState;return fakeController}}}})
const page=pageRt.page('bundles/curricula/ieltsAudio');await page.onLoad({taskId:'cam12-l-test1',track:'2'});assert.equal(page.data.items.length,4);assert.equal(page.data.items[1].focused,true);assert.match(page.data.items[0].meta,/Test 5/);assert.match(page.data.items[0].practiceNote,/1/)
page.download({currentTarget:{dataset:{id:file(2).id}}});assert.equal(selected.id,file(2).id);assert.equal(page.data.download.ready,true);page.setData({download:{active:true}});page.chooseBook({detail:{value:0}});assert.equal(scope.includes('cam12-l-test1'),true);page.onUnload()
const root=process.env.STEMIST_TEST_RUNTIME_ROOT||path.resolve(import.meta.dirname,'..'),app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));assert.ok(app.subPackages.find(p=>p.root==='bundles/curricula').pages.includes('ieltsAudio'))
for(const f of ['pages/practice/index.wxml','pages/ielts/library.wxml'])assert.match(fs.readFileSync(path.join(root,f),'utf8'),/bundles\/curricula\/ieltsAudio/)
assert.match(fs.readFileSync(path.join(root,'pages/ielts/objective.wxml'),'utf8'),/openAudioDownloads/)
const audioMarkup=fs.readFileSync(path.join(root,'bundles/curricula/ieltsAudio.wxml'),'utf8');assert.match(audioMarkup,/class="audio-download-button"/);assert.match(audioMarkup,/id="audio-download-progress"/)
console.log('Audio library: canonical metadata, public cache fallback, original labels/deep links, no auto download and registered native entries PASS')
