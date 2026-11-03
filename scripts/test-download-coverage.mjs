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
 'bundles/coach/practiceRender.js',
 'bundles/marking/reportDownload.js','pages/ielts/writingReportDownload.js',
 'utils/listeningAudioCache.js','utils/listeningAudioRangeCache.js','utils/pdfDownload.js','utils/pdfRangeCache.js',
].sort(),transports=[],generatedImageTransports=[]
for(const directory of ['pages','components','utils','bundles'])for(const relative of fs.readdirSync(path.join(root,directory),{recursive:true})){
 if(!relative.endsWith('.js'))continue
 const file=directory+'/'+relative.replaceAll('\\','/'),source=read(file)
 if(/\b(?:wx|wxApi)\.downloadFile\s*\(/.test(source)||(/responseType:\s*['"]arraybuffer['"]/.test(source)&&file!=='utils/api.js'))transports.push(file)
 else if(file==='utils/api.js'&&/responseType:\s*['"]arraybuffer['"]/.test(source)&&/\/api\/ai\/tavern\/image/.test(read('bundles/coach/tavernConversation.js'))&&/requestBinaryAt/.test(source))generatedImageTransports.push(file)
}
assert.deepEqual(transports.sort(),expected,'Every new binary download transport must be mapped to a visible progress surface and tested')
assert.deepEqual(generatedImageTransports.sort(),['utils/api.js'],'Model-generated image bytes are not counted as a student download transport')
assert.match(read('scripts/test-tavern-image-api-client.mjs'),/responseType.*arraybuffer/,'binary generated-image transport has a dedicated authenticated regression')
assert.match(read('bundles/coach/tavern.wxml'),/story-image-pending/,'image generation displays a truthful in-chat pending state')
for(const file of expected)assert.match(read(file),/onProgress|\.progress\(/,file+' publishes measured transfer progress')
assert.match(read('bundles/coach/practice.wxml'),/<progress[^>]*percent="\{\{percent\}\}"/,'chapter image preparation renders real transfer progress')
assert.match(read('bundles/coach/practice.js'),/loaded\/total\*100/,'chapter progress is measured bytes, not a timer')
assert.match(read('scripts/test-chapter-coach-render.mjs'),/p\.loaded===100&&p\.total===100/,'chapter download progress has a runtime regression')
console.log('Download coverage: A-Level/AP/IB papers and answers, whole-paper answer/report/temporary preview, IELTS writing reports and listening audio all render shared bars.')
