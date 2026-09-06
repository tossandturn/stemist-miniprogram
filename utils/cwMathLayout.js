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
  function template(node,size){
    const sub=Math.max(15,size*.88),small=Math.max(13,size*.68)
    if(node.name==='frac')return fraction(row(node.slots[0],sub),row(node.slots[1],sub),size)
    if(node.name==='mixed')return join([row(node.slots[0],size),fraction(row(node.slots[1],sub),row(node.slots[2],sub),size)],size*.12)
    if(node.name==='power')return power(row(node.slots[0],small),size)
    if(['sqrt','cbrt','root'].includes(node.name))return root(row(node.slots[node.slots.length-1],size),node.name==='root'?row(node.slots[0],small):node.name==='cbrt'?textBox('3',small):null,size)
    if(node.name==='exp')return join([textBox('e',size),power(row(node.slots[0],small),size)])
    if(node.name==='logb'){
      const base=row(node.slots[0],small);base.baseline-=size*.22
      return join([textBox('log',size),base,textBox('(',size),row(node.slots[1],size),textBox(')',size)])
    }
    if(node.name==='ncr'||node.name==='npr')return join([row(node.slots[0],size),textBox(node.name==='ncr'?'C':'P',size),row(node.slots[1],size)],size*.08)
    if(node.name==='dms')return join(node.slots.flatMap((slot,index)=>[row(slot,size),textBox(['°','′','″'][index],size)]))
    const prefix=node.name==='abs'?'|':node.name+'('
    const argumentsWithCommas=node.slots.flatMap((slot,index)=>index?[textBox(',',size),row(slot,size)]:[row(slot,size)])
    return join([textBox(prefix,size),...argumentsWithCommas,textBox(node.name==='abs'?'|':')',size)])
  }
  function row(node,size){
    if(!node.children.length){
      const box={width:size*.65,height:size*1.25,baseline:size*.91,items:[]}
      box.items.push({kind:'slot',x:1,y:size*.12,width:size*.48,height:size*.8,size,active:at===node.start})
      if(at===node.start&&!caretPlaced)box.items.push({...caret(size),x:0})
      return box
    }
    const boxes=[]
    for(const child of node.children){
      if(at===child.start&&!caretPlaced)boxes.push({width:1.5,height:size*1.25,baseline:size*.91,items:[caret(size)]})
      boxes.push(child.kind==='template'?template(child,size):textBox(pretty(child.text),size))
    }
    if(at===node.end&&!caretPlaced)boxes.push({width:2,height:size*1.25,baseline:size*.91,items:[caret(size)]})
    return join(boxes)
  }
  const fontSize=showCursor?24:22
  let layout=expression?row(tree,fontSize):textBox('0',fontSize)
  if(!expression&&showCursor)layout.items.unshift(caret(24))
  // One stable inner canvas may scroll in the LCD; the instrument itself never
  // changes height when a numerator gains a nested root/fraction.
  const pad=3, height=Math.max(42,layout.height+pad*2),y=(height-layout.height)/2
  return {width:Math.ceil(layout.width+pad*2+2),height:Math.ceil(height),items:layout.items.map((item,index)=>{
    const value={...item,id:index,x:round(item.x+pad),y:round(item.y+y),width:round(item.width),height:round(item.height)}
    value.style=`left:${value.x}px;top:${value.y}px;width:${value.width}px;height:${value.height}px;font-size:${round(item.size)}px;line-height:${value.height}px`
    return value
  })}
}
module.exports={layoutExpression}
