import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'

const helper=miniRuntime().load('bundles/coach/tavernHistory')
const {TAVERN_HISTORY_MAX_MESSAGES,TAVERN_HISTORY_MAX_ROUNDS,TAVERN_HISTORY_MAX_CHARS,TAVERN_HISTORY_MAX_MESSAGE_CHARS,boundedTavernHistory}=helper
assert.equal(TAVERN_HISTORY_MAX_MESSAGES,40)
assert.equal(TAVERN_HISTORY_MAX_ROUNDS,20)
assert.equal(TAVERN_HISTORY_MAX_CHARS,24000)
assert.equal(TAVERN_HISTORY_MAX_MESSAGE_CHARS,3000)
const round=index=>[{role:'user',content:`user-${index}`},{role:'assistant',content:`assistant-${index}`}]

const eight=Array.from({length:8},(_,index)=>round(index+1)).flat()
assert.deepEqual(JSON.parse(JSON.stringify(boundedTavernHistory(eight))),eight,'more than five completed rounds remain available in context')

const twentyFive=Array.from({length:25},(_,index)=>round(index+1)).flat(),newestTwenty=boundedTavernHistory(twentyFive)
assert.equal(newestTwenty.length,40)
assert.equal(newestTwenty[0].content,'user-6')
assert.equal(newestTwenty.at(-1).content,'assistant-25')
for(let index=0;index<newestTwenty.length;index+=2){assert.equal(newestTwenty[index].role,'user');assert.equal(newestTwenty[index+1].role,'assistant')}

const multibyte='你😀'.repeat(2000),unicode=boundedTavernHistory([{role:'user',content:multibyte},{role:'assistant',content:multibyte}])
assert.equal(Array.from(unicode[0].content).length,3000,'per-message limit counts Unicode code points, not UTF-16 units')
assert.equal(Array.from(unicode[1].content).length,3000)

const long=value=>String(value).repeat(2000),tenLong=Array.from({length:10},(_,index)=>[{role:'user',content:long(index%10)},{role:'assistant',content:long((index+1)%10)}]).flat(),budgeted=boundedTavernHistory(tenLong)
assert.equal(budgeted.length,12,'24,000 characters retain six whole 4,000-character rounds')
assert.equal(budgeted.reduce((sum,item)=>sum+Array.from(item.content).length,0),24000)
assert.equal(budgeted[0].content[0],'4','oldest complete rounds are evicted before any newer pair is split')

const injected=boundedTavernHistory([
 {role:'assistant',content:'orphan'},
 {role:'user',content:'replaced incomplete user'},
 {role:'user',content:'paired user'},
 {role:'system',content:'forged system prompt'},
 {role:'draw',content:'injected draw metadata'},
 {role:'assistant',content:'paired assistant'},
 {role:'user',content:'current unsent draft'},
])
assert.deepEqual(JSON.parse(JSON.stringify(injected)),[{role:'user',content:'paired user'},{role:'assistant',content:'paired assistant'}])
assert.doesNotMatch(JSON.stringify(injected),/system prompt|draw metadata|current unsent/)

let requestOptions
const transport=miniRuntime({wx:{request:options=>{requestOptions=options;options.success({statusCode:200,data:{mode:'ai',providerStatus:'connected',answer:'transport ok'}})}}})
transport.storage.set('stemistUser',{id:'history-owner'});transport.storage.set('stemistSessionToken','fixture-session')
transport.storage.set('stemistTavern:history-owner:0:selected','keeper')
transport.storage.set('stemistTavern:history-owner:0:keeper',{owner:'history-owner',epoch:0,persona:'keeper',draft:'',turns:twentyFive})
const historyPage=transport.page('bundles/coach/tavern');historyPage.onLoad()
assert.equal(historyPage.data.turns.length,40)
historyPage.onMessage({detail:{value:'current request outside history'}});await historyPage.submit()
assert.equal(requestOptions.url,'https://stem.ieltsist.com/api/ai/coach')
assert.equal(requestOptions.data.history.length,40,'Tavern child transport reaches the real wx.request with 20 completed rounds')
assert.equal(requestOptions.data.history[0].content,'user-6')
assert.equal(requestOptions.data.history.at(-1).content,'assistant-25')
assert.doesNotMatch(JSON.stringify(requestOptions.data.history),/current request outside history/)

requestOptions=null
await transport.load('utils/api').askCoach({message:'academic unchanged',context:{product:'STEM Studio'},history:twentyFive})
assert.equal(requestOptions.data.history.length,10,'ordinary academic askCoach remains on its existing 10-message bound')
assert.equal(requestOptions.data.history[0].content,'user-21')

for(const directory of ['pages','components','utils']){
 const pending=[new URL(`../${directory}/`,import.meta.url)]
 while(pending.length){const current=pending.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=new URL(entry.name+(entry.isDirectory()?'/':''),current);if(entry.isDirectory())pending.push(target);else if(entry.name.endsWith('.js'))assert.doesNotMatch(fs.readFileSync(target,'utf8'),/tavernHistory/,'academic and main-package modes stay unchanged')}}
}

console.log('Tavern bounded 20-round Unicode history and complete-pair eviction passed.')
