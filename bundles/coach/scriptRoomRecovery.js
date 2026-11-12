const messages={
 script_room_limit:'你已有 3 间进行中的房间。请返回剧本列表继续旧房间，或明确结束、退出旧房间后再创建。',
 script_capacity:'当前房间较多，请稍后再创建；已有房间可以从剧本列表继续。',
 script_rate_limit:'操作暂时受限，请约 1 分钟后重试。房间与已提交进度保留。',
 script_ai_busy:'房内仍有 AI 回复处理中，请等当前回复完成再发送；可以继续查看线索。',
 script_ai_limit:'本局 AI 对话次数已用完，仍可搜证、完成任务和投票。',
 script_chat_limit:'本局聊天已达上限，仍可搜证、完成任务和投票。',
 script_image_limit:'本局即时配图次数已用完，预制场景图和文字玩法仍可使用。',
 script_image_busy:'本局已有配图在生成，可以先继续文字聊天。',
 script_puzzle_limit:'本幕尝试次数已达上限，请返回剧本列表查看或结束这局，再重新开始。',
}
function roomFailure(error,count=0){
 const status=Number(error?.statusCode)||0,code=String(error?.code||'')
 const uncertain=status===0||status===408||status>=500
 const blockedNetwork=['network_proxy_tunnel','network_domain_blocked','network_tls_error','request_cancelled'].includes(code)
 let message=Object.prototype.hasOwnProperty.call(messages,code)?messages[code]:''
 if(!message)message=status===429?'请求暂时受限，请稍后再试。房间与已提交进度保留。':status>=500?'房间服务暂时不可用，已显示的消息与输入保留。':status===0||status===408?'暂时未能同步房间，已显示的消息与输入保留。':/^script_/.test(code)?String(error.message||'操作未完成，请稍后重试。').slice(0,240):'操作未完成，请稍后重试。'
 if(blockedNetwork)message=code==='network_proxy_tunnel'?'当前网络代理连接失败，请检查代理或切换网络后点“重新同步”。':code==='network_domain_blocked'?'当前版本连接配置有误，请更新小程序后重试。':code==='request_cancelled'?'同步已取消，可稍后手动重新同步。':'安全连接未建立，可稍后手动重新同步。'
 return {message,uncertain,showRoomList:code==='script_room_limit'||code==='script_puzzle_limit',delay:status===429?60000:Math.min(3000*2**Math.max(0,count-1),30000),paused:blockedNetwork||count>=6||status>=400&&status<500&&![408,429].includes(status)}
}
module.exports={roomFailure}
