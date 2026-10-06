const {deviceState,syncDevice}=require('../../utils/page')
const MODES=Object.freeze([
 {id:'steps',title:'步骤提示',detail:'只讲关键概念、思路和下一步，不揭晓最终答案。'},
 {id:'answers',title:'答案询问',detail:'拍一道题，直接获得整洁步骤、最终结果与检查。'},
 {id:'pdf',title:'PDF 阅卷',detail:'提交整卷 PDF 或多张图片，查看真实任务进度与报告。'},
 {id:'tavern',title:'AI 休闲酒馆',detail:'从六种休闲预设中选择，轻松聊天、冒险或推理。'},
])
const FORWARD=['source','routeId','stage','subjectCode','category','family','entry']
const query=value=>FORWARD.map(key=>[key,String(value?.[key]||'').slice(0,key==='entry'?240:120)]).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')
Page({
 onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
 data:deviceState({modes:MODES,category:'',family:'',routeId:'',stage:'',subjectCode:''}),
 onLoad(options){this.__academicQuery=query(options);this.setData({category:String(options?.category||''),family:String(options?.family||''),routeId:String(options?.routeId||''),stage:String(options?.stage||''),subjectCode:String(options?.subjectCode||'')})},
 onShow(){syncDevice(this)},onResize(){syncDevice(this)},
 openMode(event){const id=String(event.currentTarget?.dataset?.mode||'');if(!MODES.some(item=>item.id===id))return;let url=id==='pdf'?'/bundles/marking/index':id==='tavern'?'/bundles/coach/tavern'+(this.__academicQuery?'?'+this.__academicQuery:''):`/pages/coach/index?${[this.__academicQuery,`feature=${id}`].filter(Boolean).join('&')}`;wx.navigateTo({url})},
})
