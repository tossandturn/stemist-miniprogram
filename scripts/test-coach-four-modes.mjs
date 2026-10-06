import assert from 'node:assert/strict'
import fs from 'node:fs'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const app=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
const coachPackage=app.subPackages?.find(item=>item.root==='bundles/coach')
assert.deepEqual(coachPackage?.pages,['index','tavern'],'Coach hub and tavern must be lazy ordinary subpackage pages')

const hubRuntime=miniRuntime()
hubRuntime.storage.set('stemistCoachEntry',{owner:'student-a',epoch:0,key:'entry:key',context:{skill:'reading'}})
const hub=hubRuntime.page('bundles/coach/index')
hub.onLoad({source:'competition',category:'competition',routeId:'bpho',entry:'entry:key'})
assert.deepEqual(hub.data.modes.map(item=>item.id),['steps','answers','pdf','tavern'],'hub must expose exactly four primary functions')
for(const [id,target] of [
  ['steps',/^\/pages\/coach\/index\?.*feature=steps/],
  ['answers',/^\/pages\/coach\/index\?.*feature=answers/],
  ['pdf','/bundles/marking/index'],
  ['tavern',/^\/bundles\/coach\/tavern\?.*entry=entry%3Akey/],
]){
  hub.openMode({currentTarget:{dataset:{mode:id}}})
  const url=hubRuntime.calls.at(-1).url
  if(target instanceof RegExp)assert.match(url,target);else assert.equal(url,target)
}
assert.match(hubRuntime.calls[0].url,/routeId=bpho/)
assert.match(hubRuntime.calls[0].url,/entry=entry%3Akey/)
assert.equal(hubRuntime.storage.get('stemistCoachEntry').key,'entry:key','hub must forward, not consume, a staged academic entry')
const markingSource=fs.readFileSync(new URL('../bundles/marking/index.js',import.meta.url),'utf8'),markingTemplate=fs.readFileSync(new URL('../bundles/marking/index.wxml',import.meta.url),'utf8')
assert.match(markingTemplate,/wx:if="{{reportAvailable}}"[^>]*bindtap="document"/)
assert.match(markingSource,/wx\.openDocument/)
assert.match(markingSource,/back\(\)\{wx\.navigateBack\(\)\}/)
assert.doesNotMatch(markingSource,/askCoach|\/api\/ai\/coach/,'PDF entry must remain on the real marking job pipeline')

const featureRequests=[]
const coach=miniRuntime({modules:{'utils/api':{
  askCoach:async request=>{featureRequests.push(request);return{mode:'ai',providerStatus:'connected',answer:'完成'}},
  askIeltsCoach:async request=>{featureRequests.push(request);return{mode:'ai',providerStatus:'connected',answer:'完成'}},
}}}).load('utils/coach')
await coach.runCoach({feature:'steps',message:'求解 2x=4',context:{product:'STEM Studio'}})
assert.equal(featureRequests.at(-1).feature,'steps')
assert.equal(featureRequests.at(-1).helpIntent,'hint')
assert.match(featureRequests.at(-1).message,/不给最终答案/)
await coach.runCoach({feature:'answers',message:'求解 2x=4',context:{product:'STEM Studio'}})
assert.equal(featureRequests.at(-1).feature,'answers')
assert.equal(featureRequests.at(-1).helpIntent,'worked-solution')
assert.match(featureRequests.at(-1).message,/完整解答/)
await coach.runCoach({feature:'answers',message:'不要答案，只给我提示',context:{product:'STEM Studio'}})
assert.equal(featureRequests.at(-1).helpIntent,'hint','an explicit no-answer request must override answer-mode depth')
await coach.runCoach({feature:'answers',helpIntent:'check-work',message:'检查第二步',context:{product:'STEM Studio'}})
assert.equal(featureRequests.at(-1).helpIntent,'check-work','explicit check-work remains a verdict/correction request inside Answers')

function academicRuntime(){
  const requests=[]
  const runtime=miniRuntime({modules:{
    'utils/image':{readAsJpegDataUrl:async path=>`data:image/jpeg;base64,${path}`},
    'utils/api':{
      isAuthError:()=>false,
      askCoach:async request=>{requests.push(request);return{mode:'ai',providerStatus:'connected',answer:'解答',coachState:{label:'AI 已连接'}}},
      askIeltsCoach:async request=>{requests.push(request);return{mode:'ai',providerStatus:'connected',answer:'解答',coachState:{label:'AI 已连接'}}},
    },
  }})
  runtime.storage.set('stemistUser',{id:'student-a'})
  return{runtime,requests}
}

const fresh=academicRuntime()
fresh.runtime.storage.set('stemistCoachPhoto','/owned/fresh.jpg')
fresh.runtime.storage.set('stemistCoachPhotoMeta',{owner:'student-a',epoch:0,path:'/owned/fresh.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'fresh-1',savedAt:Date.now()})
const answersPage=fresh.runtime.page('pages/coach/index')
answersPage.onLoad({source:'alevel',feature:'answers',routeId:'cie-9702-as-physics'})
answersPage.onShow();await settle();await settle()
assert.equal(fresh.requests.length,1,'a newly confirmed answer photo must auto-submit once')
assert.equal(fresh.requests[0].feature,'answers')
assert.equal(fresh.requests[0].helpIntent,'worked-solution')
answersPage.onShow();await settle()
assert.equal(fresh.requests.length,1,'repeated onShow must not bill the same photo again')
answersPage.onUnload()
const reopened=fresh.runtime.page('pages/coach/index')
reopened.onLoad({source:'alevel',feature:'answers'});reopened.onShow();await settle()
assert.equal(fresh.requests.length,1,'reopening a stale photo must not auto-submit')

for(const meta of [
  {owner:'student-other',epoch:0,path:'/owned/wrong-owner.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'wrong-owner',savedAt:Date.now()},
  {owner:'student-a',epoch:1,path:'/owned/wrong-epoch.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'wrong-epoch',savedAt:Date.now()},
  {owner:'student-a',epoch:0,path:'/owned/stale.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'stale',savedAt:Date.now()-120001},
  {owner:'student-a',epoch:0,path:'/owned/future.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'future',savedAt:Date.now()+60000},
  {owner:'student-a',epoch:0,path:'/owned/missing-time.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'missing-time'},
  {owner:'student-a',epoch:0,path:'/owned/bad-time.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'bad-time',savedAt:'bad'},
  {owner:'student-a',epoch:0,path:'/owned/infinite-time.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'infinite-time',savedAt:Infinity},
]){
  const guarded=academicRuntime(),path=meta.path
  guarded.runtime.storage.set('stemistCoachPhoto',path);guarded.runtime.storage.set('stemistCoachPhotoMeta',meta)
  const page=guarded.runtime.page('pages/coach/index');page.onLoad({source:'alevel',feature:'answers'});page.onShow();await settle()
  assert.equal(guarded.requests.length,0,'wrong owner/epoch photo nonce must never auto-submit')
}

const autoGate=deferred(),autoRequests=[]
const failedAutoRuntime=miniRuntime({modules:{
  'utils/image':{readAsJpegDataUrl:async path=>`data:image/jpeg;base64,${path}`},
  'utils/api':{isAuthError:()=>false,askCoach:request=>{autoRequests.push(request);return autoGate.promise},askIeltsCoach:request=>{autoRequests.push(request);return autoGate.promise}},
}})
failedAutoRuntime.storage.set('stemistUser',{id:'student-a'})
failedAutoRuntime.storage.set('stemistCoachPhoto','/owned/auto-fail.jpg')
failedAutoRuntime.storage.set('stemistCoachPhotoMeta',{owner:'student-a',epoch:0,path:'/owned/auto-fail.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'auto-fail-1',savedAt:Date.now()})
const failedAuto=failedAutoRuntime.page('pages/coach/index');failedAuto.onLoad({source:'alevel',feature:'answers'});failedAuto.onShow()
assert.equal(failedAutoRuntime.storage.get('stemistCoachPhotoMeta').autoSubmitConsumed,'auto-fail-1','nonce is consumed before awaiting the provider')
failedAuto.onShow();await settle();assert.equal(autoRequests.length,1,'pending automatic request cannot be duplicated')
autoGate.reject(new Error('provider failed'));await settle();await settle();failedAuto.onShow();await settle()
assert.equal(autoRequests.length,1,'failed automatic request remains manual-retry only')
failedAutoRuntime.storage.set('stemistCoachPhoto','/owned/auto-fresh-2.jpg')
failedAutoRuntime.storage.set('stemistCoachPhotoMeta',{owner:'student-a',epoch:0,path:'/owned/auto-fresh-2.jpg',contextId:'stem-photo',feature:'answers',autoSubmitNonce:'auto-fresh-2',savedAt:Date.now()})
failedAuto.onShow();await settle();await settle()
assert.equal(autoRequests.length,2,'a second genuinely fresh nonce triggers exactly one new request')

const steps=academicRuntime()
steps.runtime.storage.set('stemistCoachPhoto','/owned/steps.jpg')
steps.runtime.storage.set('stemistCoachPhotoMeta',{owner:'student-a',epoch:0,path:'/owned/steps.jpg',contextId:'stem-photo',feature:'steps',autoSubmitNonce:'steps-1',savedAt:Date.now()})
const stepsPage=steps.runtime.page('pages/coach/index')
stepsPage.onLoad({source:'alevel',feature:'steps'});stepsPage.onShow();await settle()
assert.equal(steps.requests.length,0,'steps mode requires an explicit send after photo confirmation')
await stepsPage.submit()
stepsPage.chooseHelpIntent({detail:{value:'worked-solution'}})
await stepsPage.submit()
assert.deepEqual(steps.requests.map(item=>item.feature),['steps','answers'])
assert.deepEqual(Array.from(steps.requests[1].imageDataUrls),Array.from(steps.requests[0].imageDataUrls))
assert.equal(steps.requests[1].history.length,2,'hint to answer must keep the successful academic turn')

const tavernRequests=[]
let tavernResult={mode:'ai',providerStatus:'connected',answer:'今天想聊点什么？'}
const tavernRuntime=miniRuntime({modules:{'utils/api':{
  isAuthError:()=>false,
  askCoach:async request=>{tavernRequests.push(request);return tavernResult},
}}})
tavernRuntime.storage.set('stemistUser',{id:'student-tavern'})
tavernRuntime.storage.set('stemistCoachPhoto','/private/academic.jpg')
tavernRuntime.storage.set('stemistCoachTurns:student-tavern:stem-photo',[{role:'user',content:'private source'}])
const tavern=tavernRuntime.page('bundles/coach/tavern')
tavern.onLoad()
assert.deepEqual(tavern.data.personas.map(item=>item.id),['keeper','study-buddy','cat-companion','story-traveler','xianxia-guide','mystery-guide'])
tavern.choosePersona({currentTarget:{dataset:{persona:'keeper'}}})
const keeperStarter=tavern.data.starters[0]
tavern.useStarter({currentTarget:{dataset:{text:keeperStarter}}})
assert.equal(tavern.data.message,keeperStarter)
assert.equal(tavernRequests.length,0,'starter chips fill the draft without calling AI')
await tavern.submit()
assert.equal(tavernRequests.length,1)
assert.equal(tavernRequests[0].feature,'tavern')
assert.equal(tavernRequests[0].persona,'keeper')
assert.deepEqual(Array.from(tavernRequests[0].imageDataUrls),[])
assert.equal(JSON.stringify(tavernRequests[0].context),JSON.stringify({product:'STEM Studio',skill:'tavern',stage:'practice',source:'stemist-miniprogram'}))
assert.doesNotMatch(JSON.stringify(tavernRequests[0]),/private source|academic\.jpg/)

tavern.onMessage({detail:{value:'掌柜草稿'}})
tavern.choosePersona({currentTarget:{dataset:{persona:'study-buddy'}}})
assert.equal(tavern.data.message,'','persona histories and drafts must be isolated')
tavern.onMessage({detail:{value:'搭子草稿'}})
tavern.choosePersona({currentTarget:{dataset:{persona:'keeper'}}})
assert.equal(tavern.data.message,'掌柜草稿')
tavern.choosePersona({currentTarget:{dataset:{persona:'study-buddy'}}})
tavernResult={mode:'offline',providerStatus:'error',answer:'离线填充'}
await tavern.submit()
assert.equal(tavern.data.message,'搭子草稿','provider failure must retain the draft')
assert.equal(tavern.data.answer,'','offline filler must not be shown as a completed chat')
assert.equal(tavern.data.canRetry,true)

tavernRuntime.storage.set('stemistUser',{id:'student-other'})
tavern.onShow()
assert.equal(tavern.data.message,'')
assert.equal(tavern.data.answer,'')
assert.match(tavern.data.error,/账号/)
const share=tavern.onShareAppMessage.call({...tavern,route:'bundles/coach/tavern'})
assert.equal(share.path,'/pages/index/index')
assert.doesNotMatch(JSON.stringify(share),/keeper|study-buddy|cat-companion|story-traveler|xianxia-guide|mystery-guide|student-|草稿|message|persona/i,'share data cannot expose persona, draft or account state')

const quotaRequests=[]
const quotaRuntime=miniRuntime({wx:{setStorageSync:key=>{if(String(key).startsWith('stemistTavern:'))throw new Error('quota')}},modules:{'utils/api':{isAuthError:()=>false,askCoach:async request=>{quotaRequests.push(request);return{mode:'ai',providerStatus:'connected',answer:'已收到你的话。'}}}}})
quotaRuntime.storage.set('stemistUser',{id:'quota-owner'})
const quotaPage=quotaRuntime.page('bundles/coach/tavern');quotaPage.onLoad();quotaPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});quotaPage.onMessage({detail:{value:'请听我说'}})
assert.equal(quotaPage.data.message,'请听我说','input remains in memory when local storage is full')
assert.match(quotaPage.data.warning,/未能保存在本机/)
await quotaPage.submit()
assert.equal(quotaRequests.length,1)
assert.equal(quotaPage.data.answer,'已收到你的话。','a connected reply remains visible after storage failure')
assert.equal(quotaPage.data.turns.length,2)
assert.equal(quotaPage.data.canRetry,false,'storage failure must not offer a billable AI retry')
assert.equal(quotaPage.data.error,'')
assert.doesNotThrow(()=>quotaPage.onUnload())

const examRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async request=>{throw new Error('must not call '+JSON.stringify(request))}}}})
examRuntime.storage.set('stemistUser',{id:'exam-owner'})
examRuntime.storage.set('stemistCoachEntry',{owner:'exam-owner',epoch:0,at:Date.now(),key:'exam-entry',context:{attemptId:'attempt-1',paperStudyMode:'exam-simulation',submitted:false}})
const examTavern=examRuntime.page('bundles/coach/tavern');examTavern.onLoad({entry:'exam-entry'})
assert.equal(examTavern.data.examBlocked,true)
examTavern.onMessage({detail:{value:'绕过考试'}});await examTavern.submit()
assert.match(examTavern.data.error,/计时考试/)

const bindingRequests=[],bindingRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async request=>{bindingRequests.push(request);return{mode:'ai',providerStatus:'connected',answer:'轻松聊聊'}}}}})
bindingRuntime.storage.set('stemistUser',{id:'binding-owner'})
bindingRuntime.storage.set('stemistCoachEntry',{owner:'binding-owner',epoch:0,at:Date.now(),key:'binding-entry',context:{paperAttemptId:'opaque-attempt',studyMode:'practice',sourceQuestionExtract:'must-not-leak',imagePaths:['/private/source.png']}})
const bindingPage=bindingRuntime.page('bundles/coach/tavern');bindingPage.onLoad({entry:'binding-entry'});bindingPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});bindingPage.onMessage({detail:{value:'换个轻松话题'}});await bindingPage.submit()
assert.equal(JSON.stringify(bindingRequests[0].context),JSON.stringify({product:'STEM Studio',skill:'tavern',stage:'practice',source:'stemist-miniprogram'}),'Tavern context stays exactly four non-academic fields')
assert.equal(bindingRequests[0].attemptId,'opaque-attempt','known entry carries canonical opaque attemptId only at request top level')
assert.doesNotMatch(JSON.stringify(bindingRequests[0]),/sourceQuestionExtract|private\/source|paperAttemptId/)

const authRuntime=miniRuntime({modules:{'utils/api':{isAuthError:error=>error?.code==='auth_required',askCoach:async()=>{authRuntime.storage.delete('stemistUser');const error=new Error('登录已过期');error.code='auth_required';throw error}}}})
authRuntime.storage.set('stemistUser',{id:'auth-owner'})
const authPage=authRuntime.page('bundles/coach/tavern');authPage.onLoad();authPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});authPage.onMessage({detail:{value:'登录后继续这段话'}});await authPage.submit()
assert.equal(authPage.data.loading,false)
assert.equal(authPage.data.authRequired,true)
assert.equal(authPage.data.message,'','expired auth must hide the previous account text')
authPage.openAccount();assert.equal(authRuntime.calls.at(-1).url,'/pages/account/auth')
authRuntime.storage.set('stemistUser',{id:'auth-owner'});authRuntime.storage.set('stemistSessionToken','restored-session');authPage.onShow()
assert.equal(authPage.data.message,'登录后继续这段话','same-owner reauthentication restores the isolated draft')
assert.equal(authPage.data.authRequired,false)

for(const directory of ['pages','components','utils']){
  const pending=[new URL(`../${directory}/`,import.meta.url)]
  while(pending.length){const current=pending.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=new URL(entry.name+(entry.isDirectory()?'/':''),current);if(entry.isDirectory())pending.push(target);else if(entry.name.endsWith('.js'))assert.doesNotMatch(fs.readFileSync(target,'utf8'),/require\([^)]*bundles\/coach/,'main package must not synchronously import Coach subpackage code')}}
}

const hubCss=fs.readFileSync(new URL('../bundles/coach/index.wxss',import.meta.url),'utf8')
const tavernCss=fs.readFileSync(new URL('../bundles/coach/tavern.wxss',import.meta.url),'utf8')
assert.match(hubCss,/grid-template-columns:\s*repeat\(2/)
assert.match(hubCss,/\.mode-card\{[^}]*min-height:\s*1\d\dpx/)
assert.match(hubCss,/max-width:\s*375px/)
assert.match(hubCss,/device-tablet/)
assert.match(tavernCss,/min-height:\s*44px/)
assert.match(tavernCss,/safe-area-inset-bottom/)
assert.match(tavernCss,/\.chat-turn\{[^}]*font-size:16px/)

console.log('Coach four-mode hub, academic mode policy, fresh-photo nonce and isolated tavern flows passed.')
