// Layout-only native evidence. No network, provider calls, student data or auth.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const require=createRequire(import.meta.url),{call}=require('./helpers/wechat-cli.cjs')
const root=path.resolve(import.meta.dirname,'..'),date=execFileSync('powershell',['-NoProfile','-Command','Get-Date -Format yyyyMMdd'],{encoding:'utf8',windowsHide:true}).trim()
const qa=path.resolve(root,'..','stemist-download-progress-qa-'+date+'-'+process.pid),evidence=path.resolve(root,'..','stemist-release-coordination','download-progress-'+date)
assert(!fs.existsSync(qa),'Use a fresh isolated QA project; do not overwrite another run')
const {buildTransferProgress:build}=miniRuntime().load('utils/transferProgress')
const states=[
 {name:'unknown',state:build({phase:'downloading',downloadedBytes:81920},'批改报告',{canCancel:true})},
 {name:'known',state:build({phase:'downloading',downloadedBytes:335*1024,totalBytes:540*1024,speedLabel:'约 85 KB/s',remainingLabel:'预计剩余 3 秒'},'2026 数学 P1 · 参考答案',{canCancel:true})},
 {name:'paused',state:build({phase:'paused',downloadedBytes:335*1024,totalBytes:540*1024},'参考答案',{canRetry:true})},
 {name:'cached',state:build({phase:'cached',downloadedBytes:540*1024,totalBytes:540*1024},'参考答案')},
 {name:'error',state:build({phase:'error',downloadedBytes:335*1024,totalBytes:540*1024},'作答 PDF',{error:'下载中断，已保存进度；点击重试继续。',canRetry:true})},
]
const write=(relative,text)=>{const target=path.join(qa,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text,'utf8')}
const projectConfig=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
for(const extension of ['js','json','wxml','wxss'])write('components/pdf-download-progress/index.'+extension,fs.readFileSync(path.join(root,'components/pdf-download-progress/index.'+extension),'utf8'))
write('project.config.json',JSON.stringify({appid:projectConfig.appid,projectname:'download-progress-layout-only',compileType:'miniprogram',libVersion:projectConfig.libVersion,setting:{urlCheck:true,es6:true,minified:false}}))
write('app.js','App({})')
write('app.json',JSON.stringify({pages:['pages/check/index'],window:{navigationBarTitleText:'下载进度 · 界面验收',navigationBarBackgroundColor:'#111936',navigationBarTextStyle:'white'}}))
write('app.wxss','page{background:#f5f6fa;color:#18213d}.page{padding:16px}.caption{font-size:14px;color:#66708a;margin-bottom:16px}button{box-sizing:border-box;}')
write('pages/check/index.json',JSON.stringify({usingComponents:{'pdf-download-progress':'/components/pdf-download-progress/index'}}))
write('pages/check/index.wxss','')
write('pages/check/index.wxml','<view class="page"><view class="caption">仅布局测试 · 合成下载状态</view><pdf-download-progress id="compact" compact="{{true}}" state="{{state}}"/><pdf-download-progress id="expandable" state="{{state}}" bind:toggle="toggle"/></view>')
write('pages/check/index.js','Page({data:'+JSON.stringify({state:states[0].state})+',toggle(){this.setData({"state.collapsed":!this.data.state.collapsed})}})')
fs.mkdirSync(evidence,{recursive:true})
const request=(tool,params={})=>call(tool,{...params,project:qa})
const evaluate=async source=>(await request('automation_evaluate',{'fn-source':source})).result?.result
let opened=false
try{
 await request('open_project_window',{'window-mode':'liteMode'});opened=true
 await request('automation_navigate',{action:'reLaunch',url:'/pages/check/index'})
 await request('automation_page_action',{action:'querySelectorAll',selector:'.page','wait-for-selector':'.page'})
 const results=[]
 for(const fixture of states){
  const update=await evaluate('function(){const p=getCurrentPages().slice(-1)[0];p.setData('+JSON.stringify({state:fixture.state})+');return {route:p.route};}')
  assert.equal(update.route,'pages/check/index')
  await new Promise(resolve=>setTimeout(resolve,350))
  const layout=await evaluate('function(){const p=getCurrentPages().slice(-1)[0],c=p.selectComponent("#compact");return new Promise(resolve=>{const q=c.createSelectorQuery();q.select(".pdf-progress").boundingClientRect();q.select(".pdf-progress-track").boundingClientRect();q.select(".pdf-progress-fill").boundingClientRect();q.selectAll("button").boundingClientRect();q.exec(r=>resolve({rect:r[0],track:r[1],fill:r[2],buttons:r[3],window:wx.getWindowInfo()}));});}')
  assert(layout.rect&&layout.track&&layout.fill,'Every state renders a bar')
  assert(layout.rect.left>=0&&layout.rect.right<=layout.window.windowWidth+1,'Panel fits actual viewport')
  assert(layout.track.width>200&&layout.track.height>=5,'Visible progress track')
  for(const button of layout.buttons||[])assert(button.height>=44&&button.left>=layout.rect.left&&button.right<=layout.rect.right+1,'Touch buttons fit card')
  if(fixture.state.knownTotal)assert(Math.abs(layout.fill.width/layout.track.width*100-fixture.state.percent)<1,'Rendered width matches measured progress')
  else assert(layout.fill.width>0&&layout.fill.width<layout.track.width,'Unknown progress is visible but not a fake 100 percent bar')
  const screenshot=path.join(evidence,fixture.name+'.png')
  await request('simulator_screenshot',{path:screenshot,optimize:false})
  results.push({name:fixture.name,percent:fixture.state.percent,knownTotal:fixture.state.knownTotal,layout,screenshot})
 }
 fs.writeFileSync(path.join(evidence,'native-layout.json'),JSON.stringify({layoutOnly:true,requests:0,providerCalls:0,studentData:false,physicalDevice:false,qa,results},null,2)+'\n','utf8')
 console.log(JSON.stringify({status:'PASS',layoutOnly:true,states:results.length,evidence}))
}finally{if(opened)await request('close_project_window')}
