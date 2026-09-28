// Capture only in memory; never let a late login replace a newer account.
function authGuard(){
 const owner=String(wx.getStorageSync('stemistUser')?.id||''),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0,token=wx.getStorageSync('stemistSessionToken')||''
 return ()=>{
  if(owner!==String(wx.getStorageSync('stemistUser')?.id||'')||epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)||token!==(wx.getStorageSync('stemistSessionToken')||''))throw new Error('账号已变化，请重试登录。')
 }
}
module.exports={authGuard}
