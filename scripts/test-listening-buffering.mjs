import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const downloads=[],players=[],removed=[]
const task={id:'cam15-l-test1',title:'Listening',module:'listening',minutes:40,questions:[{id:'q1',number:1,text:'Question',page:1,options:[]}],images:[],questionImages:[],passageImages:[],audioUrls:['https://ieltsist.com/cambridge15/audio/a.mp3','https://ieltsist.com/cambridge15/audio/b.mp3'],audioSections:[],sections:[]}
const r=miniRuntime({modules:{'utils/ieltsContent':{getIeltsTask:async()=>task}},wx:{
 getFileSystemManager:()=>({accessSync(){},statSync(){return {size:4096}},unlink:({filePath})=>removed.push(filePath)}),
 downloadFile(options){const item={options,aborts:0,onProgressUpdate(fn){this.progress=fn},abort(){this.aborts++;options.fail()}};downloads.push(item);return item},
 createInnerAudioContext(){const events={};const p={events,currentTime:0,duration:120,plays:0,startTime:0,src:'',destroy(){this.destroyed=true},stop(){},pause(){events.pause?.()},play(){this.plays++;events.play?.()},seek(t){this.currentTime=t},onPlay:f=>events.play=f,onPause:f=>events.pause=f,onEnded:f=>events.ended=f,onTimeUpdate:f=>events.time=f,onError:f=>events.error=f,onWaiting:f=>events.waiting=f,onCanplay:f=>events.canplay=f};players.push(p);return p}
}})
const p=r.page('pages/ielts/listening');p.onLoad({taskId:task.id});await settle()
assert.equal(downloads.length,1,'only selected audio is prefetched while reading the question')
assert.equal(players.length,0,'prefetch must not autoplay')
p.toggleAudio();p.toggleAudio();downloads[0].progress({totalBytesWritten:2048,totalBytesExpectedToWrite:4096})
assert.equal(p.data.audioDownloadPercent,50)
downloads[0].options.success({statusCode:200,tempFilePath:'/temp/audio-a.mp3'});await settle()
assert.equal(players.length,0,'cancel waiting prevents autoplay after completion')
p.seekAudio({detail:{value:37}});p.toggleAudio()
assert.equal(players[0].src,'/temp/audio-a.mp3','play the complete local file, not the remote streaming URL')
assert.equal(players[0].startTime,37)
players[0].events.waiting();assert.equal(p.data.audioBuffering,true)
players[0].events.canplay();assert.equal(p.data.audioBuffering,false)
p.onHide();assert.equal(p.data.audioPlaying,false);players[0].events.play();assert.equal(p.data.audioPlaying,false,'a late play event cannot resume audio on a hidden page');p.onShow();p.toggleAudio();assert.equal(downloads.length,1,'resume reuses the download')
p.selectAudio({detail:{value:1}});assert.equal(downloads.length,2);p.toggleAudio();p.onHide()
assert.equal(downloads[1].aborts,1,'leaving cancels pending download and playback intent')
downloads[1].options.success({statusCode:200,tempFilePath:'/temp/late-b.mp3'});await settle()
assert.equal(players.length,1,'late completion never starts hidden playback')
assert.ok(removed.includes('/temp/late-b.mp3'))
p.onShow();assert.equal(downloads.length,3)
downloads[2].options.success({statusCode:206,tempFilePath:'/temp/partial-b.mp3'});await settle()
assert.equal(p.data.audioReady,false,'a partial response is not a complete playable cache')
assert.ok(p.data.audioError)
p.selectAudio({detail:{value:0}});await settle();p.toggleAudio()
assert.equal(downloads.length,3,'selecting cached audio does not download again')
assert.equal(players.at(-1).src,'/temp/audio-a.mp3')
p.onUnload();const oldState=JSON.stringify(p.data);players.at(-1).events.play();assert.equal(JSON.stringify(p.data),oldState,'disposed callbacks cannot mutate the old page')
const cache=r.load('utils/listeningAudioCache')
const base='https://ieltsist.com/generated/audio/'
const pinned=cache.acquireListeningAudio(base+'pinned.mp3')
const joined=cache.acquireListeningAudio(base+'pinned.mp3')
const shared=downloads.at(-1)
shared.options.success({statusCode:200,tempFilePath:'/temp/pinned.mp3'})
assert.equal(await pinned.promise,await joined.promise)
joined.release()
for(let i=0;i<6;i++){
 const lease=cache.acquireListeningAudio(base+'cache-'+i+'.mp3')
 downloads.at(-1).options.success({statusCode:200,tempFilePath:'/temp/cache-'+i+'.mp3'})
 await lease.promise;lease.release()
}
assert.ok(!removed.includes('/temp/pinned.mp3'),'eviction must not remove a playing file')
assert.ok(removed.includes('/temp/cache-0.mp3'),'unreferenced old downloads are evicted')
pinned.release()
assert.throws(()=>cache.acquireListeningAudio('https://evil.example/audio.mp3'))

function fakeClock(){let now=0,id=0;const jobs=new Map();return{setTimeout(fn,ms){const key=++id;jobs.set(key,{at:now+ms,fn});return key},clearTimeout(key){jobs.delete(key)},tick(ms){const end=now+ms;for(;;){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at).find(([,job])=>job.at<=end);if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn()}now=end}}}
function timedCache(){const clock=fakeClock(),downloads=[],removed=[];const runtime=miniRuntime({globals:{setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout},wx:{downloadFile(options){const task={options,aborts:0,onProgressUpdate(fn){this.progress=fn},abort(){this.aborts++}};downloads.push(task);return task},getFileSystemManager:()=>({accessSync(){},statSync(){return{size:4096}},unlink:({filePath})=>removed.push(filePath)})}});return{clock,downloads,removed,cache:runtime.load('utils/listeningAudioCache')}}

const stalled=timedCache(),stalledLease=stalled.cache.acquireListeningAudio(base+'stalled.mp3');let stalledError
stalledLease.promise.catch(error=>{stalledError=error});stalled.clock.tick(29_999);await settle();assert.equal(stalledError,undefined);stalled.clock.tick(1);await settle()
assert.match(stalledError?.message||'',/停滞|重试/);assert.equal(stalled.downloads[0].aborts,1,'stalled SDK work is actively aborted even if it never calls fail')
stalled.downloads[0].options.success({statusCode:200,tempFilePath:'/temp/stalled-late.mp3'});assert.ok(stalled.removed.includes('/temp/stalled-late.mp3'),'a late success after watchdog failure is deleted and cannot revive cache state')
const stalledRetry=stalled.cache.acquireListeningAudio(base+'stalled.mp3');let retryError;stalledRetry.promise.catch(error=>{retryError=error});assert.equal(stalled.downloads.length,2,'a stalled entry is removed so retry starts a fresh DownloadTask');stalledRetry.release();await settle();assert.ok(retryError)

const repeated=timedCache(),repeatedLease=repeated.cache.acquireListeningAudio(base+'repeated.mp3');let repeatedError
repeatedLease.promise.catch(error=>{repeatedError=error});repeated.clock.tick(10_000);repeated.downloads[0].progress({totalBytesWritten:100,totalBytesExpectedToWrite:4096});repeated.clock.tick(29_000);repeated.downloads[0].progress({totalBytesWritten:100,totalBytesExpectedToWrite:4096});repeated.clock.tick(1_000);await settle()
assert.ok(repeatedError,'repeating the same byte count must not feed the stall watchdog');assert.equal(repeated.downloads[0].aborts,1)

const moving=timedCache(),movingLease=moving.cache.acquireListeningAudio(base+'moving.mp3');assert.equal(moving.downloads[0].options.timeout,300_000)
for(let step=1;step<=5;step++){moving.clock.tick(25_000);moving.downloads[0].progress({totalBytesWritten:step*500,totalBytesExpectedToWrite:4096})}
assert.equal(moving.downloads[0].aborts,0,'forward progress may continue beyond the previous 60 second window')
moving.downloads[0].options.success({statusCode:200,tempFilePath:'/temp/moving.mp3'});assert.equal(await movingLease.promise,'/temp/moving.mp3');moving.clock.tick(400_000);assert.equal(moving.downloads[0].aborts,0,'success clears both watchdog timers')

const hard=timedCache(),hardLease=hard.cache.acquireListeningAudio(base+'hard.mp3');let hardError;hardLease.promise.catch(error=>{hardError=error})
for(let step=1;step<=11;step++){hard.clock.tick(25_000);hard.downloads[0].progress({totalBytesWritten:step,totalBytesExpectedToWrite:4096})}
hard.clock.tick(25_000);await settle();assert.ok(hardError,'hard wall clock ends a download even while bytes still advance');assert.equal(hard.downloads[0].aborts,1)

const cancelled=timedCache(),cancelledLease=cancelled.cache.acquireListeningAudio(base+'cancelled.mp3');let cancelledError;cancelledLease.promise.catch(error=>{cancelledError=error});cancelledLease.release();await settle();assert.ok(cancelledError);assert.equal(cancelled.downloads[0].aborts,1)
cancelled.downloads[0].options.success({statusCode:200,tempFilePath:'/temp/cancelled-late.mp3'});cancelled.clock.tick(400_000);assert.ok(cancelled.removed.includes('/temp/cancelled-late.mp3'));assert.equal(cancelled.downloads[0].aborts,1,'cancel and late callbacks clear timers without a second abort')
const fallbackDownloads=[],fallbackRuntime=miniRuntime({modules:{'utils/listeningAudioRangeCache':{acquireRangeAudio:()=>({promise:Promise.reject(Object.assign(Error('no validator'),{code:'audio_range_unsupported'})),release(){},invalidate(){}})}},wx:{downloadFile(options){const task={options,onProgressUpdate(){},abort(){}};fallbackDownloads.push(task);return task},getFileSystemManager:()=>({accessSync(){},statSync(){return{size:4096}},unlink(){}})}})
const fallbackCache=fallbackRuntime.load('utils/listeningAudioCache'),fallbackLease=fallbackCache.acquireListeningAudio(base+'fallback.mp3');await settle();assert.equal(fallbackDownloads.length,1,'missing Range validator safely falls back to the complete native download instead of treating HTTP 200 as a chunk');fallbackDownloads[0].options.success({statusCode:200,tempFilePath:'/temp/fallback.mp3'});assert.equal(await fallbackLease.promise,'/temp/fallback.mp3');fallbackLease.release();const fallbackB=fallbackCache.acquireListeningAudio(base+'fallback.mp3');assert.equal(await fallbackB.promise,'/temp/fallback.mp3');fallbackLease.invalidate();const fallbackC=fallbackCache.acquireListeningAudio(base+'fallback.mp3');assert.equal(await fallbackC.promise,'/temp/fallback.mp3');assert.equal(fallbackDownloads.length,1,'released wrapper lease cannot invalidate a newer active legacy fallback entry');fallbackB.release();fallbackC.release()
await import('./test-listening-audio-range-cache.mjs')
console.log('Listening buffering: selected-track prefetch, real progress, complete local playback, cached resume/seek, cancellation, late callbacks and partial-download rejection passed.')
