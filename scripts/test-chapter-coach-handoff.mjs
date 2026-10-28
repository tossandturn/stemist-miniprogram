import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const removed=[],copied=[],requests=[]
let failCopy=0
const runtime=miniRuntime({wx:{env:{USER_DATA_PATH:'/owned'},getFileSystemManager:()=>({mkdirSync(){},accessSync(){},copyFile(o){copied.push(o.destPath);if(failCopy&&copied.length===failCopy)o.fail();else o.success()},unlink(o){removed.push(o.filePath)}})},modules:{
 'utils/image':{compressImage:async p=>p,readAsJpegDataUrl:async p=>'data:image/jpeg;base64,'+p},
 'utils/coach':{runCoach:async r=>{requests.push(r);return {completed:true,mode:'ai',providerStatus:'connected',answer:'答案\n步骤\n错因'}}}
}})
runtime.storage.set('stemistUser',{id:'student'})
const photos=runtime.load('utils/nativeCoachPhoto'),who={owner:'student',epoch:0}
const entry={skill:'stem-photo',taskId:'chapter-review-1',focusedQuestion:{id:'q1',number:1},question:{id:'q1',number:1},view:'chapter-practice',initialMessage:'我的作答 A；请给正确答案、步骤和错因。'}
const key=runtime.load('utils/coachEntry').stageCoachEntry(entry)
assert.equal(runtime.load('utils/coachEntry').takeCoachEntry('another-entry'),null)
assert.equal(runtime.storage.get('stemistCoachEntry').key,key,'an unrelated route must not consume a newer handoff')
const paths=await photos.persistCoachPhotos(['/temp/q.jpg','/temp/answer.jpg'],who,{contextId:'stem-photo',feature:'answers',entryKey:key,autoSubmitNonce:'review-1'})
assert.equal(paths.length,2)
assert.equal(photos.readCoachPhoto(who,'stem-photo','unrelated'),'','a different entry must never see the prepared question')
assert.equal(photos.consumeCoachPhotoAutoSubmit(who,'stem-photo','answers','unrelated'),'')
const page=runtime.page('pages/coach/index');page.onLoad({source:'practice',feature:'answers',entry:key});page.onShow()
await settle();await settle()
assert.equal(requests.length,1)
assert.equal(requests[0].message,entry.initialMessage)
assert.equal(requests[0].feature,'answers')
assert.equal(requests[0].imageDataUrls.length,2)
assert.equal(requests[0].context.question.id,'q1')
page.onShow();await settle();assert.equal(requests.length,1,'returning must not auto-submit twice')
page.onUnload()
const previous=runtime.storage.get(photos.PHOTO_KEY)
failCopy=copied.length+2
await assert.rejects(photos.persistCoachPhotos(['/temp/a.jpg','/temp/b.jpg'],who,{contextId:'stem-photo'}),/保存/)
assert.equal(runtime.storage.get(photos.PHOTO_KEY),previous,'a failed second copy must preserve previous attachment')
assert.ok(removed.includes(copied.at(-2)))
photos.clearCoachPhoto(who)
assert.ok(paths.every(p=>removed.includes(p)),'clearing must remove both owned photos')
failCopy=0
const logoutPaths=await photos.persistCoachPhotos(['/temp/q.jpg','/temp/a.jpg'],who,{contextId:'stem-photo'})
runtime.load('utils/session').clearLocalSession()
assert.ok(logoutPaths.every(p=>removed.includes(p)),'logout must not leave the second private image behind')
runtime.storage.set('stemistUser',{id:'student'})
runtime.storage.set('stemistPrivacyEpoch',0)
const stale=await photos.persistCoachPhotos(['/temp/q.jpg','/temp/a.jpg'],who,{contextId:'stem-photo',entryKey:'expired',feature:'answers',autoSubmitNonce:'stale'})
const expired=runtime.page('pages/coach/index');expired.onLoad({source:'practice',feature:'answers',entry:'expired'});expired.onShow()
assert.match(expired.data.error,/过期/)
assert.ok(stale.every(p=>removed.includes(p)))
expired.onUnload()
console.log('Chapter Coach handoff: entry-bound two-photo storage, one-shot auto-send, failure rollback and logout cleanup passed.')
