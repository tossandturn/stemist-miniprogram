const { deviceState, syncDevice } = require('../../utils/page')
const { computeCropRect, resizedCropSize,moveCropSelection } = require('../../utils/crop')
const { attachPhoto } = require('../../utils/nativePractice')
const {attachPaperPhoto}=require('../../utils/nativePaper')
const {persistWritingPhoto,removeWritingPhoto}=require('../../utils/nativeWritingPhoto')
const {persistCoachPhotos,readCoachPhotoPaths,clearCoachPhoto}=require('../../utils/nativeCoachPhoto')

Page({
onShareAppMessage(){return require('../../utils/share').onShareAppMessage.call(this)},
data: deviceState({ src: '', x: 0, y: 0, scale: 1, selection:null,frameInstances:[{id:0}], busy: false, error: '', canvasWidth: 1, canvasHeight: 1, coachSource: 'crop', category: '', family: '', routeId: '', stage: '', subjectCode: '' }),
onLoad(options) {
this.__disposed=false
this.__owner=String((wx.getStorageSync('stemistUser')||{}).id||'guest')
this.__epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
options = options || {}
let src = ''
try { src = options.src ? decodeURIComponent(options.src) : '' } catch { src = '' }
const returnInfo = wx.getStorageSync('stemistCropReturn') || {}
this.__returnInfo=JSON.parse(JSON.stringify(returnInfo))
const context = returnInfo.context || {}
const isWriting = returnInfo.route === 'writing'
const isCoach = returnInfo.route === 'coach-home'
const routeContext=context.routeContext||context
this.setData({ src, error: src ? '' : '没有找到照片，请返回重新拍摄。', coachSource: isWriting ? 'writing' : isCoach ? context.contextId || 'stem-photo' : routeContext.category === 'competition' ? 'competition' : 'alevel', category: isWriting ? 'ielts' : isCoach && context.contextId !== 'stem-photo' ? 'ielts' : routeContext.category || 'alevel', family: isWriting || (isCoach && context.contextId !== 'stem-photo') ? '' : routeContext.family || 'exam', routeId: routeContext.routeId || '', stage: routeContext.stage || '', subjectCode: routeContext.subjectCode || '' })
},
onShow() { syncDevice(this);if(!this.cropActive())this.setData({src:'',busy:false,error:'账号已变化，请返回重新拍摄。'}) },
onReady(){this.resetFrame()},
onResize() {
syncDevice(this)
const before=this.__cropBounds,selection=this.data.selection,revision=this.__gestureRevision||0
if(!before||!selection||this.data.busy||this.__selectionGesture)return
const query=wx.createSelectorQuery().in(this);query.select('.crop-stage').boundingClientRect();query.exec(rects=>{
const after=rects?.[0]
if(!this.cropActive()||this.data.busy||this.__selectionGesture||revision!==(this.__gestureRevision||0)||!after?.width||!after?.height)return
const rx=after.width/before.width,ry=after.height/before.height,width=Math.min(after.width,Math.max(88,selection.width*rx)),height=Math.min(after.height,Math.max(88,selection.height*ry)),transform=this.__transform||this.data
this.__cropBounds={width:after.width,height:after.height};this.__transform={x:transform.x*rx,y:transform.y*ry,scale:transform.scale}
this.setData({...this.__transform,selection:{left:Math.max(0,Math.min(after.width-width,selection.left*rx)),top:Math.max(0,Math.min(after.height-height,selection.top*ry)),width,height}})
})
},
onUnload(){this.__disposed=true},
cropActive(){return !this.__disposed&&(this.__owner===undefined||this.__owner===String((wx.getStorageSync('stemistUser')||{}).id||'guest'))&&(this.__epoch===undefined||this.__epoch===(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))},
clearOwnReturn(){const current=wx.getStorageSync('stemistCropReturn');if(!this.__returnInfo||(this.__returnInfo.captureId?current?.captureId===this.__returnInfo.captureId:JSON.stringify(current)===JSON.stringify(this.__returnInfo)))wx.removeStorageSync('stemistCropReturn')},
onMove(e) {
this.rememberTransform(e)
},
onScale(e) {
this.rememberTransform(e)
},
rememberTransform(e){
if(!this.cropActive()||this.data.busy)return
const detail=e?.detail||{},next={...(this.__transform||{})}
for(const key of ['x','y','scale'])if(typeof detail[key]==='number'&&Number.isFinite(detail[key]))next[key]=detail[key]
this.__transform=next
},
onGestureStart(){this.__gestureRevision=(this.__gestureRevision||0)+1},
holdGesture(){},
onSelectionStart(e){
if(this.data.busy||!this.cropActive()||!this.data.selection||e.touches?.length!==1)return
const point=e.touches[0],corner=String(e.currentTarget.dataset.corner||'')
if(!['move','nw','ne','sw','se'].includes(corner))return
this.onGestureStart();this.__selectionGesture={box:{...this.data.selection},x:point.clientX??point.pageX,y:point.clientY??point.pageY,corner}
},
onSelectionMove(e){
const gesture=this.__selectionGesture,point=e.touches?.[0]
if(this.data.busy||!this.cropActive()||!gesture||!point||!this.__cropBounds)return
const dx=(point.clientX??point.pageX)-gesture.x,dy=(point.clientY??point.pageY)-gesture.y
if(Number.isFinite(dx)&&Number.isFinite(dy))this.setData({selection:moveCropSelection(gesture.box,dx,dy,gesture.corner,this.__cropBounds)})
},
onSelectionEnd(){this.__selectionGesture=null},
zoomFrame(e){
if(this.data.busy||!this.cropActive()||!this.data.src)return
const transform=this.__transform||this.data,delta=Number(e.currentTarget.dataset.delta)
if(!Number.isFinite(delta))return
const scale=Math.max(.3,Math.min(3,(Number(transform.scale)||1)+delta))
this.onGestureStart();this.__transform={x:transform.x,y:transform.y,scale};this.setData(this.__transform)
},
resetFrame(){
if(this.data.busy||!this.cropActive())return
const revision=this.__gestureRevision||0,request=this.__resetRequest=(this.__resetRequest||0)+1
const query=wx.createSelectorQuery().in(this)
query.select('.crop-stage').boundingClientRect()
query.exec(rects=>{
const stage=rects?.[0]
if(!this.cropActive()||this.data.busy||request!==this.__resetRequest||revision!==(this.__gestureRevision||0)||!stage?.width||!stage?.height)return
this.__cropBounds={width:stage.width,height:stage.height};this.__selectionGesture=null
this.__transform={x:0,y:0,scale:1}
this.setData({...this.__transform,selection:{left:0,top:0,width:stage.width,height:stage.height},frameInstances:[{id:request}],error:''})
})
},
confirm() {
if (this.data.busy || !this.data.src||!this.cropActive()) return
this.setData({ busy: true, error: '' })
wx.getImageInfo({
src: this.data.src,
success: (info) => {
if(!this.cropActive())return
const query = wx.createSelectorQuery().in(this)
query.select('.crop-content').boundingClientRect()
query.select('.crop-box').boundingClientRect()
query.exec((rects) => {
if(!this.cropActive())return
const imageRect = rects && rects[0]
const boxRect = rects && rects[1]
if (!imageRect || !boxRect) {
this.setData({ busy: false, error: '裁剪区域尚未准备好，请重试' })
return
}
try {
const crop = computeCropRect({ viewport: imageRect, box: boxRect, imageWidth: info.width, imageHeight: info.height })
this.exportCrop(crop.sx, crop.sy, crop.sw, crop.sh, info.path || this.data.src)
} catch (error) {
this.setData({ busy: false, error: error.message || '裁剪区域无效，请重新拍摄' })
}
})
},
fail: () => this.setData({ busy: false, error: '照片读取失败，请返回重新拍摄。' }),
})
},
exportCrop(sx, sy, sw, sh, sourcePath = this.data.src) {
if(!this.cropActive())return
const output = resizedCropSize(sw, sh)
const destWidth = output.width
const destHeight = output.height
const jpeg=this.__returnInfo?.route==='coach-home'&&this.__returnInfo.context?.contextId==='stem-photo'
const format=jpeg?{fileType:'jpg',quality:.9}:{fileType:'png'}
this.setData({ canvasWidth: destWidth, canvasHeight: destHeight }, () => {
const source = sourcePath || this.data.src
const done=({tempFilePath}={})=>{if(!this.cropActive())return;if(tempFilePath)this.finish(tempFilePath);else this.setData({busy:false,error:'裁剪图片未生成，请重试。'})}
const legacy=()=>{if(!wx.createCanvasContext)return this.setData({busy:false,error:'当前设备不支持裁剪，请更新微信。'});const c=wx.createCanvasContext('cropCanvas',this);c.clearRect(0,0,destWidth,destHeight);if(jpeg){c.setFillStyle('#fff');c.fillRect(0,0,destWidth,destHeight)}c.drawImage(source,sx,sy,sw,sh,0,0,destWidth,destHeight);c.draw(false,()=>wx.canvasToTempFilePath({canvasId:'cropCanvas',x:0,y:0,width:destWidth,height:destHeight,destWidth,destHeight,...format,success:done,fail:()=>this.setData({busy:false,error:'裁剪失败，请重试。'})},this))}
try{const q=wx.createSelectorQuery?.().in(this);if(!q?.select)return legacy();q.select('#cropCanvas2d').fields({node:true}).exec(r=>{const c=r?.[0]?.node;if(!c?.getContext||!c.createImage)return legacy();c.width=destWidth;c.height=destHeight;const i=c.createImage();i.onerror=legacy;i.onload=()=>{if(!this.cropActive())return;const ctx=c.getContext('2d');if(jpeg){ctx.fillStyle='#fff';ctx.fillRect(0,0,destWidth,destHeight)}ctx.drawImage(i,sx,sy,sw,sh,0,0,destWidth,destHeight);setTimeout(()=>wx.canvasToTempFilePath({canvas:c,x:0,y:0,width:destWidth,height:destHeight,destWidth,destHeight,...format,success:done,fail:legacy},this),0)};i.src=source})}catch{legacy()}
})
},
async finish(path) {
if(!this.cropActive())return
const expected={owner:this.__owner??String((wx.getStorageSync('stemistUser')||{}).id||'guest'),epoch:this.__epoch??(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)}
if(expected.owner!==String((wx.getStorageSync('stemistUser')||{}).id||'guest')||expected.epoch!==(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0))return this.setData({busy:false,error:'账号已变化，请返回重新拍摄。'})
const returnInfo = this.__returnInfo||wx.getStorageSync('stemistCropReturn') || { route: 'stem' }
if(returnInfo.route==='native-paper'){
return attachPaperPhoto(returnInfo.context,path,{cancelled:()=>!this.cropActive()}).then(result=>{
if(!this.cropActive())return
this.clearOwnReturn()
const pages=typeof getCurrentPages==='function'?getCurrentPages():[]
const index=pages.map(page=>page.route).lastIndexOf('pages/stem/paper')
const fallback=()=>wx.redirectTo({url:'/pages/stem/paper?paperId='+encodeURIComponent(result.paperId)+'&subject='+encodeURIComponent(result.subject)+'&routeId='+encodeURIComponent(result.routeId)+'&mode='+encodeURIComponent(result.mode)})
if(index<0)return fallback()
wx.navigateBack({delta:pages.length-1-index,fail:fallback})
}).catch(error=>{if(this.cropActive())this.setData({busy:false,error:error.message||'照片尚未保存，请重试。'})})
}
if (returnInfo.route === 'native-practice') {
return attachPhoto(returnInfo.context, path, {cancelled:()=>!this.cropActive()}).then(sessionId => {
if(!this.cropActive())return
this.clearOwnReturn()
const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
const index = pages.map(page => page.route).lastIndexOf('pages/stem/practice')
const fallback = () => wx.redirectTo({ url: `/pages/stem/practice?sessionId=${encodeURIComponent(sessionId)}` })
if (index < 0) return fallback()
wx.navigateBack({ delta: pages.length - 1 - index, fail: fallback })
}).catch(error => {if(this.cropActive())this.setData({ busy: false, error: error.message || '照片未保存，请重试。' })})
}
if (returnInfo.route === 'coach-home') {
const feature=['steps','answers'].includes(returnInfo.context?.feature)?returnInfo.context.feature:''
const contextId=String(returnInfo.context?.contextId||'stem-photo'),entryKey=String(returnInfo.context?.entryKey||'')
const others=returnInfo.recrop?readCoachPhotoPaths(expected,contextId,entryKey).filter(p=>p!==this.data.src):[]
try { path = (await persistCoachPhotos([path,...others].slice(0,2), expected, { contextId,entryKey,feature,autoSubmitNonce:returnInfo.recrop?'':returnInfo.captureId }, { cancelled: () => !this.cropActive() }))[0] } catch (error) { if(this.cropActive())this.setData({ busy: false, error: error.message || '图片尚未保存，请重试。' }); return }
if (!this.cropActive()) { clearCoachPhoto(expected); return }
this.clearOwnReturn()
const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
const index = pages.map((page) => page.route).lastIndexOf('pages/coach/index')
const routeContext=returnInfo.context?.routeContext||{}
const source=contextId==='stem-photo'?'alevel':contextId
const query=['source='+encodeURIComponent(source),feature?'feature='+feature:'',entryKey?'entry='+encodeURIComponent(entryKey):'',routeContext.category?'category='+encodeURIComponent(routeContext.category):'',routeContext.routeId?'routeId='+encodeURIComponent(routeContext.routeId):'',routeContext.stage?'stage='+encodeURIComponent(routeContext.stage):'',routeContext.subjectCode?'subjectCode='+encodeURIComponent(routeContext.subjectCode):''].filter(Boolean).join('&')
const fallback = () => wx.redirectTo({ url: `/pages/coach/index?${query}` })
if (index < 0) { fallback(); return }
wx.navigateBack({ delta: pages.length - 1 - index, fail: fallback })
return
}
if (returnInfo.route === 'writing') {
try{path=await persistWritingPhoto(path,expected)}catch(error){this.setData({busy:false,error:error.message});return}
if(!this.cropActive()){removeWritingPhoto(path);return}
this.clearOwnReturn()
wx.setStorageSync('stemistWritingPhoto', path)
wx.setStorageSync('stemistWritingPhotoMeta',{...expected,scope:returnInfo.context?.writingScope||'',slot:Number(returnInfo.context?.writingSlot)||0})
const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
const isPair=returnInfo.context?.writingReturnRoute==='pages/ielts/writing-full'&&/^cam\d+-test\d+$/.test(String(returnInfo.context?.pairId||''))
const target=isPair?'pages/ielts/writing-full':'pages/ielts/writing'
const taskId=String(returnInfo.context?.writingTaskId||''),examKey=String(returnInfo.context?.writingExamKey||'')
const url='/'+target+(isPair?'?pairId='+encodeURIComponent(returnInfo.context.pairId):/^[a-zA-Z0-9_-]{1,120}$/.test(taskId)?'?taskId='+encodeURIComponent(taskId)+(/^mini-exam-[a-zA-Z0-9_-]+$/.test(examKey)?'&examKey='+encodeURIComponent(examKey):''):'')
const index = pages.map((page) => page.route).lastIndexOf(target)
if (index < 0) { wx.redirectTo({ url }); return }
wx.navigateBack({
delta: pages.length - 1 - index,
fail: () => wx.redirectTo({ url }),
})
return
}
try{path=await persistWritingPhoto(path,expected)}catch(error){this.setData({busy:false,error:error.message});return}
if(!this.cropActive()){removeWritingPhoto(path);return}
this.clearOwnReturn()
wx.setStorageSync('stemistCoachContext', returnInfo.context || {})
wx.setStorageSync('stemistCroppedImage', path)
wx.setStorageSync('stemistCroppedImageMeta',{...expected,path})
wx.redirectTo({ url: `/pages/stem/coach?src=${encodeURIComponent(path)}` })
},
cancel() {
this.__disposed=true
this.clearOwnReturn()
wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/index/index'})})
},
})
