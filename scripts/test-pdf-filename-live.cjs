// Real wx.downloadFile/filesystem in an isolated temporary directory. No share is sent.
const assert=require('node:assert/strict')
const {evaluate,until}=require('./helpers/wechat-cli.cjs')
async function main(){
 try{
  await evaluate(function(){
   const app=getApp(),fs=wx.getFileSystemManager()
   if(app.__pdfNameQa)throw Error('PDF name QA already active')
   const dir=wx.env.USER_DATA_PATH+'/qa-pdf-name-'+Date.now(),q=app.__pdfNameQa={dir,done:false}
   fs.mkdirSync(dir)
   const api={env:{USER_DATA_PATH:dir},getStorageSync:()=>'',getFileSystemManager:()=>fs,downloadFile:o=>wx.downloadFile(o),openDocument:o=>{
    q.file=o.filePath
    const bytes=fs.readFileSync(o.filePath),prefix=String.fromCharCode(...new Uint8Array(bytes).slice(0,5))
    q.result={name:o.filePath.split('/').pop(),bytes:bytes.byteLength,pdf:prefix==='%PDF-',showMenu:o.showMenu};q.done=true;o.success({})
   }}
   q.controller=require('utils/pdfDownload.js').createPdfDownloadController({wxApi:api,onState:s=>{if(s.phase==='error'){q.error=s.error;q.done=true}}})
   q.controller.open({url:'https://stem.ieltsist.com/local-pdf/9709/9709_s25_ms_13.pdf',ownerKey:'naming-qa',label:'参考答案'})
   return {started:true}
  })
  const result=await until(function(){const q=getApp().__pdfNameQa;return q?.done?{error:q.error||'',...q.result}:null},'named PDF saved',40000)
  assert.equal(result.error,'');assert.equal(result.name,'9709_2025_夏季_P13_参考答案.pdf');assert.equal(result.pdf,true);assert.equal(result.showMenu,true);assert.ok(result.bytes>100)
  console.log(JSON.stringify({status:'pass',...result,documentViewer:'captured call only',shared:false}))
 }finally{
  await evaluate(function(){const q=getApp().__pdfNameQa;if(!q)return false;q.controller?.dispose();const fs=wx.getFileSystemManager();for(const name of fs.readdirSync(q.dir))fs.unlinkSync(q.dir+'/'+name);fs.rmdirSync(q.dir);delete getApp().__pdfNameQa;return true})
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
