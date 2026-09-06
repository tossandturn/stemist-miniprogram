import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]}
const sourceRoot=path.resolve(arg('--source','D:/CodexWork/ielts-trainer/public/data'))
const outputRoot=path.resolve(arg('--out','D:/CodexWork/native-content-release/vocabulary'))
const inputs=['ielts-core-vocabulary.json','alevel-stem-vocabulary.json'].map(name=>fs.readFileSync(path.join(sourceRoot,name)))
const version='v1-'+crypto.createHash('sha256').update(Buffer.concat(inputs)).digest('hex').slice(0,16)
const target=path.join(outputRoot,version)
fs.mkdirSync(target,{recursive:true})
const items=inputs.flatMap((bytes,index)=>JSON.parse(bytes.toString('utf8')).items.map(item=>({...item,bank:index?'stem':'ielts'})))
if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('Vocabulary IDs are not unique')
const files=[]
function write(name,value){const body=JSON.stringify(value);const file=path.join(target,name);if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==body)throw new Error('Immutable vocabulary file differs: '+name);if(!fs.existsSync(file))fs.writeFileSync(file,body,'utf8');files.push({name,bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex')})}
const index=[]
for(let offset=0;offset<items.length;offset+=80){
 const chunk=String(Math.floor(offset/80)).padStart(4,'0')+'.json',part=items.slice(offset,offset+80)
 write(chunk,{schemaVersion:'native-vocabulary-chunk-v1',items:part})
 for(const item of part)index.push({id:item.id,word:item.word,meaning:item.meaning,subject:item.subject,stage:item.stage||'',topicLabel:item.topicLabel||'',bank:item.bank,chunk})
}
write('index.json',{schemaVersion:'native-vocabulary-index-v1',version,items:index})
write('manifest.json',{schemaVersion:'native-vocabulary-release-v1',version,itemCount:items.length,files:files.slice()})
console.log(JSON.stringify({version,directory:target,items:items.length,indexBytes:files.find(f=>f.name==='index.json').bytes,maxChunkBytes:Math.max(...files.filter(f=>/^\d/.test(f.name)).map(f=>f.bytes)),totalBytes:files.reduce((sum,f)=>sum+f.bytes,0),subjects:[...new Set(items.map(i=>i.subject))]}))
