import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const root=path.resolve(import.meta.dirname,'..')
const read=f=>fs.readFileSync(path.join(root,f),'utf8')
for(const [width,height,type,model,tablet] of [[375,812,'phone','iPhone',false],[844,390,'phone','iPhone',false],[768,1024,'tablet','iPad',true],[1194,834,'tablet','iPad',true]]) {
  const runtime=miniRuntime({wx:{getWindowInfo:()=>({windowWidth:width,windowHeight:height}),getDeviceInfo:()=>({deviceType:type,model})}})
  const profile=runtime.load('utils/device').readDeviceProfile()
  assert.equal(profile.isTablet,tablet)
  assert.equal(profile.windowWidth,width)
}
const css=read('app.wxss')
assert.match(css,/\.page\.device-tablet\.portrait \.workspace-grid\s*\{\s*display:\s*block/)
const home=read('pages/index/index.wxss')
assert.match(home,/\.home-page \.entry-grid \.entry-card\s*\{[^}]*min-width:\s*0/,'override the native 184px button width that caused overlap')
const fab=read('components/ai-fab/index.wxss')
assert.match(fab,/button\.ai-fab\.ai-fab-fixed/,'component buttons must override native minimum width')
const visibleCopy=(read('pages/index/index.wxml')+read('pages/practice/index.wxml')).replace(/<[^>]+>/g,'').replace(/\{\{[\s\S]*?\}\}/g,'')
assert.doesNotMatch(visibleCopy,/换票|数据链路|服务端|inventory|官方成绩|iPad 布局|手机布局/)
const copyRuntime=miniRuntime()
const catalog=copyRuntime.load('utils/ieltsCatalog')
for(const feature of catalog.IELTS_FEATURES) {
  assert.doesNotMatch(feature.title+' '+feature.detail,/Dashboard|examiner|证据链|桌面端全部控制|工作区/,'feature copy must describe a student action, not implementation details')
}
const idleCoach=copyRuntime.page('pages/coach/index.js')
assert.equal(idleCoach.data.coachStatus,'','an unused Coach must not show an unverified-result warning')
console.log('Phone/tablet classification, button-width regression and concise copy passed.')
