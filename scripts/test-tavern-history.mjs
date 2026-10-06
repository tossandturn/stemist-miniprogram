import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime } from './helpers/mini-runtime.mjs'

await import('../bundles/coach/test-tavern-long-memory.mjs')
await import('../bundles/coach/test-tavern-long-memory-page.mjs')

let requestOptions
const runtime=miniRuntime({wx:{request:options=>{requestOptions=options;options.success({statusCode:200,data:{mode:'ai',providerStatus:'connected',answer:'academic ok'}})}}})
runtime.storage.set('stemistUser',{id:'academic-owner'});runtime.storage.set('stemistSessionToken','fixture-session')
const twentyFive=Array.from({length:25},(_,index)=>[{role:'user',content:`user-${index+1}`},{role:'assistant',content:`assistant-${index+1}`}]).flat()
await runtime.load('utils/api').askCoach({message:'academic unchanged',context:{product:'STEM Studio'},history:twentyFive})
assert.equal(requestOptions.url,'https://stem.ieltsist.com/api/ai/coach')
assert.equal(requestOptions.data.history.length,10,'ordinary academic askCoach remains on its existing 10-message bound')
assert.equal(requestOptions.data.history[0].content,'user-21')

const tavernSource=fs.readFileSync(new URL('../bundles/coach/tavern.js',import.meta.url),'utf8')
const divinationSource=fs.readFileSync(new URL('../bundles/coach/tavernDivination.js',import.meta.url),'utf8')
assert.doesNotMatch(tavernSource+divinationSource,/boundedTavernHistory|TAVERN_HISTORY_MAX_ROUNDS|24000/,'Tavern display, storage and provider memory are no longer conflated by the old 20-round helper')
for(const directory of ['pages','components','utils']){
 const pending=[new URL(`../${directory}/`,import.meta.url)]
 while(pending.length){const current=pending.pop();for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=new URL(entry.name+(entry.isDirectory()?'/':''),current);if(entry.isDirectory())pending.push(target);else if(entry.name.endsWith('.js'))assert.doesNotMatch(fs.readFileSync(target,'utf8'),/tavernConversation/,'academic and main-package modes stay unchanged')}}
}

console.log('Tavern long-memory child contract and unchanged academic Coach transport passed.')
