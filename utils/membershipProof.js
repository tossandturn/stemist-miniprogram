const {requestJson}=require('./api')
const {refreshNativeSession}=require('./nativeSession')
const {offerMembership}=require('./membershipAccess')

const PROTOCOL='stemist-membership-v1',MAX_PROOF_MS=30000
const ACCESS_PLAN_IDS=new Set(['all-access-month','day','week','month','year'])
const proofs=new WeakMap()
const fail=(message,code,statusCode)=>Object.assign(Error(message),{code,statusCode})
const scopeOf=(wxApi=wx)=>{const user=wxApi.getStorageSync?.('stemistUser')||{};return{owner:String(user.id||user.username||'guest'),epoch:Number(wxApi.getStorageSync?.('stemistPrivacyEpoch'))||0,hasToken:Boolean(wxApi.getStorageSync?.('stemistSessionToken'))}}
const sameScope=(wxApi,expected)=>{const value=scopeOf(wxApi);return value.owner===expected.owner&&value.epoch===expected.epoch}
const canonicalUser=value=>{const id=String(value||'');return/^ielts:\d+$/.test(id)?id:/^\d+$/.test(id)?'ielts:'+id:''}
const authorityError=(code='membership_authority_invalid')=>fail('会员状态暂未确认，请稍后重试。',code,503)

function enforcement(value){
 if(!value||typeof value.enabled!=='boolean'||value.appliesToExistingUsers!==true)throw authorityError()
 return value.enabled
}
function assertProtocol(value){if(value?.protocol!==PROTOCOL)throw authorityError('membership_authority_mismatch');return value}
function normalizeVersion(value){
 if(typeof value==='number'){if(Number.isSafeInteger(value)&&value>=0)return value;throw authorityError()}
 if(typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value))return value
 throw authorityError()
}
function clearMembershipProof(wxApi=wx){proofs.delete(wxApi)}

async function ensureMembershipAccess({wxApi=wx,now=Date.now,request=requestJson,force=false}={}){
 const started=scopeOf(wxApi),time=Number(now())
 if(!Number.isFinite(time))throw authorityError()
 if(started.owner!=='guest'&&started.hasToken&&!force){const cached=proofs.get(wxApi);if(cached&&cached.owner===started.owner&&cached.epoch===started.epoch&&cached.validUntil>time)return cached}
 if(started.owner==='guest'||!started.hasToken){
  const catalog=assertProtocol(await request('/api/membership/catalog',undefined,{method:'GET',timeout:10000,stemAuth:false}))
  if(!sameScope(wxApi,started))throw fail('账号已变化，请重新打开内容。','account_changed',409)
  if(enforcement(catalog.enforcement)===false)return Object.freeze({protocol:PROTOCOL,owner:started.owner,epoch:started.epoch,enforcementEnabled:false,active:false,planId:'',expiresAt:null,version:null,validUntil:time})
  throw fail('请先登录后使用会员内容。','auth_required',401)
 }
 const value=assertProtocol(await request('/api/membership/status',undefined,{method:'GET',timeout:10000}))
 if(!sameScope(wxApi,started))throw fail('账号已变化，请重新打开内容。','account_changed',409)
 if(canonicalUser(value.userId)!==started.owner)throw authorityError('membership_authority_mismatch')
 const enabled=enforcement(value.enforcement)
 if(!enabled)return Object.freeze({protocol:PROTOCOL,owner:started.owner,epoch:started.epoch,enforcementEnabled:false,active:false,planId:'',expiresAt:null,version:value.entitlement?.version??null,validUntil:time})
 const entitlement=value.entitlement,expires=Date.parse(entitlement?.expiresAt)
 if(!entitlement||entitlement.active!==true||!ACCESS_PLAN_IDS.has(entitlement.planId)||!Number.isFinite(expires)||expires<=time){
  clearMembershipProof(wxApi);try{offerMembership()}catch{}
  throw fail('此功能需要开通全功能会员后继续。','membership_required',403)
 }
 const version=normalizeVersion(entitlement.version)
 const proof=Object.freeze({protocol:PROTOCOL,owner:started.owner,epoch:started.epoch,enforcementEnabled:true,active:true,planId:entitlement.planId,expiresAt:new Date(expires).toISOString(),version,validUntil:Math.min(expires,time+MAX_PROOF_MS)})
 proofs.set(wxApi,proof);return proof
}

async function authorizationForMembership({wxApi=wx,proof,expected=scopeOf(wxApi),refresh=refreshNativeSession}={}){
 if(!proof||proof.owner!==expected.owner||proof.epoch!==expected.epoch||!sameScope(wxApi,expected))throw fail('账号已变化，请重新打开内容。','account_changed',409)
 if(proof.enforcementEnabled&&proof.active!==true)throw fail('此功能需要开通全功能会员后继续。','membership_required',403)
 const currentToken=String(wxApi.getStorageSync?.('stemistSessionToken')||'')
 if(!proof.enforcementEnabled&&!currentToken)return''
 if(expected.owner==='guest'){
  if(proof.enforcementEnabled)throw fail('请先登录后使用会员内容。','auth_required',401)
  return''
 }
 await refresh()
 if(!sameScope(wxApi,expected))throw fail('账号已变化，请重新打开内容。','account_changed',409)
 const token=String(wxApi.getStorageSync?.('stemistSessionToken')||'')
 if(!token)throw fail('登录已过期，请重新登录。','auth_required',401)
 return'Bearer '+token
}

module.exports={PROTOCOL,MAX_PROOF_MS,scopeOf,sameScope,ensureMembershipAccess,authorizationForMembership,clearMembershipProof}
