const {parseTree,pretty,snapCursor}=require('./cwEditor')

// Native text/rule primitives, not HTML, images or a WebView. All positions are
// derived from the same slot tree used by cursor movement. Monospace advances
// keep the insertion caret and the painted characters in agreement on devices.
function layoutExpression(expression,cursor,showCursor=true){
  const tree=parseTree(expression),at=showCursor?snapCursor(expression,cursor):-1
  let caretPlaced=false
  const round=value=>Math.round(value*100)/100
  function textBox(text,size){return{width:Math.max(.2,text.length*.61)*size,height:size*1.25,baseline:size*.91,items:[{kind:'text',text,x:0,y:0,width:text.length*.61*size,height:size*1.25,size}]}}
  function put(target,box,x,y){for(const item of box.items)target.push({...item,x:item.x+x,y:item.y+y})}
  function caret(size){caretPlaced=true;return{kind:'caret',text:'',x:0,y:0,width:1.5,height:size*1.12,size}}
  function join(boxes,gap=0){
    const baseline=Math.max(0,...boxes.map(b=>b.baseline)),below=Math.max(0,...boxes.map(b=>b.height-b.baseline)),items=[]
    let x=0;for(const box of boxes){put(items,box,x,baseline-box.baseline);x+=box.width+gap}
    return{width:Math.max(0,x-gap),height:baseline+below,baseline,items}
  }
  function fraction(numerator,denominator,size){
    const width=Math.max(numerator.width,denominator.width)+size*.38,barY=numerator.height+2,items=[]
    put(items,numerator,(width-numerator.width)/2,0)
    items.push({kind:'rule',x:0,y:barY,width,height:1.3,size})
    put(items,denominator,(width-denominator.width)/2,barY+3)
    return{width,height:barY+3+denominator.height,baseline:barY+size*.28,items}
  }
  function power(argument,size){return{...argument,height:argument.height+size*.65,baseline:argument.height+size*.43}}
  function root(argument,degree,size){
    const top=3,signWidth=size*.67,degreeWidth=degree?Math.max(0,degree.width-signWidth*.3):0
    const offset=degreeWidth+signWidth,items=[]
    if(degree)put(items,degree,0,0)
    const signHeight=argument.height+top
    items.push({kind:'text',text:'√',x:degreeWidth,y:0,width:signWidth,height:signHeight,size:signHeight/1.15})
    items.push({kind:'rule',x:offset-1,y:0,width:argument.width+3,height:1.3,size})
    put(items,argument,offset,top)
    return{width:offset+argument.width+3,height:Math.max(signHeight,degree?.height||0),baseline:argument.baseline+top,items}
  }
  function template(node,size,depth){
    const sub=Math.max(15,size*.88),small=Math.max(13,size*.68)
    const slot=(index,font=size)=>row(node.slots[index],font,depth+1)
    if(node.name==='frac')return fraction(slot(0,sub),slot(1,sub),size)
    if(node.name==='mixed')return join([slot(0),fraction(slot(1,sub),slot(2,sub),size)],size*.12)
    if(node.name==='power')return power(slot(0,small),size)
    if(['sqrt','cbrt','root'].includes(node.name))return root(slot(node.slots.length-1),node.name==='root'?slot(0,small):node.name==='cbrt'?textBox('3',small):null,size)
    if(node.name==='exp')return join([textBox('e',size),power(slot(0,small),size)])
    if(node.name==='logb'){
      const base=slot(0,small);base.baseline-=size*.22
      return join([textBox('log',size),base,textBox('(',size),slot(1),textBox(')',size)])
    }
    if(node.name==='ncr'||node.name==='npr')return join([slot(0),textBox(node.name==='ncr'?'C':'P',size),slot(1)],size*.08)
    if(node.name==='dms')return join(node.slots.flatMap((_,index)=>[slot(index),textBox(['°','′','″'][index],size)]))
    const prefix=node.name==='abs'?'|':node.name+'('
    const argumentsWithCommas=node.slots.flatMap((_,index)=>index?[textBox(',',size),slot(index)]:[slot(index)])
    return join([textBox(prefix,size),...argumentsWithCommas,textBox(node.name==='abs'?'|':')',size)])
  }
  function row(node,size,depth=0){
    const rowId=node.start+':'+node.end+':'+depth
    const hit=index=>({kind:'hit',index,rowId,depth,x:0,y:0,width:0,height:size*1.25,size})
    const region=box=>{box.items.push({kind:'region',rowId,depth,x:0,y:0,width:box.width,height:box.height,size});return box}
    if(!node.children.length){
      const box={width:size*.65,height:size*1.25,baseline:size*.91,items:[hit(node.start)]}
      box.items.push({kind:'slot',x:1,y:size*.12,width:size*.48,height:size*.8,size,active:at===node.start})
      if(at===node.start&&!caretPlaced)box.items.push({...caret(size),x:0})
      return region(box)
    }
    const boxes=[]
    for(const child of node.children){
      boxes.push({width:0,height:size*1.25,baseline:size*.91,items:[hit(child.start)]})
      if(at===child.start&&!caretPlaced)boxes.push({width:1.5,height:size*1.25,baseline:size*.91,items:[caret(size)]})
      boxes.push(child.kind==='template'?template(child,size,depth):textBox(pretty(child.text),size))
    }
    boxes.push({width:0,height:size*1.25,baseline:size*.91,items:[hit(node.end)]})
    if(at===node.end&&!caretPlaced)boxes.push({width:2,height:size*1.25,baseline:size*.91,items:[caret(size)]})
    return region(join(boxes))
  }
  const fontSize=showCursor?24:22
  let layout=expression?row(tree,fontSize):textBox('0',fontSize)
  if(!expression)layout.items.push({kind:'hit',index:0,rowId:'0:0:0',depth:0,x:0,y:0,width:0,height:fontSize*1.25,size:fontSize},{kind:'region',rowId:'0:0:0',depth:0,x:0,y:0,width:layout.width,height:layout.height,size:fontSize})
  if(!expression&&showCursor)layout.items.unshift(caret(24))
  // One stable inner canvas may scroll in the LCD; the instrument itself never
  // changes height when a numerator gains a nested root/fraction.
  const pad=3, height=Math.max(42,layout.height+pad*2),y=(height-layout.height)/2
  const positioned=layout.items.map((item,index)=>{
    const value={...item,id:index,x:round(item.x+pad),y:round(item.y+y),width:round(item.width),height:round(item.height)}
    value.style=`left:${value.x}px;top:${value.y}px;width:${value.width}px;height:${value.height}px;font-size:${round(item.size)}px;line-height:${value.height}px`
    return value
  })
  return {width:Math.ceil(layout.width+pad*2+2),height:Math.ceil(height),items:positioned.filter(item=>!['hit','region'].includes(item.kind)),hitMap:{carets:positioned.filter(item=>item.kind==='hit'),regions:positioned.filter(item=>item.kind==='region')}}
}
// Select a semantic row first, so nearby numerators, denominators and powers
// cannot collapse onto the root line. Only valid editor stops are candidates.
function hitTestExpression(layout,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!layout?.hitMap?.carets.length)return null
  const {carets,regions}=layout.hitMap
  let chosen=null,distance=Infinity
  for(const region of regions){
    const dx=Math.max(region.x-x,0,x-region.x-region.width),dy=Math.max(region.y-y,0,y-region.y-region.height),score=dy*4+dx
    if(dx<=4&&dy<=4&&(!chosen||region.depth>chosen.depth||region.depth===chosen.depth&&score<distance)){chosen=region;distance=score}
  }
  chosen ||= regions.find(region=>region.depth===0)
  let best=null,score=Infinity
  for(const caret of carets){if(chosen&&caret.rowId!==chosen.rowId)continue;const dy=Math.max(caret.y-y,0,y-caret.y-caret.height),next=(caret.x-x)**2+dy**2;if(next<score){best=caret.index;score=next}}
  return best
}
module.exports={layoutExpression,hitTestExpression}
