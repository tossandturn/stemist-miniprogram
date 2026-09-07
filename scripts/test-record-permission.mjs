import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
let authorizations=0
const denied=miniRuntime({wx:{getSetting:o=>o.success({authSetting:{'scope.record':false}}),authorize:()=>authorizations++}})
await assert.rejects(()=>denied.load('utils/recordPermission').ensureRecordPermission(),e=>e.action==='mini');assert.equal(authorizations,0)
const system=miniRuntime({wx:{getAppAuthorizeSetting:()=>({microphoneAuthorized:'denied'}),authorize:()=>authorizations++}})
await assert.rejects(()=>system.load('utils/recordPermission').ensureRecordPermission(),e=>e.action==='system');assert.equal(authorizations,0)
const privacy=miniRuntime({wx:{getPrivacySetting:o=>o.success({needAuthorization:true,privacyContractName:'Official privacy guide'}),authorize:()=>authorizations++}})
await assert.rejects(()=>privacy.load('utils/recordPermission').ensureRecordPermission(),e=>e.action==='privacy'&&e.contractName==='Official privacy guide');assert.equal(authorizations,0)
const first=miniRuntime({wx:{getPrivacySetting:o=>o.success({needAuthorization:false}),getSetting:o=>o.success({authSetting:{}}),authorize:o=>{authorizations++;assert.equal(o.scope,'scope.record');o.success()}}})
assert.equal(await first.load('utils/recordPermission').ensureRecordPermission(),true);assert.equal(authorizations,1)
const waiting=deferred();let cancelled=false
const late=miniRuntime({wx:{getSetting:o=>waiting.promise.then(o.success),authorize:()=>authorizations++}})
const pending=late.load('utils/recordPermission').ensureRecordPermission({cancelled:()=>cancelled});cancelled=true;waiting.resolve({authSetting:{}})
await assert.rejects(()=>pending,e=>e.code==='record_cancelled');assert.equal(authorizations,1)
const recorder=first.load('utils/recordPermission').recordingError({errMsg:'operateRecorder:fail format invalid'})
assert.equal(recorder.action,'retry','a format/device error is not mislabeled as a permission denial')
console.log('Microphone permission: privacy, system/mini denial, first grant, cancellation and error classification passed.')
let grant,audio=0,sockets=0
const cancelledEngine=miniRuntime({wx:{authorize:options=>{grant=options.success},getRecorderManager:()=>({}),createWebAudioContext:()=>{audio++;return{}},connectSocket:()=>{sockets++;return{}},setKeepScreenOn(){}}})
const Engine=cancelledEngine.load('utils/nativeSpeaking').NativeSpeaking,engine=new Engine(),starting=engine.start();await Promise.resolve();engine.close();grant()
await assert.rejects(()=>starting,e=>e.code==='record_cancelled');assert.equal(audio,0);assert.equal(sockets,0)
console.log('Late microphone approval after leaving starts no recorder, playback or connection.')
