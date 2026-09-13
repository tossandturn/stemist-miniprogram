// Explicit opt-in, public source data only; nothing is persisted or uploaded.
import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
if(!process.argv.includes('--public-live'))throw Error('Use --public-live to check the production public vocabulary')
const version=fs.readFileSync(new URL('../utils/nativeVocabulary.js',import.meta.url),'utf8').match(/const VERSION='([^']+)'/)[1]
async function get(url){const response=await fetch('https://ieltsist.com'+url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer())}
const originals=await Promise.all(['ielts-core-vocabulary.json','alevel-stem-vocabulary.json'].map(name=>get('/data/'+name)))
assert.equal('v1-'+crypto.createHash('sha256').update(Buffer.concat(originals)).digest('hex').slice(0,16),version,'native version must derive from the current web source bytes')
const items=originals.flatMap((bytes,i)=>JSON.parse(bytes).items.map(item=>({...item,bank:i?'stem':'ielts'})))
const root='/data/native-vocabulary/'+version,index=JSON.parse(await get(root+'/index.json'))
assert.equal(index.version,version);assert.equal(index.items.length,items.length)
assert.deepEqual(index.items.map(x=>x.id),items.map(x=>x.id))
for(const entry of index.items){const source=items.find(i=>i.id===entry.id);for(const key of ['word','meaning','subject','bank'])assert.equal(entry[key],source[key])}
const chunks=[...new Set([index.items[0].chunk,index.items[303].chunk,index.items[304].chunk,index.items.at(-1).chunk])]
let checked=0
for(const chunk of chunks){for(const detail of JSON.parse(await get(root+'/'+chunk)).items){assert.deepEqual(detail,items.find(i=>i.id===detail.id));checked++}}
console.log(JSON.stringify({status:'pass',version,items:items.length,ielts:items.filter(i=>i.bank==='ielts').length,professional:items.filter(i=>i.bank==='stem').length,sampledFullEntries:checked,chunks:chunks.length,privateDataRead:false}))
