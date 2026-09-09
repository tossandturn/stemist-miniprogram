import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'

function consent(wx={}){
 const runtime=miniRuntime({wx}),definition=runtime.load('components/privacy-consent/index'),events=[]
 const instance={...definition.methods,data:{...definition.data},properties:{contractName:'用户隐私保护指引'},setData(patch){Object.assign(this.data,patch)},triggerEvent(name,detail){events.push({name,detail})}}
 definition.lifetimes.attached.call(instance)
 return {instance,events,definition,runtime}
}
{
 let calls=0
 const {instance,events}=consent({getPrivacySetting:o=>{calls++;o.success({needAuthorization:false})}})
 assert.equal(instance.data.checked,false)
 instance.agree();assert.equal(calls,0)
 instance.changeChecked({detail:{value:['agree']}});assert.equal(events.length,0)
 instance.agree();assert.equal(events[0]?.name,'agreed');assert.equal(calls,1)
}
{
 const {instance,events}=consent({getPrivacySetting:o=>o.success({needAuthorization:true})})
 instance.changeChecked({detail:{value:['agree']}});instance.agree()
 assert.equal(events.some(e=>e.name==='agreed'),false);assert.ok(instance.data.error)
}
{
 let pending
 const {instance,events,definition}=consent({getPrivacySetting:o=>{pending=o}})
 instance.changeChecked({detail:{value:['agree']}});instance.agree();definition.lifetimes.detached.call(instance)
 pending.success({needAuthorization:false});assert.equal(events.length,0)
}
{
 const calls=[]
 const runtime=miniRuntime({wx:{getPrivacySetting:o=>o.success({needAuthorization:true,privacyContractName:'测试指引'}),getSetting:o=>o.success({authSetting:{}}),authorize:o=>{calls.push(o.scope);o.success({})}}})
 const page=runtime.page('pages/legal/privacy');page.onLoad();await settle()
 await page.enableCamera();await page.enableMicrophone();assert.equal(calls.length,0)
 runtime.wx.getPrivacySetting=o=>o.success({needAuthorization:false,privacyContractName:'测试指引'})
 await page.refreshPermissions();await page.enableCamera();assert.deepEqual(calls,['scope.camera'])
 await page.enableMicrophone();assert.deepEqual(calls,['scope.camera','scope.record'])
}
{
 const runtime=miniRuntime()
 assert.equal(runtime.load('utils/cameraPermission').cameraError({errMsg:'api scope is not declared in the privacy agreement'}).action,'configuration')
 assert.equal(runtime.load('utils/recordPermission').recordingError({errMsg:'api scope is not declared in the privacy agreement'}).action,'configuration')
}
const camera=fs.readFileSync(new URL('../pages/stem/camera.wxml',import.meta.url),'utf8')
assert.match(camera,/bindtap="openPermissions"/,'Camera must expose a visible permission-settings entry even after a configuration error')
assert.match(camera,/permissionAction === 'configuration'[\s\S]*bindtap="beginCamera"/,'A corrected platform declaration must be retryable without leaving the page')
const speaking=fs.readFileSync(new URL('../pages/ielts/speaking.wxml',import.meta.url),'utf8')
assert.match(speaking,/bindtap="openPermissions"/,'Speaking must expose a visible microphone permission entry')
{
 const runtime=miniRuntime()
 const page=runtime.page('pages/stem/camera');page.onLoad()
 page.openPermissions()
 assert.equal(runtime.calls.at(-1)?.url,'/pages/legal/privacy')
 assert.equal(page.data.cameraMounted,false)
 let starts=0;page.__pageReady=true;page.data.permissionAction='configuration';page.beginCamera=()=>{starts++}
 page.onShow();assert.equal(starts,1,'Returning from permission settings must recheck a former configuration error')
 page.onShow();assert.equal(starts,1,'The settings return marker is consumed only once')
}
{
 const runtime=miniRuntime(),page=runtime.page('pages/ielts/speaking')
 page.current=()=>true;page.openPermissions()
 assert.equal(runtime.calls.at(-1)?.url,'/pages/legal/privacy')
 const before=runtime.calls.length;page.data.active=true;page.openPermissions();assert.equal(runtime.calls.length,before)
}
assert.ok(camera.indexOf('<privacy-consent')<camera.indexOf('<camera '),'Consent must appear before the camera viewport')
assert.match(camera,/wx:if="\{\{!permissionAction\}\}"/)
const markup=fs.readFileSync(new URL('../components/privacy-consent/index.wxml',import.meta.url),'utf8')
assert.match(markup,/<checkbox/);assert.match(markup,/open-type="agreePrivacyAuthorization"/)
assert.match(markup,/disabled="\{\{!checked \|\| busy\}\}"/)
assert.doesNotMatch(fs.readFileSync(new URL('../components/privacy-consent/index.js',import.meta.url),'utf8'),/setStorageSync|event:\s*['"]agree['"]|authorize\(/)
const css=fs.readFileSync(new URL('../pages/legal/privacy.wxss',import.meta.url),'utf8')
assert.match(css,/\.permission-row\{display:block/,'Phone permission text must not be squeezed by full-width native buttons')
assert.match(css,/device-tablet\.landscape/,'Wide layout must not classify a landscape phone as a tablet')
console.log('Privacy consent: explicit check plus native consent, authoritative recheck, no late continuation, separate scopes, missing declarations and first-screen placement passed.')
