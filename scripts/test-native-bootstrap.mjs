import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let calls=0
const r=miniRuntime({modules:{'utils/api':{IELTS_API_BASE:'https://ieltsist.com',requestIeltsJson:async()=>{calls++;throw new Error('offline')}}}})
const content=r.load('utils/ieltsContent')
r.storage.set('stemistPublicIeltsCatalog',{payload:{schemaVersion:'native-ielts-catalog-v1',version:'older-version',listeningTests:[],readingTests:[],writingTasks:[],speakingSets:[]},at:Date.now(),builtAgainst:'previous-app-bundle'})
const start=performance.now(),bank=await content.loadIeltsContent()
assert.ok(bank.reading.length>=72);assert.ok(bank.listening.length>=72);assert.equal(calls,0,'the first catalog never waits on a network request')
assert.equal(bank.reading[0].questions.length,0)
await assert.rejects(()=>content.loadIeltsContent({refresh:true}))
assert.equal((await content.loadIeltsContent()).reading.length,bank.reading.length,'failed revalidation does not erase the known catalog')
console.log(JSON.stringify({status:'pass',bootstrapMs:Math.round(performance.now()-start),initialNetworkRequests:0,reading:bank.reading.length}))
