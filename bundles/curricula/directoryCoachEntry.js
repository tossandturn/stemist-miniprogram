const {safeHttpsUrl}=require('./universityService')
const DIRECTORY_ENTRY_KEY='stemistDirectoryCoachEntry:v1'
const value=(input,max=180)=>{
 if(typeof input!=='string'||!input.trim()||input.length>max||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(input))throw Error('咨询资料无效，请刷新目录。')
 return input.trim()
}
function directoryQuestion({kind,entity,ranking}){
 if(!entity||!['university','course'].includes(kind))throw Error('咨询类型无效。')
 const id=value(entity.id,100),title=value(kind==='university'?entity.nameZh:entity.label),officialUrl=safeHttpsUrl(kind==='university'?entity.website:entity.url)
 if(!officialUrl)throw Error('官网资料无效，请刷新目录。')
 let subtitle,prompt
 if(kind==='university'){
  const english=value(entity.nameEn),country=value(entity.country,100),rank=value(entity.rankLabel,12),label=value(ranking?.label,140),year=ranking?.editionYear,source=safeHttpsUrl(ranking?.sourceUrl)
  if(!Number.isInteger(year)||year<2000||year>2100||!source)throw Error('榜单资料无效，请刷新目录。')
  subtitle=`${country} · ${label} ${year} · ${rank}`
  prompt=`我想了解 ${title}（${english}）的国际本科申请。\n参考榜单：${label} ${year}，名次 ${rank}；${country}。\n学校官网：${officialUrl}\n榜单来源：${source}\n首轮请简短确认这所学校，只询问我的申请年份、课程体系和目标专业这三项，等我回复再展开。目标专业用于了解兴趣，不代表该校按专业招生。上面的网址不是已读取的网页正文；按学校、学院还是专业申请、本科与研究生申请机制、考试与语言政策都须有官方材料依据，未核实就标待核实，不要顺带断言。后续帮我梳理成绩、语言及活动/项目准备，区分官方要求、待核实信息和 AI 建议；不编造 A-Level、IB、AP 分数门槛、截止日期或录取概率，排名不是录取线。`
 }else{
  subtitle=value(entity.organization,120)
  prompt=`我想了解 ${title} 课程体系（${subtitle}）。\n课程官网：${officialUrl}\n首轮请简短确认课程，只询问我目前的年级、已学课程以及目标地区/专业这三项，等我回复再展开课程结构、选课衔接、考核方式和升学准备。上面的网址不是已读取的网页正文；把课程考试规则与大学录取要求分开，区分官方说明、待核实信息和 AI 建议，不编造具体分数线、科目要求或截止日期，没有实时核验官网时请明确说明。`
 }
 return{kind,id,title,subtitle,officialUrl,prompt}
}
function openDirectoryCoach(input,{onError=()=>{},onComplete=()=>{}}={}){
 const entry=directoryQuestion(input),nonce=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12),owner=String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
 const previous=wx.getStorageSync(DIRECTORY_ENTRY_KEY)
 const payload={schemaVersion:1,nonce,owner,epoch,at:Date.now(),entry}
 wx.setStorageSync(DIRECTORY_ENTRY_KEY,payload)
 const failed=()=>{try{if(wx.getStorageSync(DIRECTORY_ENTRY_KEY)?.nonce===nonce){if(previous)wx.setStorageSync(DIRECTORY_ENTRY_KEY,previous);else wx.removeStorageSync(DIRECTORY_ENTRY_KEY)}}catch{}onError('暂时无法打开 AI Coach，请重试。')}
 try{wx.navigateTo({url:'/bundles/coach/admissions?directoryEntry='+nonce,fail:failed,complete:onComplete})}catch{failed();onComplete()}
 return nonce
}
module.exports={DIRECTORY_ENTRY_KEY,directoryQuestion,openDirectoryCoach}
