// JSON value sharing, not executable compression. Only immutable public task
// data is packed; decoder rejects cycles, invalid indexes and reserved keys.
function unpackTask(pack,id){
 const v3=pack?.schemaVersion==='stemist-native-task-pack-v3'
 if(!v3&&pack?.schemaVersion!=='stemist-native-task-pack-v2'||!Array.isArray(pack.names)||!Array.isArray(pack.values)||!pack.tasks||!Object.prototype.hasOwnProperty.call(pack.tasks,id))return null
 const memo=new Map(),active=new Set()
 function reference(index,depth){
  if(!Number.isInteger(index)||index<0||index>=pack.values.length||active.has(index))throw new Error('题库引用无效。')
  if(memo.has(index))return memo.get(index)
  active.add(index);const result=decode(pack.values[index],depth+1);active.delete(index);memo.set(index,result);return result
 }
 function decode(value,depth=0){
  if(depth>80)throw new Error('题库数据层级无效。')
  if(v3&&typeof value==='number'&&value<0){if(!Number.isInteger(value))throw new Error('题库数值无效。');return reference(-value-1,depth)}
  if(!Array.isArray(value)){if(value&&typeof value==='object')throw new Error('题库编码无效。');return value}
  if(!v3&&value[0]==='r')return reference(value[1],depth)
  if(!v3&&value[0]==='a'||v3&&value[0]===1)return value.slice(1).map(item=>decode(item,depth+1))
  if(v3&&value[0]===2){if(value.length!==2||typeof value[1]!=='number'||!Number.isFinite(value[1])||value[1]>=0)throw new Error('题库数值无效。');return value[1]}
  if((!v3&&value[0]!=='o'||v3&&value[0]!==0)||value.length%2!==1)throw new Error('题库对象无效。')
  const entries=[]
  for(let i=1;i<value.length;i+=2){const key=pack.names[value[i]];if(typeof key!=='string'||['__proto__','constructor','prototype','$r'].includes(key))throw new Error('题库字段无效。');entries.push([key,decode(value[i+1],depth+1)])}
  return Object.fromEntries(entries)
 }
 return decode(pack.tasks[id])
}
module.exports={unpackTask}
