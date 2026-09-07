import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const root=path.resolve(import.meta.dirname,'..'),r=miniRuntime(),catalog=r.load('utils/ieltsBootstrap').catalog,pack=r.load('utils/ieltsTaskBootstrap'),{unpackTask}=r.load('utils/nativeDataPack')
const {writingPrompt}=r.load('utils/writingPrompt')
if(catalog.version!==pack.version)throw Error('Topic metadata requires the exact existing source bundle version')
const source=fs.readFileSync('D:/CodexWork/ielts-native-production-candidate/public/app.js','utf8')
const writingBlock=source.slice(source.indexOf('function writingTopicRules()'),source.indexOf('function writingTopicMeta('))
const rules=[...writingBlock.matchAll(/title: "([^"]+)", emoji: "[^"]+", accent: "([^"]+)", pattern: \/(.*?)\/(i?)/g)].map(([,label,key,pattern,flags])=>({label,key,pattern:new RegExp(pattern,flags)}))
if(rules.length<16)throw Error('The established Writing taxonomy could not be parsed')
const speakingBlock=source.match(/const speakingTopicCatalog = \[([\s\S]*?)\n\];/)?.[1]
if(!speakingBlock)throw Error('The established Speaking taxonomy is missing')
const speaking=speakingBlock.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('[')).map(line=>JSON.parse(line.replace(/,\s*$/,'')))
const icons={'food-agriculture':'food','education-learning':'education','technology-digital':'technology','work-career':'work','environment-climate':'environment','transport-mobility':'transport','cities-housing':'architecture','health-lifestyle':'health','family-children':'society','crime-law':'law','government-public':'history','culture-traditions':'culture','media-advertising':'media','globalisation-language':'travel','consumerism-money':'business','science-research':'science','charts-data':'business','essay-general':'education'}
const items={}
for(const entry of catalog.writingTasks){
 const task=unpackTask(pack,entry.id);if(!task)throw Error('Missing existing task '+entry.id)
 if(!/task2$/i.test(entry.id)&&!/^Task 2\b/i.test(task.type||''))continue
 // Old PDF extraction may include the next module. Reuse the verified task
 // boundary for display classification without rewriting the original source.
 const text=[writingPrompt(task.prompt||task.data,entry.id),task.title].filter(Boolean).join(' ').replace(/present a written argument or case to an educated reader with no specialist knowledge/gi,' ').replace(/\bacademic\b/gi,' ').replace(/you should spend about \d+ minutes on this task/gi,' ').replace(/write at least \d+ words/gi,' ')
 const topic=rules.find(rule=>rule.key===task.topicSubcategory)||rules.find(rule=>rule.pattern.test(text))||rules.find(rule=>rule.key==='essay-general')
 items[entry.id]={key:'writing-'+topic.key,label:topic.label,icon:icons[topic.key]||'education'}
}
const categories={people:'society',place:'travel',lifestyle:'culture',education:'education',technology:'technology',media:'media',nature:'environment',work:'work',society:'society'}
for(const entry of catalog.speakingSets){
 const task=unpackTask(pack,entry.id);if(!task)throw Error('Missing existing task '+entry.id)
 const primary=String(task.part1Topic||entry.title),matches=[]
 for(const [i,topic]of speaking.entries())for(const alias of topic[3]||[]){const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('(?:^|[^a-z])'+escaped+'(?:$|[^a-z])','i').test(primary))matches.push({topic,score:alias.length*1000-i})}
 const topic=matches.sort((a,b)=>b.score-a.score)[0]?.topic,label=topic?.[0]||primary
 items[entry.id]={key:'speaking-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),label,icon:/money|business|shopping/i.test(label)?'business':/history/i.test(label)?'history':/culture|art/i.test(label)?'culture':categories[topic?.[2]]||'education'}
}
const output={version:catalog.version,sourceRulesSha256:crypto.createHash('sha256').update(writingBlock+speakingBlock).digest('hex'),items}
if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'utils/ieltsTopicIndex.js'),'// Derived display metadata only. Original task IDs, prompts and assets are unchanged.\nmodule.exports='+JSON.stringify(output)+'\n','utf8')
console.log(JSON.stringify({version:catalog.version,writing:Object.keys(items).filter(id=>id.includes('-w-')).length,speaking:catalog.speakingSets.length,metadataBytes:Buffer.byteLength(JSON.stringify(output)),originalsWritten:0,written:process.argv.includes('--write')}))
