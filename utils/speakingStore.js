const clone=value=>JSON.parse(JSON.stringify(value))
const prefix=owner=>'stemistIeltsSpeaking:'+owner+':'
function sessionKey(owner,id){if(!id||String(id).length>200)throw Error('口语记录标识无效，原记录未修改。');return prefix(owner)+'session:'+encodeURIComponent(id)}
const versionDifference=(a,b)=>((Number(a?.revision)||0)-(Number(b?.revision)||0))||((Number(a?.updatedAt)||0)-(Number(b?.updatedAt)||0))
function archiveSession(owner,snapshot){
 const key=sessionKey(owner,snapshot.sessionId),previous=wx.getStorageSync(key)
 if(previous?.owner&&previous.owner!==owner)throw Error('记录所属账号不匹配。')
 if(previous&&previous.epoch===snapshot.epoch&&versionDifference(previous,snapshot)>0)throw Error('历史记录已有更新，未覆盖新记录。')
 const value=clone({...snapshot,owner})
 wx.setStorageSync(key,value)
 return value
}
function saveSession(scope,owner,snapshot,{replaceFrom}={}){
 if(!scope.startsWith(prefix(owner)))throw Error('口语记录所属账号不匹配。')
 const head=wx.getStorageSync(scope),expected=replaceFrom||snapshot
 if(head&&head.epoch===snapshot.epoch&&(head.sessionId!==expected.sessionId||(head.revision||0)!==(expected.revision||0)))throw Error('口语记录已在其他页面更新，未覆盖新记录。')
 if(head&&head.epoch===snapshot.epoch&&head.sessionId!==snapshot.sessionId){const archived=wx.getStorageSync(sessionKey(owner,head.sessionId));if(!archived||archived.owner!==owner||archived.epoch!==head.epoch||(archived.revision||0)!==(head.revision||0))throw Error('上一份记录尚未存档，未开始新练习。')}
 // The active record is one atomic write. Replacing its ID is allowed only
 // after the previous record has been archived; regular saves do not duplicate
 // or silently overwrite a newer session from another page.
 const value=clone({...snapshot,owner,revision:(snapshot.revision||0)+1})
 wx.setStorageSync(scope,value)
 return value
}
function readSession(owner,id,epoch){
 const saved=wx.getStorageSync(sessionKey(owner,id))
 let latest=saved&&saved.owner===owner&&saved.epoch===epoch&&saved.sessionId===id?saved:null
 // Older versions only kept one record per task. Read it in place without a
 // destructive migration or requiring the topic to still be in the catalog.
 const keys=wx.getStorageInfoSync?.().keys||[]
 for(const key of keys.filter(key=>key.startsWith(prefix(owner))&&!key.startsWith(prefix(owner)+'session:'))){const legacy=wx.getStorageSync(key);if(legacy?.sessionId===id&&legacy.epoch===epoch&&(!legacy.owner||legacy.owner===owner)&&(!latest||versionDifference(legacy,latest)>0))latest=legacy}
 return latest?clone({...latest,owner}):null
}
function sessionHistory(owner,epoch){
 const keys=wx.getStorageInfoSync?.().keys||[]
 const records=keys.filter(key=>key.startsWith(prefix(owner))).map(key=>wx.getStorageSync(key)).filter(s=>s&&s.sessionId&&(!s.owner||s.owner===owner)&&s.epoch===epoch&&s.turns?.length)
 const latest=new Map()
 for(const record of records){const previous=latest.get(record.sessionId);if(!previous||versionDifference(record,previous)>0)latest.set(record.sessionId,record)}
 return [...latest.values()].map(s=>({sessionId:s.sessionId,title:s.taskTitle||'Speaking',turnCount:s.turns.length,band:s.band??null,updatedAt:s.updatedAt||0})).sort((a,b)=>b.updatedAt-a.updatedAt)
}
module.exports={archiveSession,saveSession,readSession,sessionHistory}
