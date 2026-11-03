import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const bytes=new Uint8Array([137,80,78,71,13,10,26,10]).buffer
let requestOptions=null,clearCalls=0,refresh=async()=>{}
const runtime=miniRuntime({globals:{getApp:()=>({globalData:{apiBaseUrl:'https://stem.test'}})},modules:{
 'utils/session':{clearLocalSession(){clearCalls++}},
 'utils/coachEffort':{coachEffortTimeout:()=>75_000},
 'utils/nativeSession':{captureNativeCookie(){},refreshNativeSession:()=>refresh()},
 'utils/ieltsLearning':{requestIeltsLearning(){}},
 'utils/apiOrigin':{DEFAULT_API_BASE:'https://stem.test',DEFAULT_IELTS_API_BASE:'https://ielts.test',safeApiBase:value=>value||'https://stem.test',safeIeltsApiBase:value=>value||'https://ielts.test'},
},wx:{request(options){requestOptions=options;options.success({statusCode:200,data:bytes,header:{'content-type':'image/png'}});return{abort(){}}}}})
runtime.storage.set('stemistUser',{id:'ielts:70'});runtime.storage.set('stemistSessionToken','binary-auth-token')
const api=runtime.load('utils/api'),result=await api.requestBinary('/api/ai/tavern/image',{persona:'horror-guide',prompt:'画一盏河灯'})
assert.equal(result.mimeType,'image/png');assert.deepEqual(Array.from(new Uint8Array(result.bytes)),Array.from(new Uint8Array(bytes)))
assert.equal(requestOptions.url,'https://stem.test/api/ai/tavern/image');assert.equal(requestOptions.responseType,'arraybuffer');assert.equal(requestOptions.header.Authorization,'Bearer binary-auth-token')
assert.equal(JSON.stringify(runtime.storage.get('stemistUser')).includes('base64'),false)

requestOptions=null
refresh=async()=>runtime.storage.set('stemistUser',{id:'ielts:71'})
await assert.rejects(()=>api.requestBinary('/api/ai/tavern/image',{persona:'horror-guide',prompt:'旧账号图片'}),error=>error.code==='account_changed')
assert.equal(requestOptions,null,'account switch blocks dispatch before the image request')
assert.equal(clearCalls,0)
console.log('Tavern image client transport: binary response, authenticated origin, no image Base64 in storage and account-switch fence PASS')
