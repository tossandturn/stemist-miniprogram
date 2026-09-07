const {hitTestExpression}=require('./cwMathLayout')
function eventPoint(event={}){
  const touch=event.changedTouches?.[0]||event.touches?.[0]
  if(Number.isFinite(touch?.clientX)&&Number.isFinite(touch?.clientY))return {x:touch.clientX,y:touch.clientY,space:'client'}
  if(Number.isFinite(touch?.pageX)&&Number.isFinite(touch?.pageY))return {x:touch.pageX,y:touch.pageY,space:'page'}
  if(Number.isFinite(event.detail?.x)&&Number.isFinite(event.detail?.y))return {x:event.detail.x,y:event.detail.y,space:'page'}
  return null
}
const touchCursorMethods={
  expressionTouchEnabled(){return !this.__disposed&&this.__expressionVisible!==false&&!this.data.powerOff&&!this.data.menu&&!this.data.workbench&&!this.data.typing&&(!this.data.solverPhase||this.data.solverPhase==='equation')},
  onExpressionTouchStart(event){
    const point=eventPoint(event)
    this.__expressionGesture={point,time:event.timeStamp,cancelled:!point||event.touches?.length!==1}
    this.__cursorTapRequest=(this.__cursorTapRequest||0)+1
  },
  onExpressionTouchMove(event){
    const gesture=this.__expressionGesture,point=eventPoint(event)
    if(gesture&&(!point||event.touches?.length>1||point.space!==gesture.point?.space||Math.hypot(point.x-gesture.point.x,point.y-gesture.point.y)>8))gesture.cancelled=true
  },
  onExpressionTouchEnd(event){
    this.onExpressionTouchMove(event)
    const gesture=this.__expressionGesture
    if(gesture&&Number.isFinite(event.timeStamp)&&Number.isFinite(gesture.time)&&event.timeStamp-gesture.time>500)gesture.cancelled=true
  },
  cancelExpressionTouch(){this.__expressionGesture={cancelled:true};this.__cursorTapRequest=(this.__cursorTapRequest||0)+1},
  onExpressionScroll(){if(this.__expressionGesture)this.__expressionGesture.cancelled=true;this.__cursorTapRequest=(this.__cursorTapRequest||0)+1},
  onExpressionTap(event){
    const gesture=this.__expressionGesture;this.__expressionGesture=null
    if(gesture?.cancelled||!this.expressionTouchEnabled())return
    const eventRevision=event.currentTarget?.dataset?.expressionRevision
    if(eventRevision!==undefined&&Number(eventRevision)!==this.__expressionRenderVersion)return
    const point=eventPoint(event),layout=this.__expressionTouchLayout
    if(!layout)return
    if(!point){
      // Coordinate-free accessibility/DevTools taps still identify the glyph.
      // Resolve only an element from this layout, never a supplied cursor index.
      const match=String(event.target?.id||'').match(/^cw-math-(\d+)$/),item=match&&layout.items.find(item=>item.id===Number(match[1]))
      if(item)this.placeExpressionCursor(hitTestExpression(layout,item.x+item.width/2,item.y+item.height/2))
      return
    }
    if(typeof wx.createSelectorQuery!=='function')return
    const request=this.__cursorTapRequest=(this.__cursorTapRequest||0)+1,revision=this.__expressionRenderVersion,expression=this.data.expression
    const phase=this.data.solverPhase,app=this.data.calculatorApp
    const query=wx.createSelectorQuery().in(this)
    // Both Touch.clientX/Y and boundingClientRect are viewport-relative. The
    // content rect already includes nested LCD scrolling, with no width ratio:
    // its CSS min-width can be larger than a short expression's painted width.
    query.select('.cw-expression').boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec(([rect,viewport])=>{
      if(!this.expressionTouchEnabled()||request!==this.__cursorTapRequest||revision!==this.__expressionRenderVersion||expression!==this.data.expression||phase!==this.data.solverPhase||app!==this.data.calculatorApp)return
      if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.top)||rect.width<=0||rect.height<=0)return
      const x=point.x-rect.left-(point.space==='page'?Number(viewport?.scrollLeft)||0:0),y=point.y-rect.top-(point.space==='page'?Number(viewport?.scrollTop)||0:0)
      const cursor=hitTestExpression(layout,x,y)
      this.placeExpressionCursor(cursor)
    })
  },
  placeExpressionCursor(cursor){if(cursor===null||!this.expressionTouchEnabled())return;this.__justEvaluated=false;this.setData({cursor,hasResult:false,error:'',argumentMode:false});this.persistState()},
}
module.exports={touchCursorMethods}
