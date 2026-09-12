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
console.log('Listening buffering: selected-track prefetch, real progress, complete local playback, cached resume/seek, cancellation, late callbacks and partial-download rejection passed.')
