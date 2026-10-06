import assert from 'node:assert/strict'
import fs from 'node:fs'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

const IDS=['keeper','study-buddy','cat-companion','story-traveler','xianxia-guide','mystery-guide']
const TITLES=['温柔树洞','嘴替损友','傲娇猫猫','奇幻冒险','江湖剑客','侦探茶室']
const SAFE_METADATA=[
 ['keeper','温柔树洞','倾听陪伴','今晚的树洞给你留着。想讲点什么，或者只想有人陪你待一会儿？',['今天有件事想说说','陪我安静聊一会儿','给我一个轻松的小问题']],
 ['study-buddy','嘴替损友','轻松吐槽','来了？先把今天最想吐槽的一件事放桌上，我保证只损事情，不损你。',['替我吐槽一下今天','来个不伤人的损友点评','陪我聊点没用但好玩的']],
 ['cat-companion','傲娇猫猫','猫系陪伴','我只是刚好路过，才不是在等你。说吧，今天要聊天、接话，还是听一句别扭的夸奖？',['猫猫今天在忙什么','陪我玩三轮接话','傲娇地夸我一句']],
 ['story-traveler','奇幻冒险','互动奇幻','旅馆窗外，一封会发光的无名信正等人拆开。你想直接读信，还是先问问送信的银翼鸟？',['带我走进一座浮空城','给我两个冒险选择','继续一段雨夜旅程']],
 ['xianxia-guide','江湖剑客','江湖奇遇','客官，夜雨封山，前方古镇却亮着一盏无人看守的灯。是进镇避雨，还是沿河道继续赶路？',['陪我夜探一座古镇','来一段江湖偶遇','给我三个行路选择']],
 ['mystery-guide','侦探茶室','轻推理','茶室打烊后，柜台上的蓝色信封不翼而飞：地板是干的，窗户开着，茶壶却还很烫。你想先查哪条线索？',['出一道三条线索的小案','让我询问一位虚构嫌疑人','继续刚才的谜案']],
]
const plain=value=>JSON.parse(JSON.stringify(value))
const catalogRuntime=miniRuntime()
const {TAVERN_PRESETS,tavernPreset}=catalogRuntime.load('bundles/coach/tavernPresets')
assert.deepEqual(plain(TAVERN_PRESETS.map(item=>item.id)),IDS)
assert.deepEqual(plain(TAVERN_PRESETS.map(item=>item.name)),TITLES)
assert.deepEqual(plain(TAVERN_PRESETS.map(item=>[item.id,item.name,item.tag,item.greeting,item.starters])),SAFE_METADATA,'client-safe openings and starters must match the server-owned public descriptors')
assert.equal(new Set(TAVERN_PRESETS.map(item=>item.tag)).size,6,'every preset needs a distinct leisure genre tag')
assert.equal(new Set(TAVERN_PRESETS.map(item=>item.greeting)).size,6,'every preset needs an original visible opening')
assert.equal(new Set(TAVERN_PRESETS.map(item=>item.placeholder)).size,6,'each role needs an appropriate composer prompt')
assert.equal(new Set(TAVERN_PRESETS.map(item=>JSON.stringify(item.starters))).size,6,'starter sets must be role-specific')
for(const [index,preset] of TAVERN_PRESETS.entries()){
  assert.equal(tavernPreset(preset.id),preset)
  assert.equal(preset.name,TITLES[index])
  assert.equal(preset.starters.length,3)
  assert.equal(new Set(preset.starters).size,3)
  for(const field of ['tag','detail','greeting','placeholder'])assert.ok(String(preset[field]).trim(),`${preset.id}.${field} is required`)
}
assert.equal(tavernPreset('unknown'),null)
const publicCopy=JSON.stringify(TAVERN_PRESETS)
assert.doesNotMatch(publicCopy,/学习搭子|学习计划|作业辅导|考试规划|刷题|成绩提升/,'Tavern presets must be recreational rather than unsolicited study coaching')
assert.doesNotMatch(publicCopy,/最火|热门|排行|万次|人在线|互动量|Top\s*6/i,'student copy cannot invent popularity claims')

const calls=[]
const runtime=miniRuntime({modules:{'utils/api':{
  isAuthError:()=>false,
  askCoach:async request=>{calls.push(request);return{mode:'ai',providerStatus:'connected',answer:`${request.persona} reply`}},
}}})
runtime.storage.set('stemistUser',{id:'preset-owner'})
runtime.storage.set('stemistCoachPhoto','/private/academic.jpg')
runtime.storage.set('stemistCoachTurns:preset-owner:stem-photo',[{role:'user',content:'private source'}])
const page=runtime.page('bundles/coach/tavern')
page.onLoad()
assert.equal(page.data.selectorOpen,true,'a first empty visit must show all presets')
assert.equal(page.data.presetChosen,false)
assert.deepEqual(plain(page.data.personas.map(item=>item.id)),IDS)
assert.equal(page.data.turns.length,0)
assert.equal(calls.length,0,'opening the picker cannot call AI')

for(const preset of TAVERN_PRESETS){
  const before=calls.length
  page.choosePersona({currentTarget:{dataset:{persona:preset.id}}})
  assert.equal(page.data.persona,preset.id)
  assert.equal(page.data.selected.name,preset.name)
  assert.equal(page.data.greeting,preset.greeting)
  assert.deepEqual(plain(page.data.starters),plain(preset.starters))
  assert.equal(page.data.placeholder,preset.placeholder)
  assert.equal(page.data.selectorOpen,false,'selection collapses the picker')
  assert.equal(page.data.presetChosen,true)
  assert.equal(page.data.turns.length,0,'static greeting must not become a stored assistant turn')
  assert.equal(calls.length,before,'selecting a preset cannot call AI')
  page.openSelector()
  assert.equal(page.data.selectorOpen,true)
  page.choosePersona({currentTarget:{dataset:{persona:preset.id}}})
  assert.equal(page.data.selectorOpen,false,'choosing the current preset collapses the reopened picker')
  page.useStarter({currentTarget:{dataset:{text:preset.starters[0]}}})
  assert.equal(page.data.message,preset.starters[0])
  assert.equal(calls.length,before,'starter chips fill the draft without calling AI')
  await page.submit()
  assert.equal(calls.length,before+1)
  assert.equal(calls.at(-1).feature,'tavern')
  assert.equal(calls.at(-1).persona,preset.id)
  assert.equal(calls.at(-1).history.length,0,'static greeting is never sent as provider history')
  assert.doesNotMatch(JSON.stringify(calls.at(-1)),new RegExp(preset.greeting.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  assert.deepEqual(Array.from(calls.at(-1).imageDataUrls),[])
  assert.doesNotMatch(JSON.stringify(calls.at(-1)),/private source|academic\.jpg/)
}
for(const preset of TAVERN_PRESETS){page.choosePersona({currentTarget:{dataset:{persona:preset.id}}});assert.equal(page.data.turns.length,2,`${preset.id} history must restore independently`);assert.equal(page.data.turns[0].content,preset.starters[0])}

const clearRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async request=>({mode:'ai',providerStatus:'connected',answer:`${request.persona} reply`})}}})
clearRuntime.storage.set('stemistUser',{id:'clear-owner'})
const clearPage=clearRuntime.page('bundles/coach/tavern');clearPage.onLoad();clearPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});clearPage.onMessage({detail:{value:'normal clear'}});await clearPage.submit();clearPage.clear()
assert.equal(clearPage.data.turns.length,0)
assert.equal(clearPage.data.status,'已清空当前角色对话')
clearPage.choosePersona({currentTarget:{dataset:{persona:'cat-companion'}}});clearPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}})
assert.equal(clearPage.data.turns.length,0,'a normally cleared role cannot resurrect after switching')

let repairRuntime
repairRuntime=miniRuntime({wx:{setStorageSync:(key,value)=>repairRuntime.storage.set(key,value),removeStorageSync:key=>{if(String(key).includes(':keeper'))throw new Error('remove failed');repairRuntime.storage.delete(key)}},modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'saved reply'})}}})
repairRuntime.storage.set('stemistUser',{id:'repair-owner'})
const repairPage=repairRuntime.page('bundles/coach/tavern');repairPage.onLoad();repairPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});repairPage.onMessage({detail:{value:'repair clear'}});await repairPage.submit();repairPage.clear()
assert.equal(repairPage.data.turns.length,0)
assert.equal(repairPage.data.status,'已清空当前角色对话','an empty owned-state overwrite is a durable clear fallback')
assert.equal(repairPage.data.warning,'')
assert.equal(repairRuntime.storage.get(repairPage.key()).turns.length,0)

let blockedRuntime,blockWrites=false
blockedRuntime=miniRuntime({wx:{setStorageSync:(key,value)=>{if(blockWrites&&String(key).includes(':keeper'))throw new Error('quota');blockedRuntime.storage.set(key,value)},removeStorageSync:key=>{if(String(key).includes(':keeper'))throw new Error('remove failed');blockedRuntime.storage.delete(key)}},modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'blocked reply'})}}})
blockedRuntime.storage.set('stemistUser',{id:'blocked-clear-owner'})
const blockedPage=blockedRuntime.page('bundles/coach/tavern');blockedPage.onLoad();blockedPage.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});blockedPage.onMessage({detail:{value:'cannot persist clear'}});await blockedPage.submit();blockWrites=true;blockedPage.clear()
assert.equal(blockedPage.data.turns.length,0,'failed persistent cleanup still hides the current in-memory conversation')
assert.doesNotMatch(blockedPage.data.status,/已清空当前角色对话/,'double storage failure cannot claim durable deletion')
assert.match(blockedPage.data.warning,/未能清除|重试清空/)
assert.equal(blockedRuntime.storage.get(blockedPage.key()).turns.length,2,'failed delete and overwrite leave the old persistent record untouched')
assert.equal(blockedPage.read('keeper').turns.length,0,'an in-memory empty tombstone prevents same-page resurrection')
blockWrites=false;blockedPage.clear()
assert.equal(blockedRuntime.storage.get(blockedPage.key()).turns.length,0,'retry can durably replace the stale record with an empty owned state')
assert.equal(blockedPage.data.status,'已清空当前角色对话')
assert.equal(blockedPage.data.warning,'')

const legacy=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'ok'})}}})
legacy.storage.set('stemistUser',{id:'legacy-owner'})
legacy.storage.set('stemistTavern:legacy-owner:0:study-buddy',{owner:'legacy-owner',epoch:0,persona:'study-buddy',draft:'旧损友草稿',turns:[{role:'assistant',content:'旧损友历史'}]})
legacy.storage.set('stemistTavern:legacy-owner:0:story-traveler',{owner:'legacy-owner',epoch:0,persona:'story-traveler',draft:'旧冒险草稿',turns:[{role:'assistant',content:'旧冒险历史'}]})
const legacyPage=legacy.page('bundles/coach/tavern');legacyPage.onLoad()
assert.equal(legacyPage.data.selectorOpen,false,'owned legacy history may start collapsed')
assert.equal(legacyPage.data.persona,'study-buddy')
assert.equal(legacyPage.data.message,'旧损友草稿')
assert.equal(legacyPage.data.turns[0].content,'旧损友历史')
legacyPage.choosePersona({currentTarget:{dataset:{persona:'story-traveler'}}})
assert.equal(legacyPage.data.message,'旧冒险草稿')
assert.equal(legacyPage.data.turns[0].content,'旧冒险历史')

const malformed=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'ok'})}}})
malformed.storage.set('stemistUser',{id:'malformed-owner'})
malformed.storage.set('stemistTavern:malformed-owner:0:keeper',{owner:'malformed-owner',epoch:0,persona:'keeper',draft:'',turns:null})
const malformedPage=malformed.page('bundles/coach/tavern')
assert.doesNotThrow(()=>malformedPage.onLoad(),'a malformed stored role must fail closed to the selector')
assert.equal(malformedPage.data.selectorOpen,true)

const epochRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:async()=>({mode:'ai',providerStatus:'connected',answer:'ok'})}}})
epochRuntime.storage.set('stemistUser',{id:'epoch-owner'})
const epochPage=epochRuntime.page('bundles/coach/tavern');epochPage.onLoad();epochPage.choosePersona({currentTarget:{dataset:{persona:'mystery-guide'}}});epochPage.onMessage({detail:{value:'epoch zero private'}})
epochRuntime.storage.set('stemistPrivacyEpoch',1);epochPage.onShow()
assert.equal(epochPage.data.message,'')
assert.match(epochPage.data.error,/账号状态/)
const nextEpoch=epochRuntime.page('bundles/coach/tavern');nextEpoch.onLoad()
assert.equal(nextEpoch.data.selectorOpen,true,'a new privacy epoch cannot restore the previous preset draft')

const late=deferred(),lateRuntime=miniRuntime({modules:{'utils/api':{isAuthError:()=>false,askCoach:()=>late.promise}}})
lateRuntime.storage.set('stemistUser',{id:'late-owner'})
const latePage=lateRuntime.page('bundles/coach/tavern');latePage.onLoad();latePage.choosePersona({currentTarget:{dataset:{persona:'cat-companion'}}});latePage.onMessage({detail:{value:'old owner text'}})
const pending=latePage.submit();await settle();lateRuntime.storage.set('stemistUser',{id:'next-owner'});latePage.onShow();late.resolve({mode:'ai',providerStatus:'connected',answer:'late private reply'});await pending
assert.equal(latePage.data.turns.length,0,'a late reply cannot cross owner boundaries')
assert.doesNotMatch(JSON.stringify(lateRuntime.storage.get('stemistTavern:late-owner:0:cat-companion')),/late private reply/)

const template=fs.readFileSync(new URL('../bundles/coach/tavern.wxml',import.meta.url),'utf8')
const styles=fs.readFileSync(new URL('../bundles/coach/tavern.wxss',import.meta.url),'utf8')
const hub=fs.readFileSync(new URL('../bundles/coach/index.js',import.meta.url),'utf8')
assert.match(template,/休闲精选/)
assert.match(template,/更换预设/)
assert.match(template,/preset-opening/)
assert.match(template,/{{item\.tag}}/)
assert.match(template,/placeholder="{{placeholder}}"/)
assert.match(styles,/\.persona-list\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
assert.match(styles,/\.device-tablet \.persona-list\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
assert.match(styles,/@media\(max-width:330px\)[\s\S]*\.persona-list\{grid-template-columns:1fr\}/)
assert.match(styles,/\.preset-change\{[^}]*min-height:44px/)
assert.match(styles,/\.persona\{[^}]*min-width:0/)
assert.doesNotMatch(styles,/overflow-x:\s*(?:auto|scroll)/)
assert.doesNotMatch(hub,/三位 AI 角色/)
assert.match(hub,/六种休闲预设/)

const luminance=hex=>[1,3,5].map(index=>Number.parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.03928?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
const contrast=(left,right)=>(Math.max(luminance(left),luminance(right))+.05)/(Math.min(luminance(left),luminance(right))+.05)
for(const [foreground,background] of [['#6848d7','#e9e4fc'],['#9b4f70','#fae8f0'],['#9a6328','#fff1dc'],['#356f9d','#e5f3ff'],['#34775f','#e5f5ed'],['#5d5a73','#edeef4'],['#5638b8','#f0ecfb'],['#66708a','#ffffff']])assert.ok(contrast(foreground,background)>=4.5,`${foreground} on ${background} must remain readable`)

console.log('Tavern six-preset catalog, picker, request identity, legacy restore and isolation passed.')
