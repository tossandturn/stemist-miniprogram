function authGuard(){
 const owner=String(wx.getStorageSync('stemistUser')?.id||''),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0,token=wx.getStorageSync('stemistSessionToken')||''
 return p=>{
  if(owner!==String(wx.getStorageSync('stemistUser')?.id||'')||epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)||token!==(wx.getStorageSync('stemistSessionToken')||''))throw new Error('账号已变化，请重试登录。')
  if(p===undefined)return
  const id=p?.identity?.id,t=p?.accessToken
  if(!/^ielts:\d+$/.test(id)||typeof t!=='string'||!t.trim()||p.id&&p.id!==id||p.user?.id&&p.user.id!==id||p.token&&p.token!==t)throw new Error('登录响应无效。')
  return{owner:id,token:t.trim()}
 }
}
module.exports={authGuard}
