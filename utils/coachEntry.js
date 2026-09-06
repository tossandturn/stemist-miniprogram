const owner=()=>String(wx.getStorageSync('stemistUser')?.id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
function stageCoachEntry(context){
 if(!context||!['listening','reading','writing','stem-photo'].includes(context.skill))return ''
 const key=[context.skill,context.taskId||context.routeId||'',context.focusedQuestion?.id||''].join(':').slice(0,240)
 wx.setStorageSync('stemistCoachEntry',{owner:owner(),epoch:epoch(),at:Date.now(),key,context})
 return key
}
function takeCoachEntry(key){
 const entry=wx.getStorageSync('stemistCoachEntry');wx.removeStorageSync('stemistCoachEntry')
 return entry&&entry.key===key&&entry.owner===owner()&&entry.epoch===epoch()&&Date.now()-entry.at<120000?entry.context:null
}
function focusPassage(text,section){
 const input=String(text||''),matches=[...input.matchAll(/\bREADING\s+PASSAGE\s+([123])\b/gi)]
 const first=matches.find(m=>Number(m[1])===section)
 if(!first)return input.length<=18000?input:''
 const next=matches.find(m=>m.index>first.index&&Number(m[1])>section)
 return input.slice(first.index,next?.index||input.length).slice(0,18000)
}
module.exports={stageCoachEntry,takeCoachEntry,focusPassage}
