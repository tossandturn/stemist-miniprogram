const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const COMPRESSION_QUALITIES = [82, 65, 50, 35]

function compressImage(filePath, quality = COMPRESSION_QUALITIES[0], dimensions = {}) {
  if (typeof wx.compressImage !== 'function') return Promise.resolve(filePath)
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      ...dimensions,
      success: ({ tempFilePath }) => resolve(tempFilePath || filePath),
      fail: () => resolve(filePath),
    })
  })
}

function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: ({ data }) => {
        resolve(String(data || ''))
      },
      fail: () => reject(new Error('照片读取失败，请重新拍摄')),
    })
  })
}

function base64ByteLength(data) {
  const clean = String(data || '').replace(/\s+/g, '')
  if (!clean) return 0
  const padding = /==$/.test(clean) ? 2 : /=$/.test(clean) ? 1 : 0
  return Math.max(0, Math.floor(clean.length * 3 / 4) - padding)
}

function imageMime(data) {
  // Inspect only the signature, not a second full-size image buffer. Some
  // WeChat builds retain PNG/WebP bytes even after compressImage succeeds.
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes=[];let buffer=0,bits=0
  for (const character of String(data).slice(0,24)) {
    if(character==='=')break
    const value=alphabet.indexOf(character)
    if(value<0)throw new Error('照片格式无法识别，请重新拍摄')
    buffer=(buffer<<6)|value;bits+=6
    if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255);buffer&=(1<<bits)-1}
  }
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg'
  if([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return 'image/png'
  if([82,73,70,70].every((value,index)=>bytes[index]===value)&&[87,69,66,80].every((value,index)=>bytes[index+8]===value))return 'image/webp'
  throw new Error('照片格式无法识别，请重新拍摄')
}

async function coachDimensions(filePath){
 if(typeof wx.getImageInfo!=='function')return{}
 return new Promise(resolve=>{
  let done=false
  const finish=info=>{if(done)return;done=true;clearTimeout(timer);const width=Number(info?.width)||0,height=Number(info?.height)||0,valid=Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0,scale=2048/Math.max(width,height);resolve(valid&&scale<1?{compressedWidth:Math.max(1,Math.round(width*scale)),compressedHeight:Math.max(1,Math.round(height*scale))}:valid&&info?.orientation==='up'?{reuse:true}:{})}
  const timer=setTimeout(()=>finish(),3000)
  try{wx.getImageInfo({src:filePath,success:finish,fail:()=>finish()})}catch{finish()}
 })
}

async function prepareImage(filePath,coach){
  const {reuse,...dimensions}=coach?await coachDimensions(filePath):{}
  if(reuse){
    const file=await new Promise(resolve=>{const fs=wx.getFileSystemManager();if(!fs.getFileInfo)return resolve(null);let done=false;const finish=v=>{if(!done){done=true;clearTimeout(timer);resolve(v)}};const timer=setTimeout(()=>finish(null),250);try{fs.getFileInfo({filePath,success:finish,fail:()=>finish(null)})}catch{finish(null)}})
    if(file?.size>0&&file.size<=768*1024){
      const data=await readBase64(filePath)
      // Recheck bytes; file metadata is only a fast-path hint, not evidence.
      if(data&&base64ByteLength(data)<=768*1024)try{return `data:${imageMime(data)};base64,${data}`}catch{/* Unsupported source formats still use native conversion. */}
    }
  }
  let lastData = ''
  for (const quality of COMPRESSION_QUALITIES) {
    const compressedPath = await compressImage(filePath, quality, dimensions)
    const data = await readBase64(compressedPath)
    if (!data) throw new Error('照片内容为空，请重新拍摄')
    if(!lastData||base64ByteLength(data)<base64ByteLength(lastData))lastData=data
    if (base64ByteLength(data) <= (coach ? 768 * 1024 : MAX_IMAGE_BYTES)) return `data:${imageMime(data)};base64,${data}`
  }
  // The latency target is not the server's hard image limit. PNG quality
  // compression can be a no-op; keep supported evidence usable in that case.
  if(coach&&lastData&&base64ByteLength(lastData)<=MAX_IMAGE_BYTES)return `data:${imageMime(lastData)};base64,${lastData}`
  if (lastData) throw Object.assign(new Error(coach?'照片超过 4 MB，请点“裁剪图片”缩小范围后重试。':'照片太大，请重新拍摄更清晰且更紧凑的单题照片'),{code:coach?'coach_image_too_large':'image_too_large'})
  throw new Error('照片内容为空，请重新拍摄')
}

function readImageDataUrl(filePath,options){
 if(!options?.coach)return prepareImage(filePath,false)
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('图片准备超时，原图已保留，请重试。')),12000)
  prepareImage(filePath,true).then(resolve,reject).finally(()=>clearTimeout(timer))
 })
}

// Compatibility alias for existing photo consumers; it does not relabel bytes.
const readAsJpegDataUrl=readImageDataUrl
module.exports = { MAX_IMAGE_BYTES, COMPRESSION_QUALITIES, compressImage, readImageDataUrl, readAsJpegDataUrl, imageMime }
