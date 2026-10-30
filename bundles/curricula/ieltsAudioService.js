const {getJson}=require('../../utils/api')
const ORIGIN='https://stem.ieltsist.com',PREFIX='/api/stem/ielts-audio/files/',KEY='stemistListeningDownloadCatalog',TTL=7*86400000
function parseCatalogue(value){
 if(value?.schemaVersion!=='ielts-audio-downloads-v1'||!/^[a-f0-9]{24}$/.test(value.version||'')||!Array.isArray(value.items)||value.items.length>2000||value.quota?.limit!==2||value.quota?.shared!==true)throw Error('音频目录返回异常，请刷新重试。')
 const seen=new Set(),items=value.items.map(item=>{
  if(!/^audio-[a-f0-9]{32}$/.test(item.id)||seen.has(item.id)||!/^cam\d+-l-test\d+$/.test(item.taskId)||item.url!==PREFIX+item.id||!Number.isInteger(item.book)||item.book<4||item.book>99||!Number.isInteger(item.test)||item.test<1||item.test>10||!Number.isInteger(item.practiceTest)||item.practiceTest<1||item.practiceTest>10||!Number.isInteger(item.track)||!Number.isInteger(item.trackCount)||item.track<1||item.track>item.trackCount||item.trackCount>12||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<3||item.bytes>33554432||!/^Cambridge_IELTS_[A-Za-z0-9_-]+\.mp3$/.test(item.fileName)||item.fileName.length>160)throw Error('音频文件信息无效，请刷新重试。')
  seen.add(item.id);return{id:item.id,taskId:item.taskId,book:item.book,test:item.test,practiceTest:item.practiceTest,track:item.track,trackCount:item.trackCount,title:String(item.title||'听力音频').slice(0,200),fileName:item.fileName,sha256:item.sha256,bytes:item.bytes,url:ORIGIN+item.url}
 }).sort((a,b)=>b.book-a.book||a.test-b.test||a.track-b.track)
 return{version:value.version,items,books:[...new Set(items.map(i=>i.book))].sort((a,b)=>b-a),offline:false}
}
async function fetchCatalogue(){
 let response
 try{response=await getJson('/api/stem/ielts-audio',{stemAuth:false,timeout:15000})}
 catch(error){try{const cached=wx.getStorageSync(KEY);if(Number.isFinite(cached?.savedAt)&&Date.now()-cached.savedAt>=0&&Date.now()-cached.savedAt<TTL)return{...parseCatalogue(cached.payload),offline:true}}catch{}throw error}
 const parsed=parseCatalogue(response)
 try{wx.setStorageSync(KEY,{savedAt:Date.now(),payload:{schemaVersion:'ielts-audio-downloads-v1',version:parsed.version,items:parsed.items.map(i=>({...i,url:PREFIX+i.id})),quota:{limit:2,shared:true}}})}catch{}
 return parsed
}
module.exports={fetchCatalogue,parseCatalogue}
