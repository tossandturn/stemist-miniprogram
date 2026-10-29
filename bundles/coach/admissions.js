const {createAdvisorPage}=require('./advisorPage')
const conversation=require('./admissionsConversation')
const {withDirectoryCoachEntry}=require('./directoryCoachEntry')

const STARTERS=Object.freeze([
 {title:'申请规划',text:'请像申请老师一样帮我做国际本科申请规划。先了解我的课程体系、目标地区和专业，再给我准备顺序。'},
 {title:'背景分析',text:'我想分析目前的申请竞争力。请帮我梳理成绩、语言和课外经历的优势与缺口，不要编造录取概率。'},
 {title:'文书修改',text:'我想修改一段申请文书。请先问我申请用途、字数要求和真实经历，再帮我梳理结构、润色表达并说明修改理由。'},
 {title:'申请邮件',text:'请帮我拟一封发给大学招生办公室的英文邮件，并用中文解释。先确认收件对象、目的和需要表达的真实信息。'},
])

Page(withDirectoryCoachEntry(createAdvisorPage({
 storagePrefix:'stemistAdmissions',
 persona:'admissions-advisor',
 errorPrefix:'admissions_',
 starters:STARTERS,
 client:{
  cleanMessage:conversation.cleanAdmissionsMessage,
  newClientTurnId:conversation.newClientTurnId,
  resume:conversation.resumeAdmissions,
  fetchMessages:conversation.fetchAdmissionsMessages,
  deleteConversation:conversation.deleteAdmissions,
  send:conversation.sendAdmissions,
 },
 copy:{
  shareTitle:'STEMist · 留学申请顾问',
  accountChanged:'账号状态已变化，请登录后重新打开申请顾问。',
  authRequired:'请先登录，再开始申请咨询。',
  connecting:'正在连接申请顾问…',
  analysing:'正在分析申请…',
  composing:'正在整理建议…',
  invalidConversation:'云端对话记录无效，请重新进入。',
  clearTitle:'清空申请咨询？',
  clearContent:'将清除这位顾问的云端对话和本机草稿，不影响做题记录或休闲酒馆。',
  clearStatus:'已清空申请咨询',
 },
})))
