const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process')
const root='D:/微信web开发者工具',project=path.resolve(__dirname,'../..')
// Same documented launcher as wechatide.cmd, with argv passed directly so
// JavaScript/JSON is not interpreted by cmd.exe or PowerShell.
const excluded=new Set(['node.exe','node-18.exe','wxfilewatcher.exe','wxfilewatcher_x64.exe','notification_helper.exe','wechatdevtools.exe'])
const executables=fs.readdirSync(root).filter(name=>name.endsWith('.exe')&&!excluded.has(name.toLowerCase())&&fs.statSync(path.join(root,name)).size>50000000)
if(executables.length!==1)throw new Error('WeChat CLI launcher is ambiguous')
const exe=path.join(root,executables[0]),entry=path.join(root,'resources/app.asar.unpacked/js/common/cli/skill-index.js')
const bootstrap="const e=process.argv[1],a=process.argv.slice(2).filter(x=>x!=='--electron');process.argv=[process.execPath,e,'--electron'].concat(a);require(e)"
function call(tool,params={}){
 const args=['-e',bootstrap,entry,'-c','Codex',tool,'--project',project]
 for(const [key,value] of Object.entries(params))args.push('--'+key,typeof value==='string'?value:JSON.stringify(value))
 return new Promise((resolve,reject)=>execFile(exe,args,{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',cwd:project},windowsHide:true,timeout:25000,maxBuffer:2*1024*1024,encoding:'utf8'},(error,stdout)=>{
  if(error)return reject(new Error('WeChat '+tool+' failed: '+String(error.code||'unavailable')))
  try{const result=JSON.parse(stdout.slice(stdout.indexOf('{')));if(result.ok!==true||result.result?.success===false)throw new Error('WeChat '+tool+' rejected the action');resolve(result.result)}catch(e){reject(new Error('WeChat '+tool+' did not return a valid result'))}
 }))
}
async function evaluate(fn){const output=await call('automation_evaluate',{'fn-source':typeof fn==='string'?fn:fn.toString()});return output.result?.result}
async function until(fn,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const value=await evaluate(fn);if(value)return value;await new Promise(r=>setTimeout(r,250))}throw new Error('Timed out: '+label)}
module.exports={call,evaluate,until}
