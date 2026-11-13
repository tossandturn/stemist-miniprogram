import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
const requests=[]
let drawFailure=false,offerEnabled=false
const runtime=miniRuntime({modules:{
 'utils/coach':{
  HELP_INTENTS:{HINT:'hint',WORKED_SOLUTION:'worked-solution',CHECK_WORK:'check-work'},
  coachHelpPolicy:()=>({solutionDisabled:false}),normalizeCoachFeature:value=>String(value||''),normalizeHelpIntent:value=>String(value||''),
  runCoach:async request=>{requests.push(request);if(request.diagramIntent==='draw'){if(drawFailure)throw Error('补图失败');return{mode:'ai',providerStatus:'connected',completed:true,answer:'补图说明\n```stem-diagram\n{"version":"stem-diagram-v1","title":"受力图","width":320,"height":200,"elements":[]}\n```'}}const denied=/不要画|do not draw/i.test(request.message);return{mode:'ai',providerStatus:'connected',completed:true,answer:'先给文字答案',...(offerEnabled&&!denied?{diagramOffer:{type:'force',question:'需要我补一张受力图说明吗？'}}:{}),helpIntent:request.helpIntent,requestMessage:request.message}},
 },
 'utils/coachSource':{offerCoachSource(){},lookupCoachSource(){},clearCoachSource(){}},
 'utils/coachSession':{warmCoachSession:()=>()=>{}},
 'utils/coachEntry':{takeCoachEntry:()=>null,focusPassage:value=>value},
 'utils/nativeCaptions':{loadCaptions:async()=>({words:[]})},
 'utils/image':{readAsJpegDataUrl:async path=>'data:image/jpeg;base64,'+path},
 'utils/nativeCoachPhoto':{readCoachPhoto:()=>'',readCoachPhotoPaths:()=>[],consumeCoachPhotoAutoSubmit:()=>false,clearCoachPhoto(){},clearCoachPhotoEntry(){}},
}})
runtime.storage.set('stemistUser',{id:'ielts:diagram-owner'});runtime.storage.set('stemistSessionToken','fixture-token')
const page=runtime.page('pages/coach/index');page.onLoad({source:'alevel',feature:'steps'});page.onShow();page.setData({message:'请解释斜面受力',helpIntent:'hint',feature:'steps',routeContext:{routeId:'cie-9702-as-physics',subjectCode:'9702',stage:'AS'}})
await page.submit();assert.equal(page.data.answer,'先给文字答案');assert.equal(page.data.diagramAnswer,'');assert.equal(page.data.diagramOffer,null,'default text answer has no buttons without a server offer');assert.equal(requests[0].diagramIntent,'ask')
offerEnabled=true;await page.submit();assert.equal(page.data.diagramOffer.question,'需要我补一张受力图说明吗？')
const beforeDecline=requests.length;page.declineDiagram();assert.equal(requests.length,beforeDecline,'decline is local and costs zero network/model calls');assert.equal(page.data.diagramOffer,null)
await page.submit();assert.equal(page.data.diagramOffer,null,'declining suppresses repeated offers for the same question')
page.onMessage({detail:{value:'请给刚才这道题画受力图'}});await page.submit();assert.ok(page.data.diagramOffer,'a new explicit drawing request overrides the prior local decline')
page.onMessage({detail:{value:'不要画图，只解释文字'}});await page.submit();assert.equal(page.data.diagramOffer,null,'an explicit current-turn refusal takes priority')
page.onMessage({detail:{value:'换一道新题'}});await page.submit();assert.ok(page.data.diagramOffer,'a new question may receive a new selective offer')
const original={...requests.at(-1),history:JSON.stringify(requests.at(-1).history),context:JSON.stringify(requests.at(-1).context),images:JSON.stringify(requests.at(-1).imageDataUrls)}
await page.confirmDiagram();const draw=requests.at(-1);assert.equal(draw.diagramIntent,'draw');assert.equal(draw.message,original.message);assert.equal(draw.helpIntent,original.helpIntent);assert.equal(JSON.stringify(draw.context),original.context);assert.equal(JSON.stringify(draw.history),original.history);assert.equal(JSON.stringify(draw.imageDataUrls),original.images);assert.equal(page.data.answer,'先给文字答案');assert.match(page.data.diagramAnswer,/stem-diagram-v1/)
page.onMessage({detail:{value:'失败场景'}});await page.submit();drawFailure=true;await page.confirmDiagram();assert.equal(page.data.answer,'先给文字答案','diagram failure preserves the completed text answer');assert.match(page.data.diagramError,/补图失败/);assert.ok(page.data.diagramOffer,'failed draw remains explicitly retryable');drawFailure=false
runtime.storage.set('stemistUser',{id:'ielts:other-owner'});page.onShow();assert.equal(page.data.diagramOffer,null);assert.equal(page.data.diagramAnswer,'');assert.equal(page.data.diagramError,'')

const panel=runtime.page('components/coach-panel/index'),events=[];panel.triggerEvent=(name)=>events.push(name);panel.data={...panel.data,academic:true,answer:'text',diagramOffer:{type:'force',question:'需要我补图吗？'},diagramLoading:false};panel.methods.onDiagramDraw.call(panel);panel.methods.onDiagramDecline.call(panel);assert.deepEqual(events,['diagram-draw','diagram-decline'])
const wxml=fs.readFileSync(new URL('../components/coach-panel/index.wxml',import.meta.url),'utf8');assert.match(wxml,/补受力图/);assert.match(wxml,/暂时不用/);assert.match(wxml,/diagramAnswer/)
for(const pagePath of ['../pages/coach/index.wxml','../pages/stem/coach.wxml']){const source=fs.readFileSync(new URL(pagePath,import.meta.url),'utf8');assert.match(source,/diagram-offer=/);assert.match(source,/bind:diagram-draw=/);assert.match(source,/bind:diagram-decline=/)}
await settle();page.onUnload()
console.log('PASS selective diagram offer: text first, local decline, bound draw, preserved text, failure retry and identity reset')
