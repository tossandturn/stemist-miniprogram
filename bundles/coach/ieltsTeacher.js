const {createAdvisorPage}=require('./advisorPage')
const conversation=require('./ieltsTeacherConversation')

const STARTERS=Object.freeze([
 {title:'备考计划',text:'请帮我制定 IELTS 备考计划。先问我的 Academic 或 General Training 类型、目标分、目前水平、考试日期和每周可用时间，每次最多问两个问题。'},
 {title:'写作辅导',text:'我想做 IELTS 写作辅导。我会提供完整题目和作文；请按四项标准指出最值得先改的地方，解释修改理由并给英文例子，不要改掉我的立场。'},
 {title:'听读解析',text:'我想分析一道 IELTS 听力或阅读题。我会提供原文或 transcript、题目、我的答案和可用答案；请根据证据解释正确答案和干扰项，不要编造原文。'},
 {title:'口语练习',text:'请和我做 IELTS Speaking 文字练习。一次只给一个 Part 1 问题、Part 2 题卡或 Part 3 问题，并根据我实际输入的答案继续；不要声称听到了发音、语速或停顿。'},
])

Page({
 ...createAdvisorPage({
  storagePrefix:'stemistIeltsTeacher',
  persona:'ielts-teacher',
  errorPrefix:'ielts_teacher_',
  starters:STARTERS,
  client:{
   cleanMessage:conversation.cleanIeltsTeacherMessage,
   newClientTurnId:conversation.newClientTurnId,
   resume:conversation.resumeIeltsTeacher,
   fetchMessages:conversation.fetchIeltsTeacherMessages,
   deleteConversation:conversation.deleteIeltsTeacher,
   send:conversation.sendIeltsTeacher,
  },
  copy:{
   shareTitle:'STEMist · 雅思老师',
   accountChanged:'账号状态已变化，请登录后重新打开雅思老师。',
   authRequired:'请先登录，再开始雅思辅导。',
   connecting:'正在连接雅思老师…',
   analysing:'正在分析你的问题…',
   composing:'正在整理讲解…',
   invalidConversation:'雅思辅导云端记录无效，请重新进入。',
   clearTitle:'清空雅思辅导？',
   clearContent:'将清除雅思老师的云端对话和本机草稿，不影响 IELTS 做题、实时口语或申请顾问记录。',
   clearStatus:'已清空雅思辅导',
  },
 }),
 openIeltsWorkspace(){wx.navigateTo({url:'/pages/ielts/home'})},
 openRealtimeSpeaking(){wx.navigateTo({url:'/pages/ielts/speaking'})},
})
