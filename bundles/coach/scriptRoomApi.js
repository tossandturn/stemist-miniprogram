const {requestJson,requestBinary}=require('../../utils/api')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')
const PREFIX='/api/ai/script-rooms'
const requestId=()=>`script-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`
const identity=()=>`${wx.getStorageSync('stemistUser')?.id||'guest'}:${Number(wx.getStorageSync('stemistPrivacyEpoch'))||0}`
function media(src){return /^\/api\/ai\/tavern\/media\/v1\/[a-z0-9-]+\.webp$/.test(src||'')?(safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE)+src:''}
async function call(path,data,method='POST'){
 const before=identity(),result=await requestJson(PREFIX+path+'?clientVersion=2',data,{method,timeout:20000})
 if(before!==identity())throw Object.assign(Error('账号已变化，请重新打开房间。'),{code:'account_changed',statusCode:401})
 return result
}
async function image(id,imageId){
 const before=identity(),result=await requestBinary(PREFIX+'/'+encodeURIComponent(id)+'/images/'+encodeURIComponent(imageId),null,{method:'GET',timeout:20000})
 if(before!==identity())throw Object.assign(Error('账号已变化，请重新打开房间。'),{statusCode:401})
 return result
}
module.exports={requestId,identity,media,image,catalog:()=>call('/catalog',null,'GET'),list:()=>call('',null,'GET'),get:id=>call('/'+encodeURIComponent(id),null,'GET'),create:p=>call('',{...p,scriptVersion:2}),join:p=>call('/join',p),act:(id,p)=>call('/'+encodeURIComponent(id)+'/actions',p)}
