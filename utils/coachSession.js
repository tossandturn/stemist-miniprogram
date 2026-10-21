const {refreshNativeSession}=require('./nativeSession')
// Warm only an existing account. This never creates a new account or calls AI.
function warmCoachSession(){
 const owner=String(wx.getStorageSync('stemistUser')?.id||''),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
 let stopped=false,timer=null
 const current=()=>!stopped&&owner&&owner===String(wx.getStorageSync('stemistUser')?.id||'')&&epoch===(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)
 const tick=async()=>{
  const meta=wx.getStorageSync('stemistSessionMeta')
  if(!current()||!wx.getStorageSync('stemistSessionToken')||meta?.owner!==owner||!Number.isFinite(Date.parse(meta.expiresAt)))return
  try{await refreshNativeSession({aheadMs:90000})}catch{/* Foreground request owns recovery UI. */}
  if(!current())return
  const remaining=Date.parse(wx.getStorageSync('stemistSessionMeta')?.expiresAt)-Date.now()-90000
  timer=setTimeout(tick,Math.max(30000,Math.min(300000,remaining||30000)));timer?.unref?.()
 }
 tick()
 return()=>{stopped=true;clearTimeout(timer)}
}
module.exports={warmCoachSession}
