const {createAdvisorConversation}=require('./advisorConversation')

const client=createAdvisorConversation({
 root:'/api/ai/ielts-teacher/conversations',
 streamPath:'/api/ai/ielts-teacher/stream',
 persona:'ielts-teacher',
 errorPrefix:'ielts_teacher_',
 copy:{
  invalidConversation:'雅思辅导对话标识无效，请重新进入雅思老师。',
  accountChanged:'账号状态已变化，请重新进入雅思老师。',
 },
})

module.exports={
 cleanIeltsTeacherMessage:client.cleanMessage,
 newClientTurnId:client.newClientTurnId,
 resumeIeltsTeacher:client.resume,
 fetchIeltsTeacherMessages:client.fetchMessages,
 deleteIeltsTeacher:client.deleteConversation,
 sendIeltsTeacher:client.send,
}
