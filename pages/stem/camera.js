const { deviceState, syncDevice } = require('../../utils/page')
const {ensureCameraPermission,openCameraSettings,cameraError}=require('../../utils/cameraPermission')
const owner=()=>String((wx.getStorageSync('stemistUser')||{}).id||'guest')
const epoch=()=>Number(wx.getStorageSync('stemistPrivacyEpoch'))||0

Page({
  data: deviceState({ busy: false, ready: false, cameraMounted:false, cameraGeneration:0, initializing:false, identityChanged:false, permissionAction:'', privacyContractName:'用户隐私保护指引', canUseSystemCamera:false, error: '', flash: 'auto', returnPage: 'stem', context: {}, coachSource: 'capture', category: 'alevel', family: 'exam', routeId: '', stage: '', subjectCode: '', hint: '把题目、图表和答案完整放进取景框。' }),
  onLoad() {
    this.__disposed=false;this.__visible=true;this.__pageReady=false;this.__startupId=0;this.__mountId=0;this.__captureId=0;this.__owner=owner();this.__epoch=epoch()
    const info = wx.getStorageSync('stemistCameraReturn') || {}
    wx.removeStorageSync('stemistCameraReturn')
    const returnPage = ['writing', 'native-practice', 'native-paper'].includes(info.route) ? info.route : 'stem'
    const hint = returnPage === 'writing' ? '拍清整页手写作文，保留段落与修改痕迹。' : returnPage === 'native-practice' ? '拍清本题的全部解题过程和答案。' : '把题目、图表和答案完整放进取景框。'
    const context = info.context || {}
    this.setData({ returnPage, context, coachSource: returnPage === 'writing' ? 'writing' : context.category === 'competition' ? 'competition' : 'alevel', category: returnPage === 'writing' ? 'ielts' : context.category || 'alevel', family: returnPage === 'writing' ? '' : context.family || 'exam', routeId: context.routeId || '', stage: context.stage || '', subjectCode: context.subjectCode || '', hint })
  },
  onReady() { this.__pageReady=true;return this.beginCamera() },
  onShow() { this.__visible=true;syncDevice(this);if(!this.current())return this.showIdentityChange();if(!this.__usingSystemCamera&&!this.__capturePending){this.setData({busy:false});if(this.__pageReady&&!this.data.cameraMounted&&!this.data.initializing&&!this.data.permissionAction)return this.beginCamera()} },
  onHide() { if(this.__disposed)return;this.__visible=false;this.__startupId++;this.unmountCamera();if(!this.__usingSystemCamera){this.__captureId++;this.__capturePending=false;this.setData({busy:false})} },
  onResize() { syncDevice(this) },
  onUnload() { if(this.__disposed)return;this.onHide();this.__disposed=true;this.__captureId++ },
  current(){return !this.__disposed&&this.__owner===owner()&&this.__epoch===epoch()},
  showIdentityChange(){if(!this.__disposed&&this.__visible&&!this.current()){this.__startupId++;this.__captureId++;this.__capturePending=false;this.__usingSystemCamera=false;this.unmountCamera();this.setData({identityChanged:true,busy:false,permissionAction:'',canUseSystemCamera:false,error:'账号状态已变化，请返回题目后重新拍照。'})}},
  unmountCamera(){clearTimeout(this.__startupTimer);clearTimeout(this.__photoTimer);this.__camera=null;this.__mountId++;if(!this.__disposed)this.setData({cameraMounted:false,ready:false,initializing:false})},
  async beginCamera(){
    if(!this.current())return this.showIdentityChange()
    if(!this.__visible||this.data.busy||this.__usingSystemCamera)return
    const startup=++this.__startupId
    this.unmountCamera();this.setData({initializing:true,error:'',permissionAction:'',canUseSystemCamera:false})
    const cancelled=()=>!this.current()||!this.__visible||startup!==this.__startupId
    try{
      await ensureCameraPermission({cancelled});if(cancelled())return this.showIdentityChange()
      const generation=++this.__mountId
      this.setData({cameraMounted:true,cameraGeneration:generation,canUseSystemCamera:true})
      this.__startupTimer=setTimeout(()=>{if(this.current()&&this.__visible&&generation===this.__mountId&&!this.data.ready)this.cameraFailure(cameraError({errMsg:'camera startup timeout'}))},8000)
    }catch(error){if(!cancelled())this.cameraFailure(error);else this.showIdentityChange()}
  },
  cameraEventCurrent(event={}){const generation=event.currentTarget?.dataset?.cameraGeneration;return this.current()&&this.__visible&&this.data.cameraMounted&&(generation===undefined||Number(generation)===this.__mountId)},
  onCameraInitialized(event={}){
    if(!this.cameraEventCurrent(event))return
    try{this.__camera=typeof wx.createCameraContext==='function'?wx.createCameraContext():null}catch{this.__camera=null}
    if(!this.__camera?.takePhoto)return this.cameraFailure(cameraError({errMsg:'camera context unavailable'}))
    clearTimeout(this.__startupTimer);this.setData({ready:true,initializing:false,error:'',permissionAction:''})
  },
  onCameraStopped(event={}){if(this.cameraEventCurrent(event))this.cameraFailure(cameraError({errMsg:'camera stopped'}))},
  cameraFailure(error){
    if(!this.current())return
    const classified=error?.action?error:cameraError(error)
    this.__capturePending=false;this.__usingSystemCamera=false;this.unmountCamera()
    this.setData({busy:false,error:classified.action==='cancel'?'':classified.message,permissionAction:['mini','system','privacy','configuration'].includes(classified.action)?classified.action:'',privacyContractName:classified.contractName||'用户隐私保护指引',canUseSystemCamera:classified.action==='retry'})
  },
  onCameraError(event) {
    if(this.cameraEventCurrent(event))this.cameraFailure(cameraError(event?.detail||{}))
  },
  async permissionSettings(){try{const result=await openCameraSettings(this.data.permissionAction);if(!this.current())return;if(result.granted){this.setData({permissionAction:'',error:''});if(this.__visible)await this.beginCamera()}else this.setData({permissionAction:result.action,error:'相机权限尚未开启，已有照片和练习仍保留。'})}catch{if(this.current())this.setData({error:'设置未能打开，请在微信或系统设置中允许相机。'})}},
  openPrivacy(){wx.openPrivacyContract?.({fail:()=>{if(this.current())this.setData({error:'隐私指引暂时无法打开，请稍后重试。'})}})},
  agreePrivacy(){return this.beginCamera()},
  toggleFlash() {
    if(!this.current()||!this.data.ready||this.data.busy)return
    const values = ['auto', 'on', 'off']
    const next = values[(values.indexOf(this.data.flash) + 1) % values.length]
    this.setData({ flash: next })
  },
  takePhoto() {
    if (this.data.busy||!this.current()||!this.__visible||!this.data.ready||!this.__camera) return
    const capture=++this.__captureId;this.__capturePending=true
    this.setData({ busy: true, error: '' })
    this.__photoTimer=setTimeout(()=>{if(this.captureCurrent(capture))this.cameraFailure(cameraError({errMsg:'photo capture timeout'}))},10000)
    try{this.__camera.takePhoto({ quality:'high',success:({tempImagePath})=>{if(this.captureCurrent(capture)&&this.__visible)this.usePhoto(tempImagePath)},fail:error=>{if(this.captureCurrent(capture))this.cameraFailure(cameraError(error))} })}catch(error){if(this.captureCurrent(capture))this.cameraFailure(cameraError(error))}
  },
  captureCurrent(capture){return this.current()&&this.__capturePending&&capture===this.__captureId},
  async useSystemCamera(){
    if(!this.current()||!this.__visible||this.data.busy)return
    const capture=++this.__captureId;this.__capturePending=true;this.__usingSystemCamera=true;this.__startupId++;this.unmountCamera();this.setData({busy:true,error:''})
    try{await ensureCameraPermission({cancelled:()=>!this.captureCurrent(capture)});if(this.captureCurrent(capture))this.fallbackCamera(capture)}catch(error){if(this.captureCurrent(capture))this.cameraFailure(error)}
  },
  fallbackCamera(capture) {
    const success = ({ tempFiles, tempFilePaths }) => {
      if(!this.captureCurrent(capture))return
      const files = Array.isArray(tempFiles) ? tempFiles : (Array.isArray(tempFilePaths) ? tempFilePaths.map((tempFilePath) => ({ tempFilePath })) : [])
      this.usePhoto(files[0] && (files[0].tempFilePath || files[0].path))
    }
    const fail = error => {if(this.captureCurrent(capture)){this.cameraFailure(cameraError(error));if(/cancel|取消/i.test(String(error?.errMsg))&&this.__visible)this.beginCamera()} }
    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera'], camera: 'back', sizeType: ['compressed'], success, fail })
    } else if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['camera'], success, fail })
    } else {
      fail({ errMsg: 'camera api unavailable' })
    }
  },
  usePhoto(path) {
    if(!this.current())return
    clearTimeout(this.__photoTimer)
    this.__capturePending=false;this.__usingSystemCamera=false
    if (!path) { this.setData({ busy: false, error: '没有获得照片，原路线仍保留。请重新拍摄。' }); return }
    try{wx.setStorageSync('stemistCropReturn', { route: this.data.returnPage, context: this.data.context || {}, captureId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),createdAt: Date.now() })}catch{this.setData({busy:false,error:'拍照路线暂未保存，请检查本机空间后重试。原练习未修改。'});return}
    wx.navigateTo({ url: `/pages/crop/crop?src=${encodeURIComponent(path)}`, fail: () => this.setData({ busy: false, error: '无法打开裁剪页，请重试。' }) })
  },
  cancel() { this.onUnload();wx.navigateBack() },
})
