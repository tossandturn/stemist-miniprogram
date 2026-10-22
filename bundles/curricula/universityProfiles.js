const {getJson}=require('../../utils/api')
const {safeHttpsUrl}=require('./universityService')
const {DEFAULT_API_BASE,safeApiBase}=require('../../utils/apiOrigin')
const PREFIX='/data/university-profiles/v1/',INDEX_PATH=PREFIX+'index.json',INDEX_KEY='stemistUniversityProfilesIndex:v1',DETAIL_KEY='stemistUniversityProfileDetails:v1',DAY=86400000
const origin=()=>safeApiBase(getApp()?.globalData?.apiBaseUrl)||DEFAULT_API_BASE
const fail=()=>{throw Error('院校介绍暂未加载，请重试。')}
const text=(v,max)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f<>]/.test(v)
const id=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=110
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const kind=v=>['verified-overview','preparation-guide'].includes(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
const pending=new Map()
function normalizeProfileIndex(v){
 if(v?.schemaVersion!=='stemist-university-profile-index-v1'||!text(v.revision,80)||!text(v.updatedAt,40)||!Number.isFinite(Date.parse(v.updatedAt))||!Array.isArray(v.items)||v.items.length<1||v.items.length>250||JSON.stringify(v).length>192*1024)fail()
 const ids=new Set(),aliases=new Set(),items=v.items.map(x=>{
  if(!id(x?.id)||ids.has(x.id)||!digest(x.profileSha256)||!kind(x.kind)||!text(x.summary,160)||x.profilePath!==PREFIX+'profiles/'+x.id+'-'+x.profileSha256.slice(0,16)+'.json'||!Array.isArray(x.aliases)||x.aliases.length<1||x.aliases.length>6||!x.aliases.includes(x.id))fail();ids.add(x.id)
  for(const a of x.aliases){if(!id(a)||aliases.has(a))fail();aliases.add(a)}
  let logo=null;if(x.logo!==null){const l=x.logo;if(!l||!digest(l.sha256)||!Number.isInteger(l.bytes)||l.bytes<64||l.bytes>524288||l.tone&&!['light','dark'].includes(l.tone)||!['png','jpg','svg'].some(ext=>l.path===PREFIX+'logos/'+x.id+'-'+l.sha256.slice(0,16)+'.'+ext))fail();logo={path:l.path,sha256:l.sha256,bytes:l.bytes,tone:l.tone||'light'}}
  return{id:x.id,aliases:[...x.aliases],profilePath:x.profilePath,profileSha256:x.profileSha256,kind:x.kind,summary:x.summary,logo}
 });return{schemaVersion:v.schemaVersion,revision:v.revision,updatedAt:v.updatedAt,items}
}
function normalizeProfile(v,entry){
 if(v?.schemaVersion!=='stemist-university-profile-v1'||v.id!==entry.id||v.kind!==entry.kind||!kind(v.kind)||!date(v.updatedOn)||!text(v.scope,160)||!text(v.summary,160)||!text(v.notice,240)||!Array.isArray(v.sources)||v.sources.length<1||v.sources.length>10||!Array.isArray(v.sections)||v.sections.length<1||v.sections.length>6||JSON.stringify(v).length>16*1024)fail()
 const ids=new Set(),sources=v.sources.map(s=>{if(!id(s?.id)||ids.has(s.id)||!text(s.title,160)||!safeHttpsUrl(s.url))fail();ids.add(s.id);return{id:s.id,title:s.title,url:s.url}})
 const sections=v.sections.map(s=>{if(!text(s?.label,40)||!text(s.text,800)||!Array.isArray(s.sourceIds)||s.sourceIds.length>10||new Set(s.sourceIds).size!==s.sourceIds.length||!s.sourceIds.every(x=>ids.has(x))||v.kind==='verified-overview'&&!s.sourceIds.length)fail();return{label:s.label,text:s.text,sourceIds:[...s.sourceIds]}})
 return{schemaVersion:v.schemaVersion,id:v.id,kind:v.kind,updatedOn:v.updatedOn,scope:v.scope,summary:v.summary,notice:v.notice,sections,sources}
}
function read(key,now){try{const v=wx.getStorageSync(key),age=now-Number(v?.at);return v?.base===origin()&&Number.isFinite(age)&&age>=0&&age<=7*DAY?v:null}catch{return null}}
function save(key,value){try{wx.setStorageSync(key,value)}catch{}}
function request(path){const key=origin()+path;if(pending.has(key))return pending.get(key);let timer;const task=Promise.race([getJson(path,{timeout:10000,stemAuth:false}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000)})]).finally(()=>{clearTimeout(timer);pending.delete(key)});pending.set(key,task);return task}
async function fetchProfileIndex({force=false,now=Date.now()}={}){
 const cached=read(INDEX_KEY,now);if(!force&&cached&&now-cached.at<300000){try{return{index:normalizeProfileIndex(cached.payload),source:'cache'}}catch{}}
 try{const index=normalizeProfileIndex(await request(INDEX_PATH));save(INDEX_KEY,{base:origin(),at:now,payload:index});return{index,source:'network'}}catch{if(cached){try{return{index:normalizeProfileIndex(cached.payload),source:'cache'}}catch{}}fail()}
}
async function fetchProfile(entry,{force=false,now=Date.now()}={}){
 if(!entry||!id(entry.id)||!digest(entry.profileSha256)||entry.profilePath!==PREFIX+'profiles/'+entry.id+'-'+entry.profileSha256.slice(0,16)+'.json')fail()
 const cache=read(DETAIL_KEY,now),rows=Array.isArray(cache?.rows)?cache.rows.slice(-20).filter(x=>{const age=now-Number(x?.at);return Number.isFinite(age)&&age>=0&&age<=7*DAY}):[],cached=rows.find(x=>x.sha===entry.profileSha256)
 if(cached&&!force){try{return{profile:normalizeProfile(cached.payload,entry),source:'cache'}}catch{}}
 try{const profile=normalizeProfile(await request(entry.profilePath),entry);save(DETAIL_KEY,{base:origin(),at:now,rows:[...rows.filter(x=>x.sha!==entry.profileSha256),{sha:entry.profileSha256,at:now,payload:profile}].slice(-20)});return{profile,source:'network'}}catch{if(cached){try{return{profile:normalizeProfile(cached.payload,entry),source:'cache'}}catch{}}fail()}
}
module.exports={INDEX_PATH,normalizeProfileIndex,normalizeProfile,fetchProfileIndex,fetchProfile,profileAssetUrl:path=>origin()+path}
