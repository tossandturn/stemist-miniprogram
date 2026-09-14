const {execFile}=require('node:child_process')
const {evaluate}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
if(!process.argv.includes('--run-production'))throw Error('Explicit --run-production required')
async function main(){
 try{
  await account.begin()
  const audio=await evaluate(function(){return new Promise(resolve=>{
   const context=wx.createWebAudioContext(),start=context.currentTime;let done=false
   const finish=()=>{if(done)return;done=true;resolve({state:context.state||'unknown',clockAdvanced:context.currentTime>start,resumeSupported:typeof context.resume==='function'});context.close?.()}
   try{const pending=context.resume?.();pending?.catch?.(()=>{})}catch{}
   setTimeout(finish,1000)
  })})
  console.log(JSON.stringify({audioProbe:audio,microphoneUsed:false}))
  await new Promise((resolve,reject)=>execFile(process.execPath,['scripts/test-speaking-live-audio.cjs','--run-production','--audio','D:/CodexWork/stemist-speaking-qa-20260911-0354',...(process.argv.includes('--room-noise')?['--room-noise']:[])],{cwd:process.cwd(),windowsHide:true,timeout:240000,maxBuffer:100000,encoding:'utf8'},(error,stdout,stderr)=>{process.stdout.write(stdout);if(error)reject(Error(stderr.trim()||'Live speech test failed'));else resolve()}))
 }finally{await account.end()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
