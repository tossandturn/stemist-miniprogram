const assert=require('node:assert/strict')
const {evaluate,until}=require('./helpers/wechat-cli.cjs')
async function main(){
 await evaluate(function(){
  if(getApp().__listeningQA&&!getApp().__listeningQA.done)throw Error('Listening QA is already active')
  const q={done:false,phase:'loading-task',bytes:0,percent:null,waits:0,position:0};getApp().__listeningQA=q
  let lease,audio,timer
  const finish=phase=>{clearTimeout(timer);q.phase=phase;q.done=true;audio?.destroy();lease?.release()}
  ;(async()=>{
   try{
    const task=await require('utils/ieltsContent.js').getIeltsTask('listening','cam14-l-test2')
    q.phase='download';const began=Date.now()
    lease=require('utils/listeningAudioCache.js').acquireListeningAudio(task.audioUrls[0],{version:task.contentVersion,onProgress:p=>{q.bytes=p.bytes;q.percent=p.percent}})
    const file=await lease.promise;q.downloadMs=Date.now()-began;q.localFile=!/^https:/.test(file)
    const replayBegan=Date.now(),replay=require('utils/listeningAudioCache.js').acquireListeningAudio(task.audioUrls[0],{version:task.contentVersion})
    q.cacheReused=(await replay.promise)===file;q.cacheMs=Date.now()-replayBegan;replay.release()
    audio=wx.createInnerAudioContext();audio.volume=0
    audio.onError(()=>finish('audio-error'))
    audio.onWaiting(()=>q.waits++)
    audio.onTimeUpdate(()=>q.position=audio.currentTime)
    audio.onPlay(()=>{q.phase='playing';clearTimeout(timer);timer=setTimeout(()=>finish(q.position>=12?'complete':'clock-not-advancing'),18000)})
    audio.src=file;audio.play()
    timer=setTimeout(()=>finish('play-timeout'),25000)
   }catch{finish('download-failed')}
  })()
  return {started:true,muted:true,studentRecordsWritten:false}
 })
 const finalState=function(){const q=getApp().__listeningQA;return q?.done?q:null}
 let result
 try{result=await until(finalState,'real local listening playback',100000)}catch(error){result=await evaluate(finalState);if(!result)throw error}
 console.log(JSON.stringify(result));assert.equal(result.phase,'complete');assert.equal(result.localFile,true);assert.equal(result.cacheReused,true)
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
