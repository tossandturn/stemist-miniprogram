const {planPanels}=require('./practiceReview')
const removeTemp=path=>{if(path)try{wx.getFileSystemManager().unlink({filePath:path,fail(){}})}catch{}}
function bounded(register,label,timeout=15000){
 return new Promise((resolve,reject)=>{
  let done=false,cancel
  const timer=setTimeout(()=>{if(!done){done=true;if(typeof cancel==='function')cancel();reject(Error(label+'超时，请重试。'))}},timeout)
  const finish=(error,value)=>{if(done)return false;done=true;clearTimeout(timer);error?reject(error):resolve(value);return true}
  try{cancel=register(value=>finish(null,value),error=>finish(error?.message?Error(error.message):Error(label+'失败，请重试。')))}catch(error){finish(error)}
 })
}
async function download(asset,{guard,onProgress,setAbort}){
 guard()
 return bounded((resolve,reject)=>{
  const task=wx.downloadFile({url:asset.url,timeout:20000,success:r=>{
   try{guard();if(r.statusCode!==200||!r.tempFilePath)throw Error('题图未能下载，请重试。');if(!resolve(r.tempFilePath))removeTemp(r.tempFilePath)}catch(e){removeTemp(r.tempFilePath);reject(e)}
  },fail:()=>reject(Error('题图下载中断，请检查网络后重试。'))})
  const abort=()=>task?.abort?.();setAbort(abort)
  task?.onProgressUpdate?.(p=>{try{guard();if(p.totalBytesWritten>6*1024*1024||p.totalBytesExpectedToWrite>6*1024*1024)throw Error('题图过大，请分问上传。');onProgress({label:'正在下载本题图片',loaded:p.totalBytesWritten,total:p.totalBytesExpectedToWrite})}catch(e){reject(e);abort()}})
  return abort
 },'题图下载',22000)
}
function loadImage(canvas,path){return bounded((resolve,reject)=>{const image=canvas.createImage();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('题图无法解码，请返回练习重新加载。'));image.src=path},'题图读取')}
function wrapText(ctx,text,width){
 const lines=[]
 for(const paragraph of String(text).split('\n')){
  let line=''
  for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=''}line+=char}
  lines.push(line)
 }
 if(lines.length>100)throw Error('本题文字过长，请在 AI Coach 中选择需要讲解的分问。')
 return lines
}
async function renderReview(review,canvas,{guard=()=>{},onProgress=()=>{},setAbort=()=>{}}={}){
 if(!canvas?.getContext||!canvas?.createImage)throw Error('图片处理暂不可用，请更新微信后重试。')
 const ctx=canvas.getContext('2d'),downloads=[],outputs=[],blocks=[]
 let totalBytes=0
 try{
  guard();ctx.font='26px sans-serif'
  if(review.prompt){const lines=wrapText(ctx,review.prompt,1128);blocks.push({id:'original',kind:'text',label:'原创基础练习 · 非官方真题',lines,width:1152,height:lines.length*40+12})}
  for(const [index,asset] of review.assets.entries()){
   const path=asset.path||await download(asset,{guard,onProgress:p=>onProgress({...p,label:`正在下载题图 ${index+1}/${review.assets.length}`}),setAbort})
   if(!asset.path)downloads.push(path)
   guard()
   const size=Number(wx.getFileSystemManager().statSync(path).size)
   totalBytes+=size
   if(!Number.isFinite(size)||size<=0||size>6*1024*1024||totalBytes>16*1024*1024)throw Error('本题图片过大，请在 AI Coach 中分次选择分问。')
   const image=await loadImage(canvas,path);guard()
   if(!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<=0||image.height<=0||image.width>10000||image.height>10000||image.width*image.height>24000000)throw Error('图片尺寸异常，请重新选择。')
   const expected=asset.cropped?asset.renderedImageSize:asset.imageSize
   if(expected&&(image.width!==expected[0]||image.height!==expected[1]))throw Error('题图版本已变化，请返回练习重新加载。')
   const r=asset.region&&!asset.cropped?asset.region:[0,0,1,1]
   const sx=Math.floor(r[0]*image.width),sy=Math.floor(r[1]*image.height),sw=Math.ceil(r[2]*image.width)-sx,sh=Math.ceil(r[3]*image.height)-sy
   blocks.push({id:'image-'+index,kind:asset.kind,image,sx,sy,width:sw,height:sh,label:asset.kind==='answer'?'我的作答 · 非标准答案':`第 ${review.number} 题${!asset.region?' · 原卷第 '+asset.page+' 页，请只看本题':''}`})
  }
  const panels=planPanels(blocks)
  for(const [index,panel] of panels.entries()){
   guard();onProgress({label:`正在保存题目与作答 ${index+1}/${panels.length}`})
   canvas.width=panel.width;canvas.height=panel.height
   ctx.clearRect(0,0,panel.width,panel.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,panel.width,panel.height)
   ctx.textBaseline='top';ctx.fillStyle='#151d37';ctx.font='bold 30px sans-serif';ctx.fillText(`章节错题 · 第 ${review.number} 题 · ${index+1}/${panels.length}`,24,20)
   ctx.font='22px sans-serif';ctx.fillText(String(review.source).slice(0,76),24,66)
   for(const b of panel.blocks){
    ctx.fillStyle='#151d37';ctx.font='bold 26px sans-serif';ctx.fillText(b.label+(b.continued?'（续）':''),24,b.y-40)
    if(b.kind==='text'){
     ctx.font='26px sans-serif'
     // Text blocks are bounded to a panel; do not split through glyphs.
     if(b.continued||b.sourceHeight<b.height)throw Error('本题文字过长，请在 AI Coach 中选择需要讲解的分问。')
     b.lines.forEach((line,i)=>ctx.fillText(line,b.x,b.y+i*40))
    }else ctx.drawImage(b.image,b.sx,b.sy+b.sourceY,b.width,b.sourceHeight,b.x,b.y,b.drawWidth,b.drawHeight)
   }
   await bounded(resolve=>{if(canvas.requestAnimationFrame)canvas.requestAnimationFrame(resolve);else setTimeout(resolve,16)},'图片绘制')
   guard()
   const output=await bounded((resolve,reject)=>wx.canvasToTempFilePath({canvas,x:0,y:0,width:panel.width,height:panel.height,destWidth:panel.width,destHeight:panel.height,fileType:'jpg',quality:.9,success:r=>{if(!resolve(r.tempFilePath))removeTemp(r.tempFilePath)},fail:()=>reject(Error('题图保存失败，请重试。'))}),'题图导出')
   outputs.push(output);guard()
   const size=Number(wx.getFileSystemManager().statSync(output).size)
   if(!Number.isFinite(size)||size<=0||size>=4*1024*1024)throw Error('保存的题图过大或为空，请重试。')
  }
  return outputs
 }catch(error){outputs.forEach(removeTemp);throw error}finally{setAbort(null);downloads.forEach(removeTemp)}
}
module.exports={renderReview,removeTemp}
