import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

const taskFor=module=>({
  id:`${module}-boundary-task`,
  title:`${module} private task`,
  module,
  minutes:40,
  questions:[{id:'q1',number:1,text:'Private question',page:1,options:[]}],
  images:[],questionImages:[],passageImages:[],audioUrls:[],audioSections:[],sections:[],
})

for(const module of ['listening','reading']){
  const task=taskFor(module)
  const runtime=miniRuntime({modules:{
    'utils/ieltsContent':{getIeltsTask:async()=>task},
    'utils/ieltsUnits':{sectionTask:value=>value},
  }})
  runtime.storage.set('stemistUser',{id:'student-a'})
  const page=runtime.page(`pages/ielts/${module}`)
  page.onLoad({taskId:task.id})
  await settle()
  page.inputAnswer({detail:{value:'private answer'}})
  page.flush()
  const oldDraftKey=page.__storageKey
  let oldDraft
  let destroyed=0,released=0
  page.__audio={pause(){},stop(){},destroy(){destroyed++}}
  page.__audioCacheLease={release(){released++}}
  page.__preparedAudio={index:0,path:'/private/audio.mp3'}
  page.__captionModel={segments:[{text:'private caption'}]}
  page.__images=[{url:'/private/source.png',page:1}]
  page.setData({
    result:{correct:1,total:1,band:9},
    review:[{id:'q1',answer:'private answer'}],
    passageText:'private passage',
    sourceImages:[{url:'/private/source.png',page:1}],
    captionsEnabled:true,
    captionBubbles:[{text:'private caption'}],
    audioPlaying:true,
  })

  page.onHide()
  oldDraft=structuredClone(runtime.storage.get(oldDraftKey))
  page.onShow()
  assert.equal(page.data.answer,'private answer',`${module} same-owner background resume keeps the draft`)

  runtime.storage.set('stemistUser',{id:'student-b'})
  page.onShow()
  assert.equal(page.data.answer,'',`${module} clears the previous account answer on return`)
  assert.equal(page.data.review.length,0,`${module} clears previous account review rows`)
  assert.equal(page.data.result,null,`${module} clears previous account score`)
  assert.equal(page.data.passageText,'',`${module} clears previous account passage text`)
  assert.equal(page.data.sourceImages.length,0,`${module} clears previous account source images`)
  assert.equal(page.data.captionBubbles.length,0,`${module} clears previous account captions`)
  assert.equal(page.data.audioPlaying,false,`${module} stops previous account audio`)
  assert.match(page.data.error,/账号已变化/)
  assert.equal(page.__task,null)
  assert.equal(page.__draft,null)
  assert.ok(destroyed>0&&released>0,`${module} releases old media resources`)
  assert.equal(JSON.stringify(runtime.storage.get(oldDraftKey)),JSON.stringify(oldDraft),`${module} does not delete or rewrite the old account draft`)

  const reopened=runtime.page(`pages/ielts/${module}`)
  reopened.onLoad({taskId:task.id})
  await settle()
  assert.equal(reopened.data.error,'',`${module} opens normally for the new account`)
  assert.equal(reopened.data.answer,'')
  assert.equal(reopened.__owner,'student-b')
  reopened.onUnload()
}

{
  const runtime=miniRuntime({modules:{'utils/nativeSpeaking':{NativeSpeaking:class{}}}})
  runtime.storage.set('stemistUser',{id:'student-a'})
  const key='stemistIeltsSpeaking:student-a:general'
  const saved={
    sessionId:'speech-private',epoch:0,taskId:'',taskTitle:'Private topic',
    turns:[{role:'user',text:'private transcript',at:1}],elapsed:12,
    note:'private note',feedback:'private feedback',band:8,warning:'private warning',revision:1,
  }
  runtime.storage.set(key,structuredClone(saved))
  const page=runtime.page('pages/ielts/speaking')
  page.onLoad()
  page.setData({showHistory:true,historyRows:[{id:'private-history'}]})
  page.__historyRows=[{id:'private-history'}]
  let closed=0
  page.__engine={close(){closed++}}

  page.onHide()
  page.onShow()
  assert.equal(page.data.feedback,'private feedback','same-owner speaking resume keeps feedback')

  runtime.storage.set('stemistPrivacyEpoch',1)
  page.onShow()
  assert.equal(page.data.turns.length,0,'speaking clears the previous privacy epoch transcript')
  assert.equal(page.data.turnCount,0)
  assert.equal(page.data.feedback,'')
  assert.equal(page.data.band,null)
  assert.equal(page.data.warning,'')
  assert.equal(page.data.historyRows.length,0)
  assert.equal(page.data.showHistory,false)
  assert.match(page.data.error,/账号已变化/)
  assert.equal(page.__valid,false)
  assert.equal(page.__turns.length,0)
  assert.equal(page.__task,null)
  assert.ok(closed>0,'speaking closes the old realtime session')
  assert.equal(JSON.stringify(runtime.storage.get(key)),JSON.stringify(saved),'speaking does not delete or rewrite the old account session')

  const reopened=runtime.page('pages/ielts/speaking')
  reopened.onLoad()
  assert.equal(reopened.data.error,'','speaking opens normally after the new privacy epoch is bound')
  assert.equal(reopened.__epoch,1)
  assert.equal(reopened.data.turns.length,0)
  reopened.onUnload()
}

console.log('IELTS account boundaries: same-owner resume, old-data clearing, media/session stop, cache preservation, and clean re-entry passed.')
