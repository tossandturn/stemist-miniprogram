const {createSha256}=require('./sha256')
const PROTOCOL='stem-coach-image-upload-v1',ROOT='/api/ai/coach/uploads',TTL=900000,MAX_BYTES=4*1024*1024,MAX_RECORDS=4
const ID=/^cu-[A-Za-z0-9_-]{16,80}$/,HASH=/^[a-f0-9]{64}$/,MIMES=new Set(['image/jpeg','image/png','image/webp'])
const fail=(message,code='coach_upload_pending',statusCode=0)=>Object.assign(new Error(message),{code,statusCode})
const transient=e=>['network_timeout','network_error'].includes(e?.code)||e?.statusCode>=500||e?.statusCode===408
const missing=e=>e?.statusCode===404||e?.statusCode===410
const pending=()=>fail('图片上传暂时中断，已传部分已保留，请重试继续。')
const context=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
const byteCount=(length,padding=0)=>Math.max(0,Math.floor(length*3/4)-padding)
function parseImage(value){
 const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value||''))
 if(!m||m[2].length%4)throw fail('图片格式无效，请重新选择图片。','coach_upload_invalid',400)
 const padding=(m[2].match(/=+$/)||[''])[0].length,bytes=byteCount(m[2].length,padding)
 if(bytes<=0||bytes>MAX_BYTES)throw fail('图片超过上传上限，请裁剪后重试。','coach_upload_too_large',413)
 return{mimeType:m[1],base64:m[2],base64Length:m[2].length,bytes,padding}
}
async function imageHash(text,check){
 const hash=createSha256(),chunk=new Uint8Array(16384)
 for(let at=0;at<text.length;at+=chunk.length){check();const n=Math.min(chunk.length,text.length-at);for(let i=0;i<n;i++)chunk[i]=text.charCodeAt(at+i);hash.update(chunk.subarray(0,n));if(at&&at%262144===0)await new Promise(r=>setTimeout(r,0))}
 return hash.digest()
}
async function prepareCoachImagePayload(payload,{request,onStage=()=>{},onTask=()=>{},isCancelled=()=>false,current=()=>{},now=Date.now,retryDelayMs=250}={}){
 const values=Array.isArray(payload.imageDataUrls)?[...new Set(payload.imageDataUrls.filter(Boolean))]:[]
 if(!values.length)return payload
 if(values.length>4)throw fail('一次最多上传四张图片。','coach_upload_too_many',400)
 const images=values.map(parseImage),totalBytes=images.reduce((n,x)=>n+x.bytes,0)
 // Small prepared photos need one existing job request, not several upload RTTs.
 // Bound the total (not each attachment) so large payloads still resume in chunks.
 if(totalBytes<=96*1024)return{...payload,imageDataUrls:values}
 const started=context(),key='stemistCoachUploads:'+encodeURIComponent(started.owner)+':'+started.epoch
 const check=()=>{const c=context();if(c.owner!==started.owner||c.epoch!==started.epoch)throw fail('账号已变化，请重新打开答疑。','account_changed',409);current();if(isCancelled())throw fail('已暂停上传，题目保留，可重试继续。','request_cancelled')}
 const call=async(path,data,method='GET')=>{check();const result=await request(path,data,{method,timeout:method==='POST'&&path.endsWith('/chunks')?15000:8000,isCancelled,onTask});check();return result}
 const pause=async()=>{if(retryDelayMs)await new Promise(r=>setTimeout(r,Math.max(0,Math.min(1000,retryDelayMs))));check()}
 const emit=value=>{check();try{onStage(value)}catch{}}
 let capability
 try{capability=await call(ROOT+'/capabilities')}catch(e){if(e?.statusCode===404)return payload;if(transient(e))throw pending();throw e}
 if(capability?.protocol!==PROTOCOL||capability.enabled!==true||capability.chunkMethod!=='POST'||capability.chunkPathSuffix!=='/chunks'||!Number.isInteger(capability.chunkChars)||capability.chunkChars<4||capability.chunkChars>65536||capability.chunkChars%4||!Number.isSafeInteger(capability.maxImageBytes)||capability.maxImageBytes<=0||capability.maxImageBytes>MAX_BYTES||!Number.isSafeInteger(capability.ttlMs)||capability.ttlMs<=0||capability.ttlMs>TTL)throw fail('图片上传服务状态异常，请稍后重试。','coach_upload_protocol',502)
 if(images.some(x=>x.bytes>capability.maxImageBytes))throw fail('图片超过上传上限，请裁剪后重试。','coach_upload_too_large',413)
 const initialTime=now();let finishedBytes=0,sessionBytes=0
 let records=wx.getStorageSync(key);records=(Array.isArray(records)?records:[]).filter(r=>ID.test(r?.id||'')&&HASH.test(r?.base64Sha256||'')&&MIMES.has(r?.mimeType)&&Number.isSafeInteger(r?.base64Length)&&r.base64Length>0&&r.base64Length<=Math.ceil(MAX_BYTES/3)*4&&r.base64Length%4===0&&Number.isFinite(r?.expiresAt)&&r.expiresAt>now()&&r.expiresAt<=now()+TTL+60000).slice(-MAX_RECORDS).map(r=>({id:r.id,mimeType:r.mimeType,base64Length:r.base64Length,base64Sha256:r.base64Sha256,expiresAt:r.expiresAt}))
 const save=()=>{check();try{wx.setStorageSync(key,records)}catch{throw fail('本机暂时无法保存上传进度，请释放小程序存储后重试。','coach_upload_storage')}}
 const ids=[]
 const progress=(bytes,extra={})=>{const elapsed=Math.max(0,now()-initialTime),speed=elapsed>0?sessionBytes*1000/elapsed:0,uploaded=Math.min(totalBytes,finishedBytes+bytes);emit({phase:'uploading',uploadedBytes:uploaded,totalBytes,speedBytesPerSecond:speed,etaSeconds:speed>0?Math.max(0,Math.ceil((totalBytes-uploaded)/speed)):null,...extra})}
 progress(0)
 const readState=async(id)=>{
  for(let attempt=0;attempt<3;attempt++){try{return await call(ROOT+'/'+id)}catch(e){if(!transient(e))throw e;if(attempt===2)throw pending();await pause()}}
 }
 for(const image of images){
  check();const digest=await imageHash(image.base64,check);let done=false
  for(let restart=0;restart<2&&!done;restart++){
   let record=records.find(r=>r.base64Sha256===digest&&r.mimeType===image.mimeType&&r.base64Length===image.base64Length),fresh=!record
   if(!record){
    while(records.length>=MAX_RECORDS){
     const old=records.find(r=>!ids.includes(r.id));if(!old)throw fail('本次图片数量超过上传上限。','coach_upload_too_many',400)
     try{await call(ROOT+'/'+old.id,undefined,'DELETE')}catch(e){check();if(!missing(e)){if(transient(e))throw pending();throw e}}
     records=records.filter(r=>r.id!==old.id);save()
    }
    record={id:'cu-'+now().toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2),mimeType:image.mimeType,base64Length:image.base64Length,base64Sha256:digest,expiresAt:now()+capability.ttlMs};records.push(record);save()
   }
   const validate=s=>{
    if(s?.protocol!==PROTOCOL||s.id!==record.id||!['uploading','ready'].includes(s.status)||s.mimeType!==image.mimeType||s.base64Length!==image.base64Length||s.base64Sha256!==digest||s.chunkChars!==capability.chunkChars||!Number.isSafeInteger(s.receivedChars)||s.receivedChars<0||s.receivedChars>image.base64Length||s.receivedChars%4||!Number.isFinite(s.expiresAt)||s.expiresAt<=now()||s.expiresAt>now()+TTL+60000||s.status==='ready'&&s.receivedChars!==image.base64Length)throw fail('图片上传进度异常，请稍后重试。','coach_upload_protocol',502)
    record.expiresAt=s.expiresAt;save();return s
   }
   try{
    let state
    if(!fresh)state=validate(await readState(record.id))
    else for(let attempt=0;attempt<3&&!state;attempt++){
     try{state=validate(await call(ROOT+'/'+record.id,{mimeType:image.mimeType,base64Length:image.base64Length,base64Sha256:digest},'PUT'))}
     catch(e){if(!transient(e))throw e;try{state=validate(await readState(record.id))}catch(readError){if(!missing(readError))throw readError;if(attempt===2)throw pending();await pause()}}
    }
    let previous=byteCount(state.receivedChars,state.receivedChars===image.base64Length?image.padding:0)
    progress(previous,{resuming:previous>0})
    const accept=s=>{state=validate(s);const bytes=byteCount(state.receivedChars,state.receivedChars===image.base64Length?image.padding:0);sessionBytes+=Math.max(0,bytes-previous);previous=bytes;progress(bytes)}
    while(state.receivedChars<image.base64Length){
     const offset=state.receivedChars,chunk=image.base64.slice(offset,offset+capability.chunkChars)
     let advanced=false
     for(let attempt=0;attempt<3&&!advanced;attempt++){
      try{accept(await call(ROOT+'/'+record.id+'/chunks',{offset,chunk},'POST'));if(state.receivedChars<offset+chunk.length)throw fail('图片片段尚未确认。','coach_upload_protocol',502);advanced=true}
      catch(e){if(!transient(e)&&e?.statusCode!==409)throw e;progress(previous,{retrying:true});await pause();accept(await readState(record.id));if(state.receivedChars<offset)throw fail('图片上传状态已变化，请重试。','coach_upload_protocol',502);if(state.receivedChars>offset)advanced=true;else if(attempt===2)throw pending()}
     }
    }
    if(state.status!=='ready')progress(previous,{verifying:true})
    for(let attempt=0;state.status!=='ready'&&attempt<3;attempt++){
     try{accept(await call(ROOT+'/'+record.id+'/complete',{},'POST'));if(state.status!=='ready')throw fail('图片校验尚未完成。','coach_upload_protocol',502)}
     catch(e){if(!transient(e))throw e;await pause();accept(await readState(record.id));if(attempt===2&&state.status!=='ready')throw pending()}
    }
    if(state.status!=='ready')throw pending()
    ids.push(record.id);finishedBytes+=image.bytes;done=true
   }catch(e){
    if(missing(e)&&restart===0){records=records.filter(r=>r.id!==record.id);save();progress(0,{restarting:true});continue}
    throw e
   }
  }
 }
 check();return{...payload,imageDataUrls:[],imageUploadIds:ids}
}
module.exports={prepareCoachImagePayload,parseImage,PROTOCOL}
