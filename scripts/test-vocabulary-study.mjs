import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
const index=[{id:'i2',word:'significant',meaning:'显著的',subject:'ielts',bank:'ielts',topicLabel:'Academic Core',stage:''},{id:'i1',word:'adapt',meaning:'适应',subject:'ielts',bank:'ielts',topicLabel:'Environment',stage:''},{id:'p',word:'scalar',meaning:'标量',subject:'physics',bank:'stem',topicLabel:'Measurement',stage:'AS'},{id:'b',word:'binary',meaning:'二进制',subject:'computer-science',bank:'stem',topicLabel:'Data',stage:'IGCSE'}]
const details=Object.fromEntries(index.map(x=>[x.id,{...x,definition:'source definition',conceptExplanation:'source concept',methodSteps:['source step'],examFocus:'source focus',formula:'x^2',formulaExplanation:'source conditions',workedExample:{question:'source question',steps:['source solution'],answer:'source answer'},collocations:['source collocation'],commonMistake:'source mistake'}]))
const writes=[]
const r=miniRuntime({modules:{
 'utils/nativeVocabulary':{vocabularyIndex:async()=>index,vocabularyDetail:async id=>details[id]},
 'utils/ieltsLearning':{requestIeltsLearning:async(path,body)=>{writes.push({path,body});return {ok:true}}},
}})
r.storage.set('stemistVocabProgress:guest',{legacy:{level:4,due:123},i2:{level:2,due:0}})
const p=r.page('pages/ielts/vocabulary');await p.onLoad({});await settle()
assert.equal(p.data.word.id,'i1','default opens alphabetic full IELTS card, not a raw list')
assert.equal(p.data.total,2);assert.equal(p.data.due,1,'unseen words are not overdue')
assert.deepEqual([...p.data.word.methodSteps],['source step']);assert.equal(p.data.word.workedExample.answer,'source answer')
p.setMode({currentTarget:{dataset:{mode:'recall'}}});await settle();assert.equal(p.data.revealed,false)
p.reveal();assert.equal(p.data.revealed,true)
await p.remember({currentTarget:{dataset:{known:'yes'}}});await settle()
assert.equal(p.data.word.id,'i2','rating advances to the next card')
assert.equal(r.storage.get('stemistVocabProgress:guest').legacy.level,4,'legacy record survives')
assert.equal(r.storage.get('stemistVocabProgress:guest').i1.level,1)
p.openPacks();p.choosePack({currentTarget:{dataset:{pack:'igcse'}}});assert.equal(p.data.subjects.length,1)
await p.chooseSubject({currentTarget:{dataset:{subject:'computer-science'}}});await settle();assert.equal(p.data.word.id,'b');assert.equal(p.data.total,1)
p.openPacks();p.choosePack({currentTarget:{dataset:{pack:'alevel'}}});assert.equal(p.data.subjects.some(x=>x.id==='physics'),true);assert.equal(p.data.subjects.some(x=>x.id==='computer-science'),false)
await p.chooseSubject({currentTarget:{dataset:{subject:'physics'}}});await settle();await p.saveWord();assert.equal(writes.length,0,'guest save is local, not an unauthorized sync')
assert.equal(r.storage.get('stemistSavedWord:guest:p').methodSteps[0],'source step')
const oldLevel=r.storage.get('stemistVocabProgress:guest').p
r.storage.set('stemistUser',{id:'other'});await p.remember({currentTarget:{dataset:{known:'yes'}}});assert.equal(r.storage.get('stemistVocabProgress:guest').p,oldLevel)
p.onShow();assert.equal(p.data.word,null,'account change removes private study view');p.onUnload()
const util=r.load('utils/vocabularyStudy')
const styles=fs.readFileSync(new URL('../pages/ielts/vocabulary.wxss',import.meta.url),'utf8')
assert.doesNotMatch(styles,/\.vocabulary-page button\s*\{/,'page button reset must not leak into the shared AI Coach')
assert.match(styles,/\.device-tablet\.landscape \.vocab-workspace/)
assert.equal(util.isDue({},'new',new Set(),Date.now()),false)
assert.equal(util.isDue({},'saved',new Set(['saved']),Date.now()),true)
const payload=util.notebookPayload({...details.p,definition:'x'.repeat(5000)})
assert.ok(payload.explanation.length<=3000);const structured=JSON.parse(payload.explanation.slice('__IELTS_VOCAB_IMPORT__'.length));assert.equal(structured.subject,'physics');assert.equal(structured.id,'p')
assert.equal(util.savedIds([{...payload}],index).has('p'),true,'same Notebook marker round-trips the canonical subject identity')
let failSync=true
const sr=miniRuntime({modules:{
 'utils/nativeVocabulary':{vocabularyIndex:async()=>index,vocabularyDetail:async id=>details[id]},
 'utils/ieltsLearning':{requestIeltsLearning:async(path,body)=>{if(!body)return {items:[]};if(failSync)throw Error('offline');return {ok:true}}},
}})
sr.storage.set('stemistUser',{id:'student'});sr.storage.set('stemistSessionToken','fixture')
const sp=sr.page('pages/ielts/vocabulary');await sp.onLoad({});await sp.saveWord();assert.equal(sp.data.syncPending,true);assert.equal(sp.data.saved,true)
failSync=false;await sp.saveWord();assert.equal(sp.data.syncPending,false);assert.equal(sr.storage.get('stemistSavedWord:student:i1').syncPending,false);sp.onUnload()
const race=deferred(),rr=miniRuntime({modules:{'utils/nativeVocabulary':{vocabularyIndex:async()=>index,vocabularyDetail:()=>race.promise}}}),q=rr.page('pages/ielts/vocabulary')
q.onLoad({});await settle();q.openPacks();q.choosePack({currentTarget:{dataset:{pack:'alevel'}}});race.resolve(details.i1);await settle();assert.equal(q.data.word,null,'late detail cannot reopen a different pack');q.onUnload()
console.log('Vocabulary study: source fields, subject/stage packs, focused cards, recall/advance, due semantics, preservation, notebook protocol and stale/account guards passed.')
