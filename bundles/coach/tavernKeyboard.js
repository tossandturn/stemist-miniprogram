// Some clients overlay the window; others resize it. Never subtract twice.
const positive=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0
function windowSize(){try{const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();return{width:positive(info.windowWidth)||375,height:positive(info.windowHeight)||667}}catch{return{width:375,height:667}}}
function tavernViewport(baseHeight,currentHeight,keyboardHeight){
 const base=positive(baseHeight)||667,current=positive(currentHeight)||base,height=Math.min(positive(keyboardHeight),base)
 return{height:Math.max(0,Math.round(Math.min(current,base-height))),keyboardHeight:height,keyboardOpen:height>0}
}
const keyboardData={chatViewportHeight:667,chatScrollTop:0,keyboardOpen:false,composerFocused:false,composerHeight:44}
const keyboardMethods={
 initComposerViewport(){const size=windowSize();this.__baseWindowHeight=size.height;this.__baseWindowWidth=size.width;this.__keyboardHeight=0;this.__composerFocused=false;this.__keyboardListener=event=>this.onComposerKeyboard({detail:event});this.resumeComposerViewport()},
 resumeComposerViewport(){this.__pageVisible=true;if(!this.__keyboardListening&&typeof wx.onKeyboardHeightChange==='function'){wx.onKeyboardHeightChange(this.__keyboardListener);this.__keyboardListening=true}this.refreshComposerViewport()},
 suspendComposerViewport(){this.__pageVisible=false;this.__composerFocused=false;this.__keyboardHeight=0;clearTimeout(this.__chatScrollTimer);if(this.__keyboardListening){wx.offKeyboardHeightChange?.(this.__keyboardListener);this.__keyboardListening=false}this.setData({keyboardOpen:false,composerFocused:false})},
 refreshComposerViewport(){
  if(this.__disposed)return
  const size=windowSize()
  if(this.__baseWindowWidth&&Math.abs(size.width-this.__baseWindowWidth)>4){this.__keyboardHeight=0;this.__composerFocused=false;wx.hideKeyboard?.();this.__baseWindowHeight=size.height}
  this.__baseWindowWidth=size.width
  if(!this.__keyboardHeight&&!this.__composerFocused)this.__baseWindowHeight=size.height
  const layout=tavernViewport(this.__baseWindowHeight,size.height,this.__keyboardHeight)
  const patch={chatViewportHeight:layout.height,keyboardOpen:layout.keyboardOpen,composerFocused:this.__composerFocused}
  if(Object.keys(patch).some(key=>this.data[key]!==patch[key]))this.setData(patch)
 },
 onComposerKeyboard(event){
  if(this.__disposed||!this.__pageVisible||!this.data.presetChosen||this.data.selectorOpen)return
  const height=positive(event?.detail?.height)
  const previous=this.__keyboardHeight;this.__keyboardHeight=height;this.refreshComposerViewport()
  if(height&&height!==previous)this.scrollChatToLatest()
 },
 onComposerFocus(event){if(this.__disposed||!this.__pageVisible||this.data.selectorOpen)return;this.__composerFocused=true;this.onComposerKeyboard(event)},
 onComposerBlur(){if(this.__disposed||!this.__pageVisible)return;this.__composerFocused=false;this.setData({composerFocused:false})},
 onComposerLineChange(event){if(this.__disposed||!this.__pageVisible)return;const lines=Math.max(1,Math.min(4,Math.floor(positive(event?.detail?.lineCount))||1)),height=20+lines*24;if(height!==this.data.composerHeight)this.setData({composerHeight:height},()=>this.scrollChatToLatest())},
 scrollChatToLatest(){
  if(!wx.createSelectorQuery||this.__disposed||!this.__pageVisible||this.data.selectorOpen||this.data.historyBrowsing)return
  const generation=this.__conversationGeneration
  const scroll=()=>{if(this.__disposed||!this.__pageVisible||generation!==this.__conversationGeneration||this.data.selectorOpen||this.data.historyBrowsing)return;const q=wx.createSelectorQuery();q.in?.(this);q.select('.chat-inner').boundingClientRect().exec(rects=>{if(!rects[0]||this.__disposed||!this.__pageVisible||generation!==this.__conversationGeneration||this.data.historyBrowsing)return;this.__scrollNudge=(this.__scrollNudge||0)+1;this.setData({chatScrollTop:Math.ceil(rects[0].height)+40+(this.__scrollNudge%2)})})}
  if(wx.nextTick)wx.nextTick(scroll);else{clearTimeout(this.__chatScrollTimer);this.__chatScrollTimer=setTimeout(scroll,0)}
 },
 dismissComposerKeyboard(){if(this.__keyboardHeight||this.__composerFocused)wx.hideKeyboard?.();this.__keyboardHeight=0;this.__composerFocused=false;this.refreshComposerViewport()},
 onComposerConfirm(event){if(this.__disposed||!this.__pageVisible||this.data.loading||this.data.examBlocked||this.data.authRequired)return;if(typeof event?.detail?.value==='string')this.onMessage(event);return this.submit()},
 sendFortuneMessage(){return this.submit()},
}
module.exports={tavernViewport,keyboardData,keyboardMethods}
