import assert from 'node:assert/strict'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
function harness({auth=async()=>{},sync=false,legacyUpload=false}={}){
 const timers=new Map();let id=0,request,aborts=0,clears=0,dispatches=0
 const r=miniRuntime({
  globals:{setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)},
  modules:{'utils/nativeSession':{refreshNativeSession:auth,captureNativeCookie(){}},'utils/session':{clearLocalSession(){clears++}},'utils/ieltsLearning':{requestIeltsLearning:async()=>({mode:'ai',providerStatus:'connected',answer:'IELTS unchanged'})}},
  wx:{
   request(o){
    if(legacyUpload&&o.url.endsWith('/uploads/capabilities')){o.success({statusCode:404,data:{code:'not_found'}});return{abort(){}}}
    dispatches++;request=o
    if(sync)o.success({statusCode:202,data:{id:o.url.split('/').pop(),status:'succeeded',result:{answer:'x=4'}}})
    return {abort(){aborts++;o.fail({errMsg:'abort'})}}
   }
  }
 })
 const api=r.load('utils/api')
 return{api,timers,get request(){return request},get aborts(){return aborts},get clears(){return clears},get dispatches(){return dispatches}}
}
const h=harness(),pending=h.api.askCoach({message:'synthetic question'}).then(value=>({value}),error=>({error}))
await settle()
assert.equal(h.dispatches,1)
assert.equal(h.timers.size,1,'an independent STEM deadline must exist even if SDK callbacks never fire')
const timer=[...h.timers.values()][0];assert.equal(timer.ms,120000)
assert.equal(h.request.timeout,30000,'upload is bounded separately from provider execution and recovery')
timer.fn();const failed=await pending
assert.equal(failed.error.code,'coach_job_pending');assert.match(failed.error.message,/原答疑/);assert.equal(h.aborts,1)
h.request.success({statusCode:401,data:{}});assert.equal(h.clears,0,'late auth callback after timeout cannot clear the session')
assert.equal(h.timers.size,0)
const login=deferred(),a=harness({auth:()=>login.promise}),authWait=a.api.askCoach({message:'synthetic'}).catch(e=>e)
assert.equal(a.timers.size,1,'deadline includes auth renewal')
;[...a.timers.values()][0].fn();assert.equal((await authWait).code,'coach_job_pending')
login.resolve();await settle();assert.equal(a.dispatches,0,'expired request must never start later after login')
const good=harness({sync:true});assert.equal((await good.api.askCoach({message:'synthetic'})).answer,'x=4');assert.equal(good.timers.size,0);assert.equal(good.aborts,0)
// Keep the old-server deadline contract explicit; new upload pause/deadline cases have their own suite.
const image=harness({legacyUpload:true}),imageWait=image.api.askCoach({message:'synthetic',imageDataUrls:['data:image/png;base64,fixture']}).catch(e=>e)
await settle();assert.equal([...image.timers.values()][0].ms,120000);image.request.success({statusCode:202,data:{id:image.request.url.split('/').pop(),status:'succeeded',result:{answer:'50m'}}});await imageWait;assert.equal(image.timers.size,0)
const ielts=harness();await ielts.api.askIeltsCoach({message:'fixture'});assert.equal(ielts.timers.size,0,'IELTS request behavior stays unchanged')
console.log('STEM Coach request deadline: missing callbacks, abort, late callback, auth wait and IELTS isolation PASS')
