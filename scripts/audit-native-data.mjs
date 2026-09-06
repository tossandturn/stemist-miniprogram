import fs from 'node:fs'
import path from 'node:path'
const arg=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1]}
const ieltsRoot=path.resolve(arg('--ielts-root','D:/CodexWork/ielts-trainer'))
const stemRoot=path.resolve(arg('--stem-root','D:/CodexWork/alevel-learning-platform'))
const ocrRoot=path.resolve(arg('--ocr-root','D:/CodexWork/stem-ocr-work'))
const output=arg('--out','')
const date=arg('--date','')
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Pass the live Windows local date with --date')
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const bank=json(path.join(ieltsRoot,'data/cambridge-local-bank.json'))
const speaking=json(path.join(ieltsRoot,'data/speaking-bank.json'))
const report={date,ielts:{local:{listening:bank.listeningTests.length,reading:bank.readingTests.length,writing:bank.writingTasks.length,speaking:speaking.speakingSets.length},sourceBytes:fs.statSync(path.join(ieltsRoot,'data/cambridge-local-bank.json')).size},papers:{},ocr:{},notes:['Counts describe source inventory, not reviewed or released eligibility.','No OCR worker, queue, canonical artifact, provider or database was changed.']}
for(const subject of ['0580','0606','0610','0625','9231','9700','9701','9702','9708','9709','bpho','amc12','esat','tmua']){
 const file=path.join(stemRoot,'public/data/papers',subject+'.json')
 if(!fs.existsSync(file)){report.papers[subject]={missing:true};continue}
 const catalog=json(file),items=catalog.items.filter(i=>i.kind==='qp'&&i.governance?.state==='active')
 const byId=new Map(catalog.items.map(i=>[i.id,i]))
 report.papers[subject]={activeQuestionPapers:items.length,paired:items.filter(i=>byId.get(i.markSchemeId)?.pairKey===i.pairKey).length,integrityPending:items.filter(i=>i.governance?.integrityStatus==='pending-release-audit').length}
}
const manifest=json(path.join(ocrRoot,'manifest/manifest.json'))
report.ocr.manifestJobs=manifest.jobs.length
report.ocr.bySubject={}
const statuses=new Set(['pending','running','processing','in_progress','completed','complete','done','failed','error','partial','quarantined','ocr-complete-pending-review'])
for(const job of manifest.jobs){
 const subject=String(job.subject||'unknown');const counts=report.ocr.bySubject[subject]||={jobs:0,statuses:{}}
 counts.jobs++
 const statePath=path.resolve(ocrRoot,String(job.statePath||'')),relative=path.relative(ocrRoot,statePath)
 let status='not-created'
 if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&fs.existsSync(statePath)){
  try{const state=json(statePath);status=statuses.has(state.status)?state.status:'other'}catch{status='unreadable'}
 }
 counts.statuses[status]=(counts.statuses[status]||0)+1
}
try{
 const response=await fetch('https://ieltsist.com/api/tasks',{signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw new Error('HTTP '+response.status)
 const active=await response.json()
 report.ielts.production={listening:active.listeningTests.length,reading:active.readingTests.length,writing:active.writingTasks.length,speaking:active.speakingSets.length}
 report.ielts.countDifference=Object.fromEntries(Object.entries(report.ielts.local).map(([key,count])=>[key,count-report.ielts.production[key]]))
}catch(error){report.ielts.productionCheck=error.message}
if(output){const target=path.resolve(output);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n','utf8')}
console.log(JSON.stringify(report,null,2))
