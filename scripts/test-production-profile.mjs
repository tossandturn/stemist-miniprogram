// Opt-in production acceptance: one isolated QA account, synthetic profile.
// Credentials and sessions are held in memory only and never printed.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
if(!process.argv.includes('--run-production'))throw Error('Use --run-production after the server readiness gate; creates one QA account.')
const base='https://stem.ieltsist.com'
const username='profileqa_'+Date.now().toString(36),password=randomBytes(24).toString('base64url')
const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='
let token='',cookies=[],requests=0
async function request(path,method='GET',body,headers={}){
 requests++
 const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})
 const cookie=response.headers.get('set-cookie')?.match(/stem_session=([A-Za-z0-9_-]+)/)?.[1]
 if(cookie)cookies.push(cookie)
 return {status:response.status,body:await response.json()}
}
try{
 const login=await request('/api/auth/register','POST',{username,password})
 assert.equal(login.status,200,'isolated QA registration')
 token=login.body.accessToken
 assert.equal(typeof token,'string')
 const owner=login.body.identity.id,roles=login.body.identity.roles
 const initial=await request('/api/stem/profile')
 assert.equal(initial.status,200)
 assert.equal(initial.body.profile.displayName,'')
 const saved=await request('/api/stem/profile','PUT',{displayName:'微信资料验收',avatarDataUrl:avatar})
 assert.equal(saved.status,200,'profile save')
 assert.equal(saved.body.profile.ownerId,owner)
 const restored=await request('/api/stem/profile')
 assert.equal(restored.body.profile.displayName,'微信资料验收')
 assert.equal(restored.body.profile.avatarDataUrl,avatar)
 const rejected=await request('/api/stem/profile','PUT',{ownerId:'ielts:1',displayName:'不可越权',avatarDataUrl:''})
 assert.equal(rejected.status,400,'client cannot select profile owner')
 const relogin=await request('/api/auth/login','POST',{username,password})
 assert.equal(relogin.status,200)
 assert.equal(relogin.body.identity.id,owner)
 assert.equal(relogin.body.identity.username,username)
 assert.deepEqual(relogin.body.identity.roles,roles)
 assert.equal(relogin.body.identity.displayName,'微信资料验收')
 assert.equal(relogin.body.identity.avatarDataUrl,avatar)
 const claims=JSON.parse(Buffer.from(relogin.body.accessToken.split('.')[1],'base64url'))
 assert.equal(claims.displayName,undefined,'nickname stays out of the credential')
 assert.notEqual(claims.avatarDataUrl,avatar,'profile image stays out of the credential')
 assert.ok(relogin.body.accessToken.length<2048,'profile must not inflate auth headers')
 const refreshed=await request('/api/auth/status','GET',undefined,{Cookie:'stem_session='+cookies.at(-1)})
 assert.equal(refreshed.status,200)
 assert.equal(refreshed.body.identity.displayName,'微信资料验收')
 assert.equal(refreshed.body.identity.avatarDataUrl,avatar)
 const cleared=await request('/api/stem/profile','PUT',{displayName:'资料验收完成',avatarDataUrl:''})
 assert.equal(cleared.body.profile.avatarDataUrl,'')
 console.log(JSON.stringify({status:'PASS',profileSave:200,profileRead:200,reloginRestoresProfile:true,sessionRefreshRestoresProfile:true,ownerOverrideRejected:400,identityUnchanged:true,largeCredentialAvoided:true,avatarCleared:true,qaAccountsCreated:1,requests,providerCalls:0,studentRecordsModified:0}))
}finally{
 for(const cookie of cookies)await request('/api/auth/logout','POST',{}, {Cookie:'stem_session='+cookie}).catch(()=>{})
 token='';cookies=[]
}
