import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const arg=process.argv.indexOf('--source')
if(arg<0)throw new Error('Supply a verified public native catalog using --source')
const raw=fs.readFileSync(process.argv[arg+1],'utf8'),catalog=JSON.parse(raw)
if(catalog.schemaVersion!=='native-ielts-catalog-v1'||raw.length>600000||/"(?:questions|answer|answerKey|token|password|aiBaseUrl)"\s*:/i.test(raw))throw new Error('Invalid or non-public bootstrap payload')
for(const key of ['listeningTests','readingTests','writingTasks','speakingSets'])if(!Array.isArray(catalog[key]))throw new Error('Incomplete catalog')
const value={schemaVersion:'stemist-ielts-bootstrap-v1',source:'https://ieltsist.com/api/native/ielts/catalog',sha256:crypto.createHash('sha256').update(raw).digest('hex'),catalog}
const out=path.resolve(import.meta.dirname,'../utils/ieltsBootstrap.js')
fs.writeFileSync(out,'// Generated from the published source catalog. No questions, answers or user data.\nmodule.exports='+JSON.stringify(value)+'\n','utf8')
console.log(JSON.stringify({status:'built',file:out,bytes:fs.statSync(out).size,sourceSha256:value.sha256}))
