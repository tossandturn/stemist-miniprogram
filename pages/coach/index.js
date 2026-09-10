const { deviceState, syncDevice, readDraft, scheduleDraft, clearDraft, cancelDraft } = require('../../utils/page')
const { runCoach } = require('../../utils/coach')
const { isAuthError } = require('../../utils/api')
const {requestIeltsLearning}=require('../../utils/ieltsLearning')
const {takeCoachEntry,focusPassage}=require('../../utils/coachEntry')
const {loadCaptions}=require('../../utils/nativeCaptions')
const {readAsJpegDataUrl}=require('../../utils/image')
const {readCoachPhoto,clearCoachPhoto}=require('../../utils/nativeCoachPhoto')

const PRODUCT_CATEGORIES = new Set(['alevel', 'competition', 'ielts'])
const STEM_FAMILIES = new Set(['exam', 'competition', 'admissions'])

const CONTEXTS = [
  { id: 'stem-photo', label: '学科答疑', detail: '', page: '/pages/stem/capture', product: 'STEM Studio' },
  { id: 'ielts', label: 'IELTS 学习', detail: '', page: '/pages/practice/index?category=ielts', product: 'IELTSist' },
  { id: 'listening', label: 'IELTS Listening', detail: '检查答案、单复数和听力陷阱。', page: '/pages/ielts/listening', product: 'IELTSist' },
  { id: 'reading', label: 'IELTS Reading', detail: '检查原文定位和证据链。', page: '/pages/ielts/reading', product: 'IELTSist' },
  { id: 'writing', label: 'IELTS Writing', detail: '按四项标准反馈；可打字或拍手写稿。', page: '/pages/ielts/writing', product: 'IELTSist' },
]

Page({
  data: deviceState({
    contexts: CONTEXTS,
    contextId: 'stem-photo',
    contextIndex: 0,
    message: '',
    answer: '',
    warning: '',
    error: '',
    loading: false,
    coachStatus: '',
    canRetry: false,
    authRequired: false,
    draftStatus: '自动保存已开启',
    routeContext: {},
    routeContextLabel: '',
    imagePath: '',
    imageSource: '',
    entryHasImage: false,
    mediaBusy: false,
  }),
  onLoad(options) {
    this.__disposed = false;this.__mediaRequest=0
    this.__owner=String(wx.getStorageSync('stemistUser')?.id||'guest');this.__epoch=Number(wx.getStorageSync('stemistPrivacyEpoch'))||0
    this.__entry=takeCoachEntry(String(options?.entry||''));this.__entryKey=String(options?.entry||'');this.__history=[]
    const draft = readDraft('coach')
    const source = String(options && options.source || '').toLowerCase()
    const sourceContext = ['ielts', 'listening', 'reading', 'writing'].includes(source) ? source : ['stem-photo', 'capture', 'alevel', 'competition', 'papers', 'notebook', 'practice'].includes(source) ? 'stem-photo' : ''
    const next = {}
    const routeId = String(options && options.routeId || '').trim()
    const stage = String(options && options.stage || '').trim()
    const subjectCode = String(options && options.subjectCode || '').trim()
    const categoryCandidate = String(options && options.category || '').trim().toLowerCase()
    const familyCandidate = String(options && options.family || '').trim().toLowerCase()
    const category = PRODUCT_CATEGORIES.has(categoryCandidate) ? categoryCandidate : ''
    const family = STEM_FAMILIES.has(familyCandidate) ? familyCandidate : ''
    if (routeId || stage || subjectCode || category || family) {
      next.routeContext = { routeId, stage, subjectCode, category, family }
      next.routeContextLabel = [category === 'competition' ? '竞赛 / 入学考试' : category === 'alevel' ? 'A-Level 学科' : '', subjectCode, stage].filter(Boolean).join(' · ')
    }
    if (sourceContext) next.contextId = sourceContext
    else if(category==='ielts')next.contextId='ielts'
    if(this.__entry){next.contextId=this.__entry.skill;next.routeContextLabel=[this.__entry.title,this.__entry.focusedQuestion?'Q'+this.__entry.focusedQuestion.number:''].filter(Boolean).join(' · ');next.entryHasImage=Array.isArray(this.__entry.imagePaths)&&this.__entry.imagePaths.length>0}
    next.contextIndex = Math.max(0, CONTEXTS.findIndex(item => item.id === (next.contextId || sourceContext || this.data.contextId)))
    if (draft && (draft.entryKey||'')===this.__entryKey && typeof draft.message === 'string' && draft.message) { next.message = draft.message; next.draftStatus = '已恢复上次草稿' }
    if (Object.keys(next).length) this.setData(next)
    this.__historyKey='stemistCoachTurns:'+this.__owner+':'+(this.__entryKey||this.data.contextId)
    const history=wx.getStorageSync(this.__historyKey);this.__history=Array.isArray(history)?history.slice(-12):[]
  },
  current(){return !this.__disposed&&this.__owner===String(wx.getStorageSync('stemistUser')?.id||'guest')&&this.__epoch===(Number(wx.getStorageSync('stemistPrivacyEpoch'))||0)},
  identity(){return {owner:this.__owner,epoch:this.__epoch}},
  async prepareEntry(){
    const entry=this.__entry;if(!entry)return {}
    if(entry.skill==='reading'&&!entry.reading?.paperText){const data=await requestIeltsLearning('/api/reading/context?id='+encodeURIComponent(entry.taskId),undefined,{method:'GET',timeout:12000});if(!this.current())throw new Error('账号已变化。');const text=focusPassage(data.paperText,entry.section);if(!text)throw new Error('当前原文暂未连接，请重试。');entry.reading.paperText=text}
    if(entry.skill==='listening'&&!entry.listening?.audioScript){const model=await loadCaptions(entry.taskId,Number(entry.section)||1);if(!this.current())throw new Error('账号已变化。');entry.listening.audioScript=model.words.map(w=>w.word).join(' ').slice(0,16000)}
    return entry
  },
  onShow() {
    syncDevice(this)
    if(this.current())this.restorePhoto()
    if(this.data.mediaBusy)this.setData({mediaBusy:false})
    if (wx.getStorageSync('stemistSessionToken') && this.data.authRequired) this.setData({ authRequired: false, error: '' })
  },
  onResize() { syncDevice(this) },
  onUnload() { this.__disposed = true;this.__mediaRequest++; cancelDraft(this) },
  restorePhoto(){
    const imagePath=readCoachPhoto(this.identity(),this.data.contextId)
    if(imagePath!==this.data.imagePath)this.setData({imagePath,imageSource:imagePath?'已裁剪':''})
  },
  discardAttachedPhoto(){
    clearCoachPhoto(this.identity())
    if(this.data.imagePath||this.data.imageSource)this.setData({imagePath:'',imageSource:''})
  },
  photoContext(){
    const selected=CONTEXTS.find(item=>item.id===this.data.contextId)||CONTEXTS[0]
    const routeContext={...this.data.routeContext}
    if(selected.product==='IELTSist')routeContext.category='ielts'
    return {contextId:selected.id,product:selected.product,routeContext}
  },
  openCrop(path){
    if(!this.current()||!path)return
    const captureId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)
    const returnInfo={route:'coach-home',context:this.photoContext(),captureId,createdAt:Date.now()}
    try{wx.setStorageSync('stemistCropReturn',returnInfo)}catch{this.setData({mediaBusy:false,error:'图片路线暂未保存，请检查本机空间后重试。'});return}
    wx.navigateTo({url:'/pages/crop/crop?src='+encodeURIComponent(path),fail:()=>{const current=wx.getStorageSync('stemistCropReturn');if(current?.captureId===captureId)wx.removeStorageSync('stemistCropReturn');if(this.current())this.setData({mediaBusy:false,error:'无法打开裁剪页，请重试。'})}})
  },
  takePhoto(){
    if(!this.current()||this.data.loading||this.data.mediaBusy)return
    try{wx.setStorageSync('stemistCameraReturn',{route:'coach-home',context:this.photoContext(),createdAt:Date.now()})}catch{this.setData({error:'拍照路线暂未保存，请检查本机空间后重试。'});return}
    this.setData({mediaBusy:true,error:''})
    wx.navigateTo({url:'/pages/stem/camera',fail:()=>{wx.removeStorageSync('stemistCameraReturn');if(this.current())this.setData({mediaBusy:false,error:'无法打开相机，请重试。'})}})
  },
  uploadImage(){
    if(!this.current()||this.data.loading||this.data.mediaBusy)return
    const request=++this.__mediaRequest
    this.setData({mediaBusy:true,error:''})
    const success=({tempFiles,tempFilePaths}={})=>{
      if(!this.current()||request!==this.__mediaRequest)return
      const files=Array.isArray(tempFiles)?tempFiles:Array.isArray(tempFilePaths)?tempFilePaths.map(tempFilePath=>({tempFilePath})):[]
      const path=files[0]&&(files[0].tempFilePath||files[0].path)
      if(!path){this.setData({mediaBusy:false,error:'没有读取到图片，请重新选择。'});return}
      this.openCrop(path)
    }
    const fail=(error={})=>{if(!this.current()||request!==this.__mediaRequest)return;const cancelled=/cancel|取消/i.test(String(error.errMsg||''));this.setData({mediaBusy:false,error:cancelled?'':'图片未能打开，请重试。'})}
    if(typeof wx.chooseMedia==='function')wx.chooseMedia({count:1,mediaType:['image'],sourceType:['album'],sizeType:['compressed'],success,fail})
    else if(typeof wx.chooseImage==='function')wx.chooseImage({count:1,sourceType:['album'],sizeType:['compressed'],success,fail})
    else fail({errMsg:'image picker unavailable'})
  },
  removeImage(){if(!this.current()||this.data.loading||this.data.mediaBusy)return;this.discardAttachedPhoto();this.setData({error:''})},
  chooseContext(event) {
    if (!this.current() || this.data.loading) return
    const contextId = String(event.currentTarget.dataset.context || '')
    if (!CONTEXTS.some((item) => item.id === contextId)) return
    if(contextId!==this.data.contextId)this.discardAttachedPhoto()
    if(this.__entry?.skill!==contextId){this.__entry=null;this.__entryKey='';this.__historyKey='stemistCoachTurns:'+this.__owner+':'+contextId;const history=wx.getStorageSync(this.__historyKey);this.__history=Array.isArray(history)?history.slice(-12):[]}
    this.setData({ contextId, contextIndex: CONTEXTS.findIndex(item => item.id === contextId), routeContextLabel: contextId === 'stem-photo' ? this.data.routeContextLabel : '', answer: '', warning: '', error: '', authRequired: false,entryHasImage:false })
  },
  chooseContextPicker(event) {
    const selected = CONTEXTS[Number(event.detail.value)]
    if (selected && !this.data.loading) this.chooseContext({ currentTarget: { dataset: { context: selected.id } } })
  },
  onMessage(event) {
    if (!this.current() || this.data.loading) return
    const message = String(event.detail.value || '')
    this.setData({ message, error: '', authRequired: false, draftStatus: message ? '正在自动保存…' : '自动保存已开启' })
    scheduleDraft(this, 'coach', { message, contextId: this.data.contextId,entryKey:this.__entryKey })
  },
  async submit() {
    const typedMessage = this.data.message.trim()
    if (this.data.loading||!this.current()) return
    const selected = CONTEXTS.find((item) => item.id === this.data.contextId) || CONTEXTS[0]
    const entryImages=Array.isArray(this.__entry?.imagePaths)?this.__entry.imagePaths:[]
    if (!typedMessage&&!this.data.imagePath&&!entryImages.length) return this.setData({ error: '请先拍照、上传图片，或写下你的问题。' })
    const message=typedMessage||(selected.product==='IELTSist'?'请分析这张 IELTS 学习图片，指出关键问题并给出下一步建议。':'请分析这张学科题目或作答图片，指出关键问题并给出下一步提示。')
    this.setData({ loading: true, error: '', canRetry: false, authRequired: false, answer: '', warning: '', coachStatus: '正在分析…' })
    try {
      const entry=await this.prepareEntry()
      const {imagePaths,...entryContext}=entry
      const paths=[this.data.imagePath,...(Array.isArray(imagePaths)?imagePaths:[])].filter((path,index,array)=>path&&array.indexOf(path)===index).slice(0,2)
      const imageDataUrls=await Promise.all(paths.map(readAsJpegDataUrl))
      if(!this.current())return
      const result = await runCoach({
        message,
        imageDataUrls,
        context: { product: selected.product, skill: selected.id, inputMode: imageDataUrls.length?'photo':'text', stage: 'practice', source: 'stemist-miniprogram', ...(selected.id === 'stem-photo' ? this.data.routeContext : {}),...entryContext },
        history:this.__history.slice(-10),
      })
      if (!this.current()) return
      const coachState = result.coachState || {}
      this.setData({ answer: result.answer || 'AI 返回了空结果，请重试。', warning: coachState.warning || '', coachStatus: coachState.label || '反馈状态待确认', draftStatus: '已提交 · 可继续追问' })
      if(result.mode==='ai'&&result.providerStatus==='connected'){
        this.__history=[...this.__history,{role:'user',content:message},{role:'assistant',content:result.answer}].slice(-12)
        try{wx.setStorageSync(this.__historyKey,this.__history)}catch{this.setData({draftStatus:'对话暂未保存，请检查本机空间'})}
      }
      wx.setStorageSync(`stemistSubmission:coach-${selected.id}`, { category: selected.product === 'IELTSist' ? 'ielts' : 'stem', skill: selected.id, message, inputMode:imageDataUrls.length?'photo':'text', answer: result.answer || '', coachMode: result.mode || '', providerStatus: result.providerStatus || '', submittedAt: Date.now() })
      clearDraft('coach')
    } catch (error) {
      if (this.current()) this.setData({ error: error.message || 'AI 暂时不可用，原始问题已保留。', canRetry: !isAuthError(error), authRequired: isAuthError(error), coachStatus: 'AI 暂不可用' })
    } finally { if (this.current()) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading) this.submit() },
  openContext(event) {
    const selected = CONTEXTS.find((item) => item.id === String(event.currentTarget.dataset.context || ''))
    if (selected) wx.navigateTo({ url: selected.page })
  },
  openAccount() { wx.navigateTo({ url: '/pages/account/auth' }) },
  clear() {
    if (this.data.loading || !this.current()) return
    clearDraft('coach')
    this.discardAttachedPhoto()
    this.__history=[]
    wx.removeStorageSync(this.__historyKey)
    this.setData({ message: '', answer: '', warning: '', error: '', canRetry: false, authRequired: false, coachStatus: '', draftStatus: '已清空',imagePath:'',imageSource:'' })
  },
})
