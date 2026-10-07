import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8')
const surfaces=[
 ['pages/papers/index','pdfDownload'],['pages/stem/paper','pdfDownload'],
 ['bundles/curricula/index','pdfDownload'],['bundles/marking/index','documentProgress'],
 ['pages/ielts/writing','reportDownload'],['pages/ielts/writing-full','reportDownload'],
 ['pages/ielts/listening','audioProgress','pages/ielts/objective.wxml'],
]
for(const [page,state,template=page+'.wxml'] of surfaces){
 assert.equal(JSON.parse(read(page+'.json')).usingComponents['pdf-download-progress'],'/components/pdf-download-progress/index',page+' registers the shared bar')
 assert.match(read(template),new RegExp('<pdf-download-progress[^>]*state="\\{\\{'+state+'\\}\\}"'),page+' renders its transfer state')
}
const expected=[
 'bundles/marking/reportDownload.js','pages/ielts/writingReportDownload.js',
 'utils/listeningAudioCache.js','utils/listeningAudioRangeCache.js','utils/pdfDownload.js','utils/pdfRangeCache.js',
].sort(),transports=[]
for(const directory of ['pages','components','utils','bundles'])for(const relative of fs.readdirSync(path.join(root,directory),{recursive:true})){
 if(!relative.endsWith('.js'))continue
 const file=directory+'/'+relative.replaceAll('\\','/'),source=read(file)
 if(/\b(?:wx|wxApi)\.downloadFile\s*\(|responseType:\s*['"]arraybuffer['"]/.test(source))transports.push(file)
}
assert.deepEqual(transports.sort(),expected,'Every new binary download transport must be mapped to a visible progress surface and tested')
for(const file of expected)assert.match(read(file),/onProgress|\.progress\(/,file+' publishes measured transfer progress')
console.log('Download coverage: A-Level/AP/IB papers and answers, whole-paper answer/report/temporary preview, IELTS writing reports and listening audio all render shared bars.')
