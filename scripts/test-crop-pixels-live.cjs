// Native canvas export on a synthetic four-colour image. No camera, provider,
// album input or student draft write. A real tap exercises the crop action.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {createRequire}=require('node:module')
const {createCanvas,loadImage}=createRequire('D:/CodexWork/stem-whole-paper-candidate/package.json')('@napi-rs/canvas')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const output=process.argv[process.argv.indexOf('--output')+1]
if(!output)throw Error('Use --output <QA directory>')
async function main(){
 assert.equal((await call('automation_runtime_info',{action:'currentPage'})).currentPage?.path,'pages/index/index')
 const source=createCanvas(128,128),brush=source.getContext('2d')
 for(const [color,x,y] of [['#ff0000',0,0],['#00ff00',64,0],['#0000ff',0,64],['#ffff00',64,64]]){brush.fillStyle=color;brush.fillRect(x,y,64,64)}
 const encoded=source.toBuffer('image/png').toString('base64')
 const src=await evaluate('function(){if(getApp().__cropPixelQA)throw Error("Crop QA active");const src=wx.env.USER_DATA_PATH+"/qa-colour-crop-"+Date.now()+".png";wx.getFileSystemManager().writeFileSync(src,'+JSON.stringify(encoded)+',"base64");getApp().__cropPixelQA={src};return src}')
 try{
  await call('automation_navigate',{action:'navigateTo',url:'/pages/crop/crop?src='+encodeURIComponent(src)})
  await evaluate(function(){const p=getCurrentPages().slice(-1)[0];p.finish=function(file){getApp().__cropPixelQA.output=file;this.setData({busy:false})};return true})
  await call('automation_element_action',{action:'tap',selector:'.primary','wait-for-selector':'.crop-box'})
  const image=await until(function(){const p=getCurrentPages().slice(-1)[0],q=getApp().__cropPixelQA;return q.output?{base64:wx.getFileSystemManager().readFileSync(q.output,'base64')}:p.data.error?{error:p.data.error}:null},'native crop pixels',15000)
  assert.equal(image.error,undefined)
  const bytes=Buffer.from(image.base64,'base64'),decoded=await loadImage(bytes),canvas=createCanvas(decoded.width,decoded.height),context=canvas.getContext('2d')
  context.drawImage(decoded,0,0);const pixels=context.getImageData(0,0,decoded.width,decoded.height).data
  const colours=new Set();let opaque=0
  for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>240){opaque++;colours.add([pixels[i]>>5,pixels[i+1]>>5,pixels[i+2]>>5].join(','))}}
  assert.ok(opaque>pixels.length/8,'crop cannot be transparent/blank')
  assert.ok(colours.size>=4,'crop cannot collapse to a solid colour')
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'native-crop.png'),bytes,{flag:'wx'})
  console.log(JSON.stringify({status:'PASS',nativeCanvas:true,source:'synthetic four-colour PNG',width:decoded.width,height:decoded.height,colours:colours.size,opaquePixels:opaque,cameraUsed:false,studentDataChanged:false}))
 }finally{
  await call('automation_navigate',{action:'navigateBack'})
  await evaluate(function(){const q=getApp().__cropPixelQA;if(q)for(const file of [q.src,q.output].filter(Boolean))try{wx.getFileSystemManager().unlinkSync(file)}catch{};delete getApp().__cropPixelQA;return true})
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
