// Authenticated binary results never become public URLs or storage-bearing query strings.
const KEY='stemistScriptImages'
function createRoomImageCache({load,current,changed}){
 const entries=new Map(),files=new Set();let disposed=false
 const valid=()=>!disposed&&current()
 function remove(filePath){try{wx.getFileSystemManager().unlink({filePath,fail(){}})}catch{};files.delete(filePath);const stored=wx.getStorageSync(KEY);wx.setStorageSync(KEY,(Array.isArray(stored)?stored:[]).filter(p=>p!==filePath))}
 async function request(roomId,id){
  if(!/^[a-f0-9-]{36}$/.test(id||'')||!valid()||entries.has(id))return
  entries.set(id,{busy:true,path:'',error:''})
  let filePath=''
  try{
   const result=await load(roomId,id)
   if(!valid())return
   const ext={ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[result.mimeType],root=wx.env?.USER_DATA_PATH
   if(!ext||!root||!result.bytes?.byteLength||result.bytes.byteLength>2*1024*1024)throw Error('image-invalid')
   filePath=root+'/script-image-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)+'.'+ext
   files.add(filePath);const stored=wx.getStorageSync(KEY);wx.setStorageSync(KEY,[...(Array.isArray(stored)?stored:[]),filePath].slice(-64))
   await new Promise((resolve,reject)=>wx.getFileSystemManager().writeFile({filePath,data:result.bytes,success:resolve,fail:reject}))
   if(!valid()){remove(filePath);return}
   entries.set(id,{busy:false,path:filePath,error:''})
  }catch{if(filePath)remove(filePath);if(valid())entries.set(id,{busy:false,path:'',error:'图片未能加载，点此重试'})}
  if(valid())changed()
 }
 return {get:id=>entries.get(id)||{busy:false,path:'',error:''},request,failed(id){const entry=entries.get(id);if(!entry)return;if(entry.path)remove(entry.path);entries.set(id,{busy:false,path:'',error:'图片未能显示，点此重试'});if(valid())changed()},retry(roomId,id){const entry=entries.get(id);if(entry?.busy)return;if(entry?.path)remove(entry.path);entries.delete(id);return request(roomId,id)},dispose(){disposed=true;for(const file of [...files])remove(file);entries.clear()}}
}
module.exports={createRoomImageCache}
