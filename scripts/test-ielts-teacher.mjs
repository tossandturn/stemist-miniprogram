import assert from 'node:assert/strict'
import fs from 'node:fs'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const app=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
const coachPackage=app.subPackages?.find(item=>item.root==='bundles/coach')
assert.ok(coachPackage?.pages.includes('ieltsTeacher'),'IELTS teacher must be a lazy native Coach page')

const legacyModes=[
 {id:'steps',title:'步骤提示',detail:'理清思路，提示下一步。'},
 {id:'answers',title:'答案询问',detail:'拍下题目，获取完整解答。'},
 {id:'pdf',title:'PDF 阅卷',detail:'上传 PDF 或图片，生成批改报告。'},
 {id:'tavern',title:'AI 休闲酒馆',detail:'选个角色，聊聊学习以外的事。'},
]
const hubRuntime=miniRuntime(),hub=hubRuntime.page('bundles/coach/index')
hub.onLoad({})
assert.deepEqual(hub.data.modes.map(item=>item.id),['steps','answers','pdf','tavern','admissions','ielts-teacher'])
hub.applyProductConfig({config:{coach:{modes:legacyModes}}})
assert.deepEqual(Array.from(hub.data.modes,item=>item.id),['steps','answers','pdf','tavern','admissions','ielts-teacher'],'Legacy four-card config appends both native advisor roles in stable order')
hub.openMode({currentTarget:{dataset:{mode:'ielts-teacher'}}})
assert.equal(hubRuntime.calls.at(-1).url,'/bundles/coach/ieltsTeacher')

const record=(revision=0,persona='ielts-teacher',id='ielts-teacher-conversation')=>({id,persona,revision,turnCount:revision})
const requests=[]
let responsePersona='ielts-teacher'
const clientRuntime=miniRuntime({modules:{'utils/api':{
 COACH_TEXT_TIMEOUT_MS:55000,
 requestJson:async(path,body,options={})=>{
  requests.push({path,body,options})
  if(path.endsWith('/resume'))return{conversation:record(0,responsePersona),messages:[],nextBefore:''}
  if(path.includes('/messages?'))return{conversation:record(1,responsePersona),messages:[],nextBefore:''}
  if(options.method==='DELETE')return{deleted:true,conversationId:body?.conversationId||'ielts-teacher-conversation'}
  const answer='## 学习建议\n先明确目标分数和考试日期。'
  const turns=[
   {id:body.clientTurnId+':user',role:'user',content:body.message,sequence:1,status:'complete'},
   {id:body.clientTurnId+':assistant',role:'assistant',content:answer,sequence:2,status:'complete'},
  ]
  options.stream.push(`event: meta\ndata: {"mode":"ai"}\n\nevent: delta\ndata: ${JSON.stringify({text:answer})}\n\n`)
  return{mode:'ai',providerStatus:'connected',answer,clientTurnId:body.clientTurnId,conversation:record(body.expectedRevision+1,responsePersona),turns}
 },
}}})
clientRuntime.storage.set('stemistUser',{id:'teacher-client'})
const client=clientRuntime.load('bundles/coach/ieltsTeacherConversation')
await client.resumeIeltsTeacher()
assert.equal(requests.at(-1).path,'/api/ai/ielts-teacher/conversations/resume')
let preview=''
await client.sendIeltsTeacher({message:'请制定两个月备考计划',conversationId:'ielts-teacher-conversation',clientTurnId:'ielts-teacher-turn-1',expectedRevision:0,onPartial:value=>{preview=value}})
assert.equal(requests.at(-1).path,'/api/ai/ielts-teacher/stream')
assert.deepEqual(Object.keys(requests.at(-1).body).sort(),['clientTurnId','conversationId','expectedRevision','message'])
assert.match(preview,/学习建议/)
assert.equal(client.cleanIeltsTeacherMessage('\u0000  第一行\r\n第二行\rdata:image/png;base64,QUJDRA==\nsk-1234567890abcdef  '),'第一行\n第二行\n[image omitted]\n[secret omitted]')
responsePersona='admissions-advisor'
await assert.rejects(client.resumeIeltsTeacher(),/角色|预设|记录|无效|不匹配/,'Teacher client rejects a canonical envelope from another role')

let resumeCount=0,sendGate=deferred(),sent=[]
const pageRuntime=miniRuntime({wx:{setClipboardData:options=>options.success?.({})},modules:{
 'bundles/coach/ieltsTeacherConversation':{
  cleanIeltsTeacherMessage:value=>String(value||'').trim(),
  newClientTurnId:()=>`ielts-teacher-page-turn-${sent.length+1}`,
  resumeIeltsTeacher:async()=>{resumeCount++;return{conversation:record(0),messages:[],nextBefore:''}},
  fetchIeltsTeacherMessages:async()=>({conversation:record(0),messages:[],nextBefore:''}),
  deleteIeltsTeacher:async({conversationId})=>({deleted:true,conversationId}),
  sendIeltsTeacher:async request=>{sent.push(request);request.onPartial('## 正在整理\n先确认学习时间。');const answer=await sendGate.promise;return{mode:'ai',providerStatus:'connected',answer,clientTurnId:request.clientTurnId,conversation:record(1),turns:[{id:request.clientTurnId+':user',role:'user',content:request.message,sequence:1,status:'complete'},{id:request.clientTurnId+':assistant',role:'assistant',content:answer,sequence:2,status:'complete'}]}},
 },
}})
pageRuntime.storage.set('stemistUser',{id:'teacher-owner'})
pageRuntime.storage.set('stemistSessionToken','synthetic-session')
pageRuntime.storage.set('stemistAdmissions:teacher-owner:0',{draft:'private admissions draft'})
pageRuntime.storage.set('stemistTavern:teacher-owner:0:selected','keeper')
pageRuntime.storage.set('stemistCoachPhoto','/private/academic.jpg')
const page=pageRuntime.page('bundles/coach/ieltsTeacher')
page.onLoad();page.onShow();await settle();await settle()
assert.equal(resumeCount,1)
assert.deepEqual(Array.from(page.data.starters,item=>item.title),['备考计划','写作辅导','听读解析','口语练习'])
page.useStarter({currentTarget:{dataset:{index:0}}})
assert.match(page.data.message,/备考|计划/)
assert.equal(sent.length,0,'Teacher starters fill only and never spend an AI request')
page.openIeltsWorkspace();assert.equal(pageRuntime.calls.at(-1).url,'/pages/ielts/home')
page.openRealtimeSpeaking();assert.equal(pageRuntime.calls.at(-1).url,'/pages/ielts/speaking')
page.onMessage({detail:{value:'我想练习 Speaking Part 2，请一次给我一张文字题卡。'}})
const send=page.submit();await settle()
assert.equal(page.data.loading,true)
assert.match(page.data.partialAnswer,/正在整理/)
assert.doesNotMatch(JSON.stringify(sent[0]),/private admissions|keeper|academic\.jpg|imageDataUrls|history|context|persona/)
sendGate.resolve('## Part 2 练习\nDescribe a place you enjoy visiting.');await send
assert.equal(page.data.turns.length,2)
assert.equal(page.data.message,'')
assert.ok(pageRuntime.storage.has('stemistIeltsTeacher:teacher-owner:0'))
assert.equal(pageRuntime.storage.get('stemistAdmissions:teacher-owner:0').draft,'private admissions draft','Teacher persistence never overwrites admissions data')
assert.equal(page.onShareAppMessage().path,'/bundles/coach/index')

const template=fs.readFileSync(new URL('../bundles/coach/ieltsTeacher.wxml',import.meta.url),'utf8')
const style=fs.readFileSync(new URL('../bundles/coach/ieltsTeacher.wxss',import.meta.url),'utf8')
const source=fs.readFileSync(new URL('../bundles/coach/ieltsTeacher.js',import.meta.url),'utf8')+fs.readFileSync(new URL('../bundles/coach/ieltsTeacherConversation.js',import.meta.url),'utf8')
assert.match(template,/answer-content[^>]*academic="{{true}}"/,'Teacher uses the line-aware academic answer renderer')
assert.match(template,/bindtap="openIeltsWorkspace"/)
assert.match(template,/bindtap="openRealtimeSpeaking"/)
assert.match(template,/文字练习|文字题卡/)
assert.doesNotMatch(source+template,/chooseImage|getRecorderManager|startRecord|imageDataUrls|拍照上传/,'Text teacher neither captures media nor claims audio/photo capability')
assert.match(style,/safe-area-inset-bottom/)
assert.match(style,/min-height:\s*44px/)

const icon=fs.readFileSync(new URL('../bundles/coach/mode-icons/ielts-teacher.svg',import.meta.url),'utf8')
assert.match(icon,/^<svg[\s\S]*viewBox="0 0 48 48"/)
assert.doesNotMatch(icon,/<image|(?:xlink:)?href=|data:/,'Teacher icon is original local vector artwork')
const hubStyle=fs.readFileSync(new URL('../bundles/coach/index.wxss',import.meta.url),'utf8')
assert.match(hubStyle,/\.mode-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Phone keeps two balanced Coach columns')
assert.match(hubStyle,/\.coach-hub-page\.device-tablet \.mode-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'Wide tablets show three balanced Coach columns')
assert.match(hubStyle,/\.coach-hub-page button\.mode-card\{[^}]*max-width:100%/,'Every Coach card stays inside its grid track')
assert.doesNotMatch(hubStyle,/grid-column:\s*1\s*\/\s*-1|\.coach-hub-page\.device-tablet \.mode-(?:admissions|ielts-teacher)\s*\{/,'All six cards use one stacked icon/title layout without native-role span or padding exceptions')

const logoutRuntime=miniRuntime()
logoutRuntime.storage.set('stemistUser',{id:'logout-owner'})
logoutRuntime.storage.set('stemistIeltsTeacher:logout-owner:0',{draft:'private IELTS draft'})
logoutRuntime.storage.set('stemistAdmissions:logout-owner:0',{draft:'private admissions draft'})
logoutRuntime.load('utils/session').clearLocalSession({preserveDrafts:true})
assert.ok(logoutRuntime.storage.has('stemistIeltsTeacher:logout-owner:0'),'A transient 401 preserves the same-owner teacher draft')
logoutRuntime.storage.set('stemistUser',{id:'logout-owner'})
logoutRuntime.load('utils/session').clearLocalSession()
assert.equal(logoutRuntime.storage.has('stemistIeltsTeacher:logout-owner:0'),false,'Explicit logout removes teacher drafts')
assert.equal(logoutRuntime.storage.has('stemistAdmissions:logout-owner:0'),false,'Existing admissions cleanup remains intact')

console.log('PASS IELTS teacher: route, legacy config, isolated client/page, native links, text-only UI and cleanup contracts')
