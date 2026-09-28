// Real native page/cache/playback; synthetic local identity, no submission.
const assert=require('node:assert/strict')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
async function main(){
 const page=(await call('automation_runtime_info',{action:'currentPage'})).currentPage?.path
 assert.equal(page,'pages/index/index','Do not interrupt student work')
 await evaluate(function(){
  const a=getApp();if(a.__audioPageQA)throw Error('Audio QA active')
  const keys=['stemistUser','stemistSessionToken','stemistPrivacyEpoch']
  a.__audioPageQA={before:keys.map(key=>({key,value:wx.getStorageSync(key),present:wx.getStorageInfoSync().keys.includes(key)})),keys:wx.getStorageInfoSync().keys}
  wx.setStorageSync('stemistPrivacyEpoch',(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)+1)
  wx.setStorageSync('stemistUser',{id:'qa_audio_page'});wx.removeStorageSync('stemistSessionToken');return true
 })
 try{
  await call('automation_navigate',{action:'navigateTo',url:'/pages/ielts/listening?taskId=cam14-l-test2'})
  console.log(JSON.stringify({phase:'page-navigation',...(await call('automation_runtime_info',{action:'currentPage'}))}))
  const ready=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.route==='pages/ielts/listening'&&!p.data.loading&&!p.data.audioPreparing?{questions:p.data.total,ready:p.data.audioReady,error:p.data.error,audioError:p.data.audioError,local:!!p.__preparedAudio&&!/^https?:/.test(p.__preparedAudio.path)}:null},'listening page audio cache',90000)
  assert.ok(ready.questions>0);assert.equal(ready.error,'');assert.equal(ready.audioError,'');assert.equal(ready.ready,true);assert.equal(ready.local,true)
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0];p.initAudio();p.__audio.volume=0;p.__qaWaits=0;p.__audio.onWaiting(()=>p.__qaWaits++);return true})
  await call('automation_element_action',{action:'tap',selector:'.player-toggle','wait-for-selector':'.player-toggle'})
  const playing=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.audioPosition>=6||p.data.audioError?{playing:p.data.audioPlaying,position:p.data.audioPosition,error:p.data.audioError,waits:p.__qaWaits}:null},'local audio advances',20000)
  assert.equal(playing.error,'');assert.equal(playing.playing,true);assert.ok(playing.position>=6)
  await call('automation_element_action',{action:'tap',selector:'.player-toggle'})
  const paused=await evaluate(function(){return !getCurrentPages().slice(-1)[0].data.audioPlaying})
  assert.equal(paused,true)
  await call('automation_page_action',{action:'callMethod',method:'seekAudio',args:[{detail:{value:25}}]})
  await call('automation_element_action',{action:'tap',selector:'.player-toggle'})
  const seek=await until(function(){const p=getCurrentPages().slice(-1)[0];return p.data.audioPosition>=28?{position:p.data.audioPosition,waits:p.__qaWaits}:null},'seek continues',15000)
  console.log(JSON.stringify({status:'PASS',surface:'native simulator',ready,playing,paused,seek,muted:true,realDevice:false,studentRecordsSubmitted:0}))
 }catch(error){
  console.log(JSON.stringify(await evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {phase:'listening-diagnostic',route:p.route,total:p.data.total,taskId:p.data.taskId,loading:p.data.loading,audioPreparing:p.data.audioPreparing,audioReady:p.data.audioReady,audioError:p.data.audioError,error:p.data.error,fixture:!!getApp().__audioPageQA}})))
  throw error
 }finally{
  await evaluate(function(){wx.reLaunch({url:'/pages/index/index'});return true})
  await until(function(){return getCurrentPages().slice(-1)[0]?.route==='pages/index/index'},'leave listening')
  await evaluate(function(){const q=getApp().__audioPageQA;if(!q)return false;for(const key of wx.getStorageInfoSync().keys)if(!q.keys.includes(key)&&key.includes('qa_audio_page'))wx.removeStorageSync(key);for(const row of q.before){if(row.present)wx.setStorageSync(row.key,row.value);else wx.removeStorageSync(row.key)}delete getApp().__audioPageQA;return true})
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
