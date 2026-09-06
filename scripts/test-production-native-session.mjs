// Opt-in integration test. Creates one isolated QA account through public
// registration. Credentials live only in this process and are never printed.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
if(!process.argv.includes('--run-production'))throw new Error('Explicit --run-production is required: this test creates a QA account.')
const stem='https://stem.ieltsist.com',ielts='https://ieltsist.com'
const username='nativeqa_'+Date.now().toString(36)+'_'+randomBytes(3).toString('hex')
const password=randomBytes(24).toString('base64url')
let stemToken='',ieltsToken='',stemCookie=''
async function json(origin,path,{method='GET',body,headers={}}={}){
 const response=await fetch(origin+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)})
 const value=await response.json();return{status:response.status,value,headers:response.headers}
}
try{
 const registration=await json(stem,'/api/auth/register',{method:'POST',body:{username,password}})
 assert.equal(registration.status,200,'production registration status')
 stemCookie=registration.headers.get('set-cookie')?.match(/stem_session=([a-zA-Z0-9_-]+)/)?.[1]||''
 stemToken=registration.value.accessToken;assert.ok(stemToken,'STEM identity issued')
 const exchanged=await json(ielts,'/api/auth/native-session',{method:'POST',headers:{'X-Stem-Identity':stemToken},body:{source:'native-production-QA'}})
 assert.equal(exchanged.status,200,'native session exchange status')
 assert.equal(exchanged.value.protocol,'ielts-native-session-v1')
 ieltsToken=exchanged.value.token;assert.ok(ieltsToken)
 assert.ok(Date.parse(exchanged.value.expiresAt)-Date.now()<=1800000)
 assert.equal(exchanged.headers.get('set-cookie'),null)
 const me=await json(ielts,'/api/me',{headers:{Authorization:'Bearer '+ieltsToken}})
 assert.equal(me.status,200)
 const context=await json(stem,'/api/stem/papers/cie-9702-9702_m25_qp_22/native-context?routeId=cie-9702-as-physics&stage=AS',{headers:{Authorization:'Bearer '+stemToken}})
 assert.equal(context.status,200,'authoritative full-paper source context')
 assert.equal(context.value.schemaVersion,'native-paper-context-v1')
 assert.ok(context.value.questions.length>0)
 assert.doesNotMatch(JSON.stringify(context.value),/"(?:answer|answerKey|exactAnswer|markPoints|markScheme)"\s*:/)
 const image=context.value.questions.flatMap(q=>q.images||[])[0]
 if(image){const response=await fetch(stem+image,{method:'HEAD',signal:AbortSignal.timeout(12000)});assert.equal(response.status,200,'real question image')}
 const config=await json(ielts,'/api/auth/native-config')
 console.log(JSON.stringify({status:'pass',qaAccountCreated:true,registration:200,nativeSession:200,account:200,paperContext:200,questions:context.value.questions.length,sourceImage:image?200:null,wechatConfigured:config.value.wechatConfigured,providerCalls:0,studentSubmissions:0}))
}finally{
 if(ieltsToken)await json(ielts,'/api/logout',{method:'POST',headers:{Authorization:'Bearer '+ieltsToken},body:{}}).catch(()=>{})
 if(stemToken)await json(stem,'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+stemToken,...(stemCookie?{Cookie:'stem_session='+stemCookie}:{})},body:{}}).catch(()=>{})
}
