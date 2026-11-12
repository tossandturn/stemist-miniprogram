import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
const version='v1-68e798a26bcb965d',calls=[],wait=deferred();let failChunk=true
const r=miniRuntime({modules:{'utils/api':{requestIeltsJson:async(url,body,options)=>{
 calls.push({url,body,options});assert.equal(options.method,'GET')
 if(url.endsWith('index.json'))return{schemaVersion:'native-vocabulary-index-v1',version,items:[{id:'one',word:'one',chunk:'0000.json'},{id:'two',word:'two',chunk:'0001.json'}]}
 if(url.endsWith('0000.json'))return{schemaVersion:'native-vocabulary-chunk-v1',items:[{id:'one',word:'one',definition:'first public entry'}]}
 if(failChunk){await wait.promise;throw Object.assign(Error('request:fail timeout'),{code:'network_timeout',errno:5})}
 return{schemaVersion:'native-vocabulary-chunk-v1',items:[{id:'two',word:'two',definition:'second public entry'}]}
}}}})
const vocab=r.load('utils/nativeVocabulary')
assert.equal((await vocab.vocabularyDetail('one')).definition,'first public entry')
const a=vocab.vocabularyDetail('two'),b=vocab.vocabularyDetail('two');const pending=Promise.allSettled([a,b]);await settle()
assert.equal(calls.filter(c=>c.url.endsWith('0001.json')).length,1,'concurrent loads share one request')
wait.resolve();assert.ok((await pending).every(p=>p.status==='rejected'))
const before=calls.length;assert.equal((await vocab.vocabularyDetail('one')).word,'one');assert.equal(calls.length,before,'timeout preserves already loaded public chunk')
failChunk=false;assert.equal((await vocab.vocabularyDetail('two')).word,'two')
assert.equal(calls.filter(c=>c.url.endsWith('0001.json')).length,2,'explicit retry clears failed single-flight and requests exactly once')
assert.equal(calls.filter(c=>c.url.endsWith('index.json')).length,1,'directory remains cached')
assert.ok(calls.every(c=>c.body===undefined),'no state-changing replay')
console.log('PASS vocabulary timeout: same-request coalescing, cached content preserved, one explicit GET retry')
