// Native geometry/screenshots. Class overrides are not physical-device tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs')
const index=process.argv.indexOf('--output');if(index<0)throw Error('Pass --output <QA directory>')
const output=path.resolve(process.argv[index+1]);fs.mkdirSync(output,{recursive:true})
async function main(){
 await evaluate(function(){wx.reLaunch({url:'/pages/index/index'});return true})
 await until(function(){return getCurrentPages().at(-1)?.route==='pages/index/index'},'Home initialized')
 console.log(JSON.stringify({phase:'home-ready'}))
 await evaluate(function(){const p=getCurrentPages().at(-1);p.__announcementRequest=(p.__announcementRequest||0)+1;p.setData({announcementLoading:false,announcementError:false,announcement:{title:'验收示例：公告在最前面',summary:'合成展示数据，不发布到服务器。',categoryLabel:'功能更新',publishedLabel:'验收示例'},announcementUnread:true});return true})
 const reports=[]
 for(const device of ['phone','tablet']){
  await call('automation_page_action',{action:'setData',patch:JSON.stringify({deviceClass:'device-'+device,isTablet:device==='tablet',orientation:'portrait'})})
  await evaluate(function(){const app=getApp();app.__homeGeometry=null;const q=wx.createSelectorQuery();q.select('.home-announcement').boundingClientRect();q.select('.home-heading').boundingClientRect();q.select('.entry-grid').boundingClientRect();q.exec(r=>{const w=wx.getWindowInfo();app.__homeGeometry={announcement:r[0],heading:r[1],entries:r[2],viewport:{width:w.windowWidth,height:w.windowHeight}}});return true})
  const geometry=await until(function(){return getApp().__homeGeometry},'native homepage geometry')
  assert.ok(geometry.announcement&&geometry.heading&&geometry.entries)
  assert.ok(geometry.announcement.top<geometry.heading.top&&geometry.announcement.bottom<=geometry.entries.top,'Announcement appears before all learning entries')
  assert.ok(geometry.announcement.height>=44&&geometry.announcement.right<=geometry.viewport.width+1)
  assert.ok(geometry.announcement.bottom<geometry.viewport.height,'Announcement is visible in the first viewport')
  await call('simulator_screenshot',{path:path.join(output,'announcement-'+device+'-class.png'),optimize:false,'wait-for-selector':'.home-announcement'})
  reports.push({deviceClass:device,...geometry})
 }
 await call('automation_page_action',{action:'setData',patch:JSON.stringify({announcement:null,announcementError:true})})
 await evaluate(function(){getApp().__homeCardVisible=null;wx.createSelectorQuery().select('.home-announcement').boundingClientRect(r=>{getApp().__homeCardVisible={visible:Boolean(r?.height)}}).exec();return true})
 const errorVisible=(await until(function(){return getApp().__homeCardVisible},'offline announcement geometry')).visible
 assert.equal(errorVisible,true)
 await call('simulator_screenshot',{path:path.join(output,'announcement-offline.png'),optimize:false})
 await call('automation_page_action',{action:'setData',patch:JSON.stringify({announcementError:false})})
 await evaluate(function(){getApp().__homeCardVisible=null;wx.createSelectorQuery().select('.home-announcement').boundingClientRect(r=>{getApp().__homeCardVisible={visible:Boolean(r?.height)}}).exec();return true})
 const emptyVisible=(await until(function(){return getApp().__homeCardVisible},'empty announcement geometry')).visible
 assert.equal(emptyVisible,true)
 const result={status:'pass',nativeGeometry:true,firstViewport:true,emptyVisible,errorVisible,reports,scope:'phone/tablet CSS classes at actual simulator viewport, not physical iPad',serverWrites:0}
 fs.writeFileSync(path.join(output,'announcement-home-live.json'),JSON.stringify(result,null,2),'utf8')
 console.log(JSON.stringify(result))
 await evaluate(function(){delete getApp().__homeGeometry;delete getApp().__homeCardVisible;getCurrentPages().at(-1).onShow();return true})
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
