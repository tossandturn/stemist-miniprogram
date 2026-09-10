const { deviceState, syncDevice } = require('../../utils/page')
const { computeCropRect, resizedCropSize } = require('../../utils/crop')
const { attachPhoto } = require('../../utils/nativePractice')
const {attachPaperPhoto}=require('../../utils/nativePaper')
const {persistWritingPhoto,removeWritingPhoto}=require('../../utils/nativeWritingPhoto')

Page({
  data: deviceState({ src: '', x: 0, y: 0, scale: 0.68, frameInstances:[{id:0}], busy: false, error: '', canvasWidth: 1, canvasHeight: 1, coachSource: 'crop', category: '', family: '', routeId: '', stage: '', subjectCode: '' }),
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
    this.setData({ src, error: src ? '' : '没有找到照片，请返回重新拍摄。', coachSource: isWriting ? 'writing' : context.category === 'competition' ? 'competition' : 'alevel', category: isWriting ? 'ielts' : context.category || 'alevel', family: isWriting ? '' : context.family || 'exam', routeId: context.routeId || '', stage: context.stage || '', subjectCode: context.subjectCode || '' })
  },
  onShow() { syncDevice(this) },
  onReady(){this.resetFrame()},
  onResize() { syncDevice(this) },
  onUnload(){this.__disposed=true},
  cropActive(){return !this.__disposed},
  clearOwnReturn(){const current=wx.getStorageSync('stemistCropReturn');if(!this.__returnInfo||(this.__returnInfo.captureId?current?.captureId===this.__returnInfo.captureId:JSON.stringify(current)===JSON.stringify(this.__returnInfo)))wx.removeStorageSync('stemistCropReturn')},
  onMove(e) {
    this.rememberTransform(e)
  },
  onScale(e) {
    this.rememberTransform(e)
  },
  rememberTransform(e){
    if(!this.cropActive()||this.data.busy)return
    // Native movable-view owns gestures. Echoing its events back via setData
    // races native pan/pinch updates and causes visible jumps on devices.
    const detail=e?.detail||{},next={...(this.__transform||{})}
    for(const key of ['x','y','scale'])if(typeof detail[key]==='number'&&Number.isFinite(detail[key]))next[key]=detail[key]
    this.__transform=next
  },
  onGestureStart(){this.__gestureRevision=(this.__gestureRevision||0)+1},
  holdGesture(){},
  resetFrame(){
    if(this.data.busy||!this.cropActive())return
    const revision=this.__gestureRevision||0,request=this.__resetRequest=(this.__resetRequest||0)+1
    const query=wx.createSelectorQuery().in(this)
    query.select('.crop-stage').boundingClientRect()
    query.exec(rects=>{
      const stage=rects?.[0]
      if(!this.cropActive()||this.data.busy||request!==this.__resetRequest||revision!==(this.__gestureRevision||0)||!stage?.width||!stage?.height)return
      // movable-view uses its scaled top-left, not the CSS transform centre.
      this.__transform={x:stage.width*0.16,y:stage.height*0.16,scale:0.68}
      this.setData({...this.__transform,frameInstances:[{id:request}],error:''})
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
            this.exportCrop(crop.sx, crop.sy, crop.sw, crop.sh)
          } catch (error) {
            this.setData({ busy: false, error: error.message || '裁剪区域无效，请重新拍摄' })
          }
        })
      },
      fail: () => this.setData({ busy: false, error: '照片读取失败，请返回重新拍摄。' }),
    })
  },
  exportCrop(sx, sy, sw, sh) {
    if(!this.cropActive())return
    const output = resizedCropSize(sw, sh)
    const destWidth = output.width
    const destHeight = output.height
    this.setData({ canvasWidth: destWidth, canvasHeight: destHeight }, () => {
      const ctx = wx.createCanvasContext('cropCanvas', this)
      ctx.clearRect(0, 0, destWidth, destHeight)
      ctx.drawImage(this.data.src, sx, sy, sw, sh, 0, 0, destWidth, destHeight)
      ctx.draw(false, () => wx.canvasToTempFilePath({
        canvasId: 'cropCanvas',
        x: 0,
        y: 0,
        width: destWidth,
        height: destHeight,
        destWidth,
        destHeight,
        fileType: 'jpg',
        quality: 0.86,
        success: ({ tempFilePath }) => this.finish(tempFilePath),
        fail: () => this.setData({ busy: false, error: '裁剪失败，请重试。' }),
      }, this))
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
    wx.navigateBack()
  },
})
