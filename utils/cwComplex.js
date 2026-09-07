const {tokenize,evaluateExpression,FUNCTIONS,factorial,formatNumber}=require('./calculator')
const VARIABLES=new Set(['A','B','C','D','E','F','x','y','z'])
const COMPLEX_FUNCTIONS=new Set(['conjg','arg','rep','imp'])
const validComplex=value=>Boolean(value&&typeof value==='object'&&Number.isFinite(value.re)&&Number.isFinite(value.im))
const isScalar=value=>typeof value==='number'&&Number.isFinite(value)||validComplex(value)
function pair(re,im=0){if(!Number.isFinite(re)||!Number.isFinite(im))throw new Error('复数结果超出数值范围');return {re:re===0?0:re,im:im===0?0:im}}
function complexValue(value=0){if(typeof value==='number')return pair(value);if(validComplex(value))return pair(value.re,value.im);throw new Error('复数数值无效')}
function scalar(value){const z=complexValue(value);return z.im===0?z.re:z}
function storedScalar(value,fallback=0){return isScalar(value)?scalar(value):fallback}
function add(a,b){a=complexValue(a);b=complexValue(b);return pair(a.re+b.re,a.im+b.im)}
function subtract(a,b){a=complexValue(a);b=complexValue(b);return pair(a.re-b.re,a.im-b.im)}
function multiply(a,b){a=complexValue(a);b=complexValue(b);return pair(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re)}
function divide(a,b){
 a=complexValue(a);b=complexValue(b);const scale=Math.max(Math.abs(b.re),Math.abs(b.im))
 if(scale===0)throw new Error('不能除以 0')
 const c=b.re/scale,d=b.im/scale,ar=a.re/scale,ai=a.im/scale,den=c*c+d*d
 return pair((ar*c+ai*d)/den,(ai*c-ar*d)/den)
}
function magnitude(z){return Math.hypot(z.re,z.im)}
function radiansPerUnit(mode){return mode==='RAD'?1:mode==='GRAD'?Math.PI/200:Math.PI/180}
function argument(z,mode='DEG'){
 if(z.re===0&&z.im===0)throw new Error('零的幅角未定义')
 const half=mode==='RAD'?Math.PI:mode==='GRAD'?200:180
 const angle=Math.atan2(z.im,z.re)/radiansPerUnit(mode)
 return angle<=-half?half:angle
}
function fromPolar(radius,theta,mode='DEG'){
 const radians=theta*radiansPerUnit(mode),quarter=mode==='RAD'?Math.PI/2:mode==='GRAD'?100:90,q=theta/quarter,n=Math.round(q)
 // Snap true axis angles only; a tiny nonzero angle near zero stays nonzero.
 if(Number.isSafeInteger(n)&&(q===n||n!==0&&Math.abs(q-n)<=4*Number.EPSILON*Math.abs(q))){
  const index=((n%4)+4)%4;return pair([radius,0,-radius,0][index],[0,radius,0,-radius][index])
 }
 return pair(radius*Math.cos(radians),radius*Math.sin(radians))
}
function sqrt(z){
 const scale=Math.max(Math.abs(z.re),Math.abs(z.im));if(!scale)return pair(0)
 const norm=Math.hypot(z.re/scale,z.im/scale)
 const t=Math.sqrt(scale)*Math.sqrt((norm+Math.abs(z.re)/scale)/2)
 return z.re>=0?pair(t,z.im/(2*t)):pair(Math.abs(z.im)/(2*t),(z.im<0?-1:1)*t)
}
function power(z,n){
 if(!Number.isInteger(n)){
  if(z.im===0&&z.re>=0)return pair(Math.pow(z.re,n))
  throw new Error('复数幂的指数必须为整数')
 }
 if(Math.abs(n)>=1e10)throw new Error('复数幂的指数必须在 ±10¹⁰ 以内')
 if(n===0){if(z.re===0&&z.im===0)throw new Error('0 的 0 次幂未定义');return pair(1)}
 let base=n<0?divide(1,z):z,exponent=Math.abs(n),result=pair(1)
 while(exponent){if(exponent%2===1)result=multiply(result,base);exponent=Math.floor(exponent/2);if(exponent)base=multiply(base,base)}
 return result
}
function evaluateComplex(expression,{angleMode='DEG',answer=0,variables={},functions={},functionDepth=0}={}){
 if(functionDepth>8)throw new Error('函数递归层数过多')
 const mode=['DEG','RAD','GRAD'].includes(angleMode)?angleMode:'DEG',tokens=tokenize(expression,{complex:true})
 let cursor=0,depth=0
 const peek=()=>tokens[cursor],take=()=>tokens[cursor++]
 const nested=fn=>{if(++depth>64)throw new Error('算式嵌套过深');try{return fn()}finally{depth--}}
 const real=z=>{if(z.im!==0)throw new Error('这里需要实数参数');return z.re}
 function sum(){let value=product();while(['+','-'].includes(peek()?.value)){const op=take().value,next=product();value=op==='+'?add(value,next):subtract(value,next)}return value}
 function product(){let value=implicit();while(peek()?.value==='/'||peek()?.value==='*'&&!peek().implicit){const op=take().value,next=implicit();value=op==='/'?divide(value,next):multiply(value,next)}return value}
 function implicit(){let value=polar();while(peek()?.value==='*'&&peek().implicit){take();value=multiply(value,polar())}return value}
 function polar(){const value=unary();if(peek()?.value!=='∠')return value;take();return fromPolar(real(value),real(unary()),mode)}
 function unary(){if(peek()?.value==='+'){take();return unary()}if(['-','negative-sign'].includes(peek()?.value)){take();const z=unary();return pair(-z.re,-z.im)}return exponent()}
 function exponent(){const value=postfix();if(peek()?.value!=='^')return value;take();return power(value,real(unary()))}
 function postfix(){let z=primary();while(['!','%'].includes(peek()?.value)){const op=take().value;z=op==='!'?pair(factorial(real(z))):divide(z,100)}return z}
 function primary(){
  const token=take();if(!token)throw new Error('算式不完整')
  if(token.type==='number')return pair(token.value)
  if(token.value==='('){const z=nested(sum);if(take()?.value!==')')throw new Error('括号不匹配');return z}
  if(token.type!=='identifier')throw new Error('算式不完整')
  if(VARIABLES.has(token.raw))return complexValue(variables[token.raw]??0)
  if(token.value==='i')return pair(0,1)
  if(token.value==='pi')return pair(Math.PI)
  if(token.value==='e')return pair(Math.E)
  if(token.value==='ans')return complexValue(answer)
  const name=token.value
  if(!FUNCTIONS.has(name)&&!COMPLEX_FUNCTIONS.has(name))throw new Error('不支持的复数函数：'+name)
  if(take()?.value!=='(')throw new Error(name+' 后需要括号')
  const args=[nested(sum)]
  while(peek()?.value===','){take();args.push(nested(sum));if(args.length>3)throw new Error('函数参数过多')}
  if(take()?.value!==')')throw new Error('函数括号不匹配')
  if(['f','g'].includes(name)){
   if(args.length!==1||typeof functions[name]!=='string'||!functions[name])throw new Error(name+'(x) 尚未定义')
   return evaluateComplex(functions[name],{angleMode:mode,answer,variables:{...variables,x:scalar(args[0])},functions,functionDepth:functionDepth+1})
  }
  if(name==='frac'){if(args.length!==2)throw new Error('分数需要两个参数');return divide(args[0],args[1])}
  if(args.length===1){
   const z=args[0]
   if(name==='sqrt')return sqrt(z)
   if(name==='abs')return pair(magnitude(z))
   if(name==='arg')return pair(argument(z,mode))
   if(name==='conjg')return pair(z.re,-z.im)
   if(name==='rep')return pair(z.re)
   if(name==='imp')return pair(z.im)
  }
  // Real-only functions retain the existing safe parser and domain checks.
  return pair(evaluateExpression(name+'('+args.map(real).map(String).join(',')+')',{angleMode:mode}))
 }
 const result=sum();if(cursor!==tokens.length)throw new Error('算式中还有未处理的内容');return pair(result.re,result.im)
}
function formatComplex(value,mode='rectangular',angleMode='DEG',numberFormat='standard'){
 const numeric=n=>numberFormat==='fixed'?n.toFixed(6):numberFormat==='scientific'?n.toExponential(5):formatNumber(n)
 const z=complexValue(value),signed=n=>numeric(n).replace(/^-/,'−')
 if(mode==='polar'){
  const radius=magnitude(z);if(!Number.isFinite(radius))throw new Error('模超出数值范围')
  const theta=radius?argument(z,angleMode):0,half=angleMode==='RAD'?Math.PI:angleMode==='GRAD'?200:180
  const angleText=numeric(theta)===numeric(-half)?numeric(half):signed(theta)
  return {text:signed(radius)+'∠'+angleText,kind:'number'}
 }
 const real=z.re?signed(z.re):'',imag=z.im?(Math.abs(z.im)===1?'':signed(Math.abs(z.im)))+'i':''
 return {text:imag?(real+(z.im<0?'−':real?'+':'')+imag):real||'0',kind:'number'}
}
function scalarExpression(value){const z=complexValue(value);return z.im===0?String(z.re):'('+String(z.re)+(z.im<0?'':'+')+String(z.im)+'i)'}
module.exports={COMPLEX_FUNCTIONS,validComplex,isScalar,complexValue,storedScalar,scalar,add,subtract,multiply,divide,evaluateComplex,formatComplex,scalarExpression}
