const {createAdvisorConversation}=require('./advisorConversation')

const client=createAdvisorConversation({
 root:'/api/ai/admissions/conversations',
 streamPath:'/api/ai/admissions/stream',
 persona:'admissions-advisor',
 errorPrefix:'admissions_',
 copy:{
  invalidConversation:'对话标识无效，请重新进入申请顾问。',
  accountChanged:'账号状态已变化，请重新进入申请顾问。',
 },
})

module.exports={
 cleanAdmissionsMessage:client.cleanMessage,
 newClientTurnId:client.newClientTurnId,
 resumeAdmissions:client.resume,
 fetchAdmissionsMessages:client.fetchMessages,
 deleteAdmissions:client.deleteConversation,
 sendAdmissions:client.send,
}
