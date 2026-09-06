import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const requests=[]
const r=miniRuntime({modules:{
 'utils/coach':{runCoach:async request=>{requests.push(request);return {mode:'ai',providerStatus:'connected',answer:'Read the evidence.',coachState:{label:'AI 已连接'}}}},
 'utils/ieltsLearning':{requestIeltsLearning:async()=>({paperText:'READING PASSAGE 1\nNot this one.\nREADING PASSAGE 2\nRelevant evidence.\nREADING PASSAGE 3\nLater.'})}
}})
r.storage.set('stemistUser',{id:'ielts:1'})
const entry=r.load('utils/coachEntry')
const key=entry.stageCoachEntry({product:'IELTSist',skill:'reading',taskId:'cam15-r-test1',title:'Reading source',section:2,focusedQuestion:{id:'q14',number:14},coach:{focusedQuestion:{id:'q14',number:14}},reading:{id:'cam15-r-test1',paperText:'',questions:[{id:'q14',number:14,studentAnswer:'A'}]}})
const p=r.page('pages/coach/index');p.onLoad({source:'reading',entry:key});p.onMessage({detail:{value:'Why is this wrong?'}});await p.submit()
assert.equal(requests[0].context.reading.id,'cam15-r-test1')
assert.match(requests[0].context.reading.paperText,/Relevant evidence/)
assert.doesNotMatch(requests[0].context.reading.paperText,/Not this one|Later/)
p.onMessage({detail:{value:'Explain the next step.'}});await p.submit();assert.equal(requests[1].history.length,2)
p.clear();assert.equal(p.__history.length,0,'clear starts a genuinely new conversation')
r.storage.set('stemistCoachTurns:ielts:1:writing',{corrupt:true})
p.chooseContext({currentTarget:{dataset:{context:'writing'}}});assert.equal(p.__history.length,0,'invalid persisted history cannot break sending')
r.storage.set('stemistPrivacyEpoch',1);await p.submit();assert.equal(requests.length,2,'old-account context cannot be sent after logout')
p.onUnload()
console.log('Native Coach: owned current-question context, focused source passage, follow-up history and logout isolation passed.')
const photos=[]
const v=miniRuntime({modules:{'utils/image':{readAsJpegDataUrl:async file=>{photos.push(file);return 'data:image/png;base64,fixture'}},'utils/coach':{runCoach:async request=>{photos.push(request);return {mode:'ai',providerStatus:'connected',answer:'Visible evidence',coachState:{label:'AI'}}}}}})
v.storage.set('stemistUser',{id:'ielts:2'})
const key2=v.load('utils/coachEntry').stageCoachEntry({product:'IELTSist',skill:'writing',taskId:'task2',imagePaths:['/owned/photo.jpg'],contextText:'Current task'})
const q=v.page('pages/coach/index');q.onLoad({source:'writing',entry:key2});q.onMessage({detail:{value:'Check my photograph'}});await q.submit()
assert.equal(photos[0],'/owned/photo.jpg');assert.equal(photos[1].imageDataUrls[0],'data:image/png;base64,fixture');assert.equal(photos[1].context.imagePaths,undefined,'device-local paths never go to the model')
const writing=v.page('pages/ielts/writing');writing.onLoad();writing.setData({inputMode:'photo',photoPath:'/owned/photo.jpg',text:'Old unrelated typed draft',prompt:'Current task'})
const snapshot=writing.getCoachContext();assert.deepEqual([...snapshot.imagePaths],['/owned/photo.jpg']);assert.doesNotMatch(snapshot.contextText,/Old unrelated/)
q.onUnload();writing.onUnload()
