const {readAnnouncementSnapshot}=require('./announcements')
const active=new WeakSet()
const POLICY_ID='announcement-membership-policy-v1'

function showDownloadQuotaNotice({wxApi=wx,isCurrent=()=>true}={}){
 if(typeof wxApi.showModal!=='function'||active.has(wxApi)||!isCurrent())return false
 const notice=readAnnouncementSnapshot()?.items.find(item=>item.id===POLICY_ID)
 const paid=notice?.body.match(/(?:^|\n)二[、.．]\s*付费会员\s*\n([\s\S]*?)(?=\n三[、.．]|$)/)?.[1]?.trim()
 const terms=paid?`${notice.summary}\n\n${paid}`:'今日免费额度已用完：PDF 与听力音频合计每天 2 份。北京时间 00:00 重置，同日重试不重复扣次，已下载缓存仍可打开。会员权益与价格以会员中心为准。'
 active.add(wxApi)
 try{
  wxApi.showModal({title:'今日免费额度已用完',content:terms.slice(0,1000),confirmText:paid?'查看会员':'查看说明',cancelText:'继续浏览',success:choice=>{
   if(!choice.confirm||!isCurrent())return
   wxApi.navigateTo({url:paid?'/bundles/account/membership':'/bundles/announcements/index?noticeId='+POLICY_ID})
  },complete:()=>active.delete(wxApi)})
 }catch{active.delete(wxApi);return false}
 return true
}
module.exports={showDownloadQuotaNotice}
