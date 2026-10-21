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
  const finish=info=>{if(done)return;done=true;clearTimeout(timer);const width=Number(info?.width)||0,height=Number(info?.height)||0,scale=2048/Math.max(width,height);resolve(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0&&scale<1?{compressedWidth:Math.max(1,Math.round(width*scale)),compressedHeight:Math.max(1,Math.round(height*scale))}:{})}
  const timer=setTimeout(()=>finish(),3000)
  try{wx.getImageInfo({src:filePath,success:finish,fail:()=>finish()})}catch{finish()}
 })
}

async function prepareImage(filePath,coach){
  const dimensions=coach?await coachDimensions(filePath):{}
  let lastData = ''
  for (const quality of COMPRESSION_QUALITIES) {
    const compressedPath = await compressImage(filePath, quality, dimensions)
    const data = await readBase64(compressedPath)
    if (!data) throw new Error('照片内容为空，请重新拍摄')
    lastData = data
    if (base64ByteLength(data) <= MAX_IMAGE_BYTES) return `data:${imageMime(data)};base64,${data}`
  }
  // Keep this error deterministic and actionable after the bounded quality
  // ladder; never send an oversized payload to the Coach endpoint.
  if (lastData) throw new Error('照片太大，请重新拍摄更清晰且更紧凑的单题照片')
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
