// Real public paper bytes/files; only the native document-viewer callback is mocked.
// The second pass rejects every PDF HTTP/download call to prove local reuse.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const outputIndex=process.argv.indexOf('--output'),output=path.resolve(process.argv[outputIndex+1]||'')
const root=path.resolve('D:/CodexWork'),relative=path.relative(root,output)
if(outputIndex<0||!relative||relative.startsWith('..')||path.isAbsolute(relative)||fs.existsSync(output))throw Error('Pass --output <new directory under D:\\CodexWork>')
const fixtures=[...['ap','ib'].flatMap(board=>['qp','ms'].map(kind=>({board,kind,url:'/bundles/curricula/index?board='+board,route:'bundles/curricula/index',selector:'.document-action'}))),...['qp','ms'].map(kind=>({board:'alevel',kind,url:'/pages/papers/index?category=alevel&subject=9709&stage=AS&routeId=cie-9709-as-p1-p2&year=2025',route:'pages/papers/index',selector:'.paper-pdf'}))]
async function main(){
 fs.mkdirSync(output);const results=[]
 try{
  await evaluate(function(){const app=getApp();if(app.__pdfCacheQa)throw Error('Another PDF cache QA is active');const q=app.__pdfCacheQa={request:wx.request,download:wx.downloadFile,viewer:wx.openDocument,block:false,pdfRequests:0,pdfDownloads:0,opened:null},isPdf=url=>/^https:\/\/stem\.ieltsist\.com\/(?:local-pdf\/|api\/stem\/curriculum-papers\/files\/)/.test(String(url||''));wx.request=function(o){if(isPdf(o.url)){q.pdfRequests++;if(q.block){setTimeout(()=>o.fail?.({errMsg:'request:fail QA offline PDF'}),0);return{abort(){}}}}return q.request.call(wx,o)};wx.downloadFile=function(o){if(isPdf(o.url)){q.pdfDownloads++;if(q.block){setTimeout(()=>o.fail?.({errMsg:'downloadFile:fail QA offline PDF'}),0);return{abort(){},onProgressUpdate(){}}}}return q.download.call(wx,o)};wx.openDocument=function(o){try{const manager=wx.getFileSystemManager(),size=manager.statSync(o.filePath).size;if(!size||!String(o.filePath).startsWith(wx.env.USER_DATA_PATH+'/pdf-cache/'))throw Error('Not a persisted public cache file');q.opened={path:o.filePath,bytes:size};o.success?.({errMsg:'openDocument:ok'})}catch{o.fail?.({errMsg:'openDocument:fail public file unreadable'})}};return true})
  for(const cacheOnly of [false,true]){
   await evaluate('function(){getApp().__pdfCacheQa.block='+cacheOnly+';return true}')
   for(const [index,item]of fixtures.entries()){
    await call('automation_navigate',{action:'reLaunch',url:item.url})
    await until('function(){const p=getCurrentPages().at(-1);return p?.route==='+JSON.stringify(item.route)+'&&!p.data.loading&&p.data.items?.length}',item.board+' public catalog',30000)
    await evaluate(function(){getApp().__pdfCacheQa.opened=null;getApp().__pdfCacheQa.scroll=null;return true})
    const selector=item.selector+'[data-kind="'+item.kind+'"]'+(cacheOnly?'[data-id="'+results[index].id+'"]':'')
    await evaluate('function(){const q=wx.createSelectorQuery();q.select('+JSON.stringify(selector)+').boundingClientRect();q.selectViewport().scrollOffset();q.exec(r=>{getApp().__pdfCacheQa.scroll=r[0]?{top:Math.max(0,r[0].top+(r[1]?.scrollTop||0)-140),id:r[0].dataset.id}:null});return true}')
    const target=await until(function(){return getApp().__pdfCacheQa.scroll},'visible paper action',10000)
    await call('automation_viewport_action',{action:'pageScrollTo','scroll-top':target.top})
    const baseline=await evaluate(function(){const q=getApp().__pdfCacheQa;return{requests:q.pdfRequests,downloads:q.pdfDownloads}})
    await call('automation_element_action',{action:'tap',selector})
    const state=await until(function(){const p=getCurrentPages().at(-1),d=p.data.pdfDownload,q=getApp().__pdfCacheQa;return d&&['opened','error'].includes(d.phase)?{phase:d.phase,error:d.error,message:d.message,percent:d.percent,bytes:d.downloadedBytes,total:d.totalBytes,opened:q.opened,requests:q.pdfRequests,downloads:q.pdfDownloads}:null},'public PDF '+(cacheOnly?'offline cache':'first open'),60000)
    assert.equal(state.phase,'opened',state.error);assert.ok(state.opened?.bytes>0);assert.equal(state.bytes,state.opened.bytes);assert.equal(state.total,state.opened.bytes);assert.equal(state.percent,100)
    if(!cacheOnly)results.push({board:item.board,kind:item.kind,id:target.id,bytes:state.opened.bytes,path:state.opened.path,firstPdfRequests:state.requests-baseline.requests,firstPdfDownloads:state.downloads-baseline.downloads})
    else{assert.equal(state.requests-baseline.requests,0,'complete paper reuse cannot issue even a Range/metadata probe');assert.equal(state.downloads-baseline.downloads,0);assert.equal(state.opened.path,results[index].path);assert.match(state.message,/缓存/);results[index].cacheOnly={requests:0,downloads:0,samePersistedFile:true,percent:100,message:state.message};await call('simulator_screenshot',{path:path.join(output,item.board+'-'+item.kind+'-cache.png'),optimize:false})}
   }
  }
  const report={status:'pass',papers:results.map(({path,...record})=>record),nativeNetwork:true,nativeFilesystem:true,secondPassPdfNetworkBlocked:true,viewerCallbackMocked:true,actualPrivateDataRead:false};fs.writeFileSync(path.join(output,'native-cache.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(JSON.stringify(report))
 }finally{
  await evaluate(function(){const app=getApp(),q=app.__pdfCacheQa;if(q){wx.request=q.request;wx.downloadFile=q.download;wx.openDocument=q.viewer;delete app.__pdfCacheQa}return true}).catch(()=>{})
  await call('automation_navigate',{action:'reLaunch',url:'/pages/index/index'}).catch(()=>{})
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
