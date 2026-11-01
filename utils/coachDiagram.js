const TYPES={line:['x1','y1','x2','y2','arrow','label'],rect:['x','y','width','height','label'],circle:['cx','cy','r','label'],polyline:['points','label'],text:['x','y','text']}
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max
const label=(value,max=120)=>typeof value==='string'&&value.trim().length>0&&Array.from(value).length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]|https?:\/\/|javascript:|data:|<|>|\beval\s*\(|\bfunction\s*\(/i.test(value)
function normalizeDiagram(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','title','description','width','height','elements'].includes(k)))return null
 const {width:w,height:h,elements}=value
 if(value.version!=='stem-diagram-v1'||!finite(w,200,800)||!finite(h,120,600)||!Number.isInteger(w)||!Number.isInteger(h)||!label(value.title,100)||!label(value.description,400)||!Array.isArray(elements)||!elements.length||elements.length>60)return null
 let points=0
 for(const e of elements){
  if(!e||typeof e!=='object'||Array.isArray(e)||!Object.prototype.hasOwnProperty.call(TYPES,e.type)||Object.keys(e).some(k=>k!=='type'&&!TYPES[e.type].includes(k))||e.label!==undefined&&!label(e.label))return null
  const x=n=>finite(n,0,w),y=n=>finite(n,0,h)
  if(e.type==='line'&&(!x(e.x1)||!x(e.x2)||!y(e.y1)||!y(e.y2)||e.arrow!==undefined&&typeof e.arrow!=='boolean'))return null
  if(e.type==='rect'&&(!x(e.x)||!y(e.y)||!finite(e.width,Number.MIN_VALUE,w-e.x)||!finite(e.height,Number.MIN_VALUE,h-e.y)))return null
  if(e.type==='circle'&&(!x(e.cx)||!y(e.cy)||!finite(e.r,Number.MIN_VALUE,Math.min(e.cx,w-e.cx,e.cy,h-e.cy))))return null
  if(e.type==='text'&&(!x(e.x)||!y(e.y)||!label(e.text,160)))return null
  if(e.type==='polyline'){
   if(!Array.isArray(e.points)||e.points.length<2||e.points.length>100||e.points.some(p=>!Array.isArray(p)||p.length!==2||!x(p[0])||!y(p[1])))return null
   points+=e.points.length;if(points>1200)return null
  }
 }
 return {version:value.version,title:value.title,description:value.description,width:w,height:h,elements:elements.map(e=>({...e,...(e.points?{points:e.points.map(p=>[...p])}:{})}))}
}
function extractDiagrams(value){
 const raw=String(value||''),source=raw.slice(0,40000).replace(/@@STEM-DIAGRAM:\d+@@/g,'[图示]'),diagrams=[]
 const text=source.replace(/```stem-diagram[^\n]*\n([\s\S]*?)(?:```|$)/g,(all,json)=>{
  if(!all.endsWith('```'))return '\n图示正在整理…\n'
  let diagram=null;try{if(json.length<=30000)diagram=normalizeDiagram(JSON.parse(json))}catch{}
  if(!diagram||diagrams.length>=3)return '\n图示未能生成，请结合文字步骤理解。\n'
  const index=diagrams.push(diagram)-1;return '\n@@STEM-DIAGRAM:'+index+'@@\n'
 })
 return {text,diagrams,truncated:raw.length>40000}
}
function drawDiagram(ctx,diagram,width,height){
 const s=width/diagram.width
 ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(s,s);ctx.fillStyle='#fff';ctx.fillRect(0,0,diagram.width,diagram.height)
 ctx.lineWidth=1.7/s;ctx.strokeStyle='#5638c3';ctx.fillStyle='#18213d';ctx.font=(14/s)+'px sans-serif';ctx.lineCap='round';ctx.lineJoin='round'
 const text=(value,x,y)=>{if(!value)return;const max=diagram.width-12/s;let out=String(value);while(out.length>1&&ctx.measureText(out).width>max)out=out.slice(0,-1);const size=ctx.measureText(out).width;ctx.fillStyle='#18213d';ctx.fillText(out,Math.max(6/s,Math.min(x,diagram.width-size-6/s)),Math.max(16/s,Math.min(y,diagram.height-6/s)))}
 for(const e of diagram.elements){
  ctx.beginPath()
  if(e.type==='line'){
   ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.stroke()
   if(e.arrow){const a=Math.atan2(e.y2-e.y1,e.x2-e.x1),n=8/s;ctx.beginPath();ctx.moveTo(e.x2-n*Math.cos(a-.45),e.y2-n*Math.sin(a-.45));ctx.lineTo(e.x2,e.y2);ctx.lineTo(e.x2-n*Math.cos(a+.45),e.y2-n*Math.sin(a+.45));ctx.stroke()}
   text(e.label,(e.x1+e.x2)/2+6/s,(e.y1+e.y2)/2-6/s)
  }else if(e.type==='rect'){ctx.rect(e.x,e.y,e.width,e.height);ctx.stroke();text(e.label,e.x+6/s,e.y+e.height/2+5/s)}
  else if(e.type==='circle'){ctx.arc(e.cx,e.cy,e.r,0,Math.PI*2);ctx.stroke();text(e.label,e.cx-e.r/2,e.cy+5/s)}
  else if(e.type==='polyline'){e.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();const last=e.points[e.points.length-1];text(e.label,last[0]+6/s,last[1]-6/s)}
  else text(e.text,e.x,e.y)
 }
 ctx.restore()
}
module.exports={normalizeDiagram,extractDiagrams,drawDiagram}
