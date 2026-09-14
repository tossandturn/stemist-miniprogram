import assert from 'node:assert/strict'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),n=r.load('utils/nativePractice')
const topics=[7,5].map((count,i)=>({id:'t'+i,apiStartable:true,questionIdsByComponent:{1:{verifiedQuestionIds:Array.from({length:count},(_,j)=>'p'+i+'q'+j),apiReadyQuestionIds:Array.from({length:count},(_,j)=>'p'+i+'q'+j)}}}))
const inv={practicePolicy:{schemaVersion:'stem-topic-practice-policy-v1',minSourceGroups:6,minReviewedGroups:12,setSizes:[6,10,15],allowReviewedSubsetStudy:true,allowCrossTopicStudy:true},paperComponents:[1],topics}
const state=n.selectionState(inv,['t0','t1'],[1],6)
assert.equal(state.availableCount,12);assert.equal(state.canStart,true,'7 + 5 source questions can produce a 6-question study set')
assert.equal(state.ready,false);assert.equal(state.studyReady,true)
assert.equal(n.selectionState(inv,['t1'],[1],6).canStart,false)
inv.practicePolicy.allowCrossTopicStudy=false;assert.equal(n.selectionState(inv,['t0','t1'],[1],6).canStart,false);inv.practicePolicy.allowCrossTopicStudy=true
assert.equal(n.selectionState(inv,['t0','missing'],[1],6).canStart,false)
const f=r.load('utils/questionFocus'),url='/question-assets/paper/qp-03.jpg'
const focus={schemaVersion:'native-question-focus-v1',sourceQuestionId:'paper:q1',paperId:'paper',pages:[{page:3,url,region:[.1,.1,.9,.3],imageSize:[1000,1400]}]}
assert.equal(f.normalizeQuestionFocus(focus,'paper','paper:q1',[url])[0].region[1],.1)
for(const change of [x=>x.sourceQuestionId='paper:q2',x=>x.pages[0].page=4,x=>x.pages[0].region[3]=2,x=>x.pages[0].url='/question-assets/other/qp-03.jpg']){const bad=structuredClone(focus);change(bad);assert.throws(()=>f.normalizeQuestionFocus(bad,'paper','paper:q1',[url]))}
const options=f.choiceOptions(['A pressure','B temperature','C weight','D work'])
assert.deepEqual(options.map(x=>x.label),['A','B','C','D']);assert.equal(options[2].text,'weight')
assert.throws(()=>f.choiceOptions(['B pressure','A temperature','C weight','D work']))
assert.equal(f.choiceOptions([{label:'A',text:'B cells'},{label:'B',text:'A cells'},{label:'C',text:''},{label:'D',text:''}])[0].text,'B cells')
assert.deepEqual(Array.from(f.choiceOptions(null),x=>x.text),['','','',''])
const session={schema:1,id:'mini-set-focus-fixture',owner:'',privacyEpoch:0,routeId:'cie-9702-as-physics',stage:'AS',subjectCode:'9702',answers:{},index:0,questions:[{id:'paper:q1',paperId:'paper',number:'Q1',component:1,marks:1,parts:[],images:[url],sourceRegions:f.normalizeQuestionFocus(focus,'paper','paper:q1',[url]),choiceOptions:options}]}
const view=n.questionView(session,0);assert.equal(view.question.images[0].cropped,true);assert.equal(view.question.options[2].text,'weight')
session.questions[0].sourceRegions[0].region=[.1,.4,.9,.7];const second=n.questionView(session,0);assert.notEqual(second.question.images[0].clipStyle,view.question.images[0].clipStyle)
console.log('Question correspondence: cross-topic source union, exact source/page/region scope and labelled ABCD text passed.')
