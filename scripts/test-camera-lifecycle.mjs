import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const authorized={getSetting:o=>o.success({authSetting:{'scope.camera':true}})}
let created=0,captures=0
const r=miniRuntime({wx:{...authorized,createCameraContext:()=>{created++;return {takePhoto:o=>{captures++;o.success({tempImagePath:'/fixture/photo.jpg'})}}}}})
r.storage.set('stemistCameraReturn',{route:'native-practice',context:{routeId:'cie-9702-as-physics',questionId:'q1'}});r.storage.set('stemistDraft:writing',{text:'keep me'})
const p=r.page('pages/stem/camera');p.onLoad();await p.onReady()
assert.equal(p.data.ready,false,'page onReady is not camera readiness')
assert.equal(p.data.cameraMounted,true);assert.equal(created,0,'create camera context only after the component initialized')
p.takePhoto();assert.equal(captures,0,'black/uninitialized preview cannot take a photo')
p.onCameraInitialized({currentTarget:{dataset:{cameraGeneration:p.data.cameraGeneration}}});assert.equal(p.data.ready,true);assert.equal(created,1)
p.takePhoto();assert.equal(captures,1);assert.match(r.calls[0].url,/pages\/crop\/crop/);assert.equal(r.storage.get('stemistCropReturn').context.questionId,'q1')
const old=p.data.cameraGeneration;p.onHide();assert.equal(p.data.cameraMounted,false);await p.onShow();assert.equal(p.data.ready,false);p.onCameraInitialized({currentTarget:{dataset:{cameraGeneration:old}}});assert.equal(p.data.ready,false,'late initdone from the previous camera is ignored');p.onCameraInitialized({currentTarget:{dataset:{cameraGeneration:p.data.cameraGeneration}}});assert.equal(p.data.ready,true);p.onUnload();assert.deepEqual(r.storage.get('stemistDraft:writing'),{text:'keep me'})

let opened=0
const denied=miniRuntime({wx:{getSetting:o=>o.success({authSetting:{'scope.camera':false}}),openSetting:()=>opened++,createCameraContext:()=>{throw Error('denied camera mounted')}}})
const d=denied.page('pages/stem/camera');d.onLoad();await d.onReady();assert.equal(d.data.cameraMounted,false);assert.equal(d.data.permissionAction,'mini');assert.equal(opened,0,'settings require a visible user action');d.onUnload()
for(const [wxOverrides,action] of [[{...authorized,getAppAuthorizeSetting:()=>({cameraAuthorized:'denied'})},'system'],[{...authorized,getPrivacySetting:o=>o.success({needAuthorization:true,privacyContractName:'Fixture guide'})},'privacy']]){const x=miniRuntime({wx:wxOverrides}),c=x.page('pages/stem/camera');c.onLoad();await c.onReady();assert.equal(c.data.permissionAction,action);assert.equal(c.data.cameraMounted,false);c.onUnload()}

const timers=[]
const timed=miniRuntime({wx:authorized,globals:{setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearTimeout:()=>{}}})
const t=timed.page('pages/stem/camera');t.onLoad();await t.onReady();timers.find(t=>t.ms===8000).fn();assert.equal(t.data.ready,false);assert.equal(t.data.cameraMounted,false);assert.match(t.data.error,/启动/);assert.equal(t.data.canUseSystemCamera,true);t.onUnload()

let chosen
const fallback=miniRuntime({wx:{...authorized,chooseMedia:options=>{chosen=options}}})
fallback.storage.set('stemistCameraReturn',{route:'writing',context:{writingTaskId:'cam15-w-test1-task2'}})
const f=fallback.page('pages/stem/camera');f.onLoad();await f.onReady();await f.useSystemCamera();assert.deepEqual(Array.from(chosen.sourceType),['camera']);assert.equal(chosen.camera,'back');assert.equal(chosen.count,1)
f.onHide();chosen.success({tempFiles:[{tempFilePath:'/fixture/system-camera.jpg'}]});assert.match(fallback.calls[0].url,/system-camera/);assert.equal(fallback.storage.get('stemistCropReturn').context.writingTaskId,'cam15-w-test1-task2');f.onUnload()
const cancelled=miniRuntime({wx:{...authorized,chooseMedia:options=>{chosen=options}}}),c=cancelled.page('pages/stem/camera');c.onLoad();await c.onReady();await c.useSystemCamera();c.cancel();chosen.success({tempFiles:[{tempFilePath:'/fixture/late.jpg'}]});assert.equal(cancelled.storage.has('stemistCropReturn'),false,'cancelled capture cannot publish a late photograph')
let permissionResult
const switched=miniRuntime({wx:{getSetting:o=>{permissionResult=o.success}}}),s=switched.page('pages/stem/camera');s.onLoad();const waiting=s.onReady();switched.storage.set('stemistUser',{id:'a different account'});permissionResult({authSetting:{'scope.camera':true}});await waiting;assert.equal(s.data.identityChanged,true);assert.equal(s.data.initializing,false);assert.equal(s.data.cameraMounted,false);assert.equal(switched.storage.has('stemistCropReturn'),false);s.onUnload()
console.log('Camera lifecycle: permission gates, initdone-only readiness, stale mounts, background resume, startup timeout, camera-only fallback and retained context passed.')
