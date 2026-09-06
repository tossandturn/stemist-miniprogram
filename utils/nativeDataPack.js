// JSON value sharing, not executable compression. Only immutable public task
// data is packed; decoder rejects cycles, invalid indexes and reserved keys.
function unpackTask(pack,id){
 if(pack?.schemaVersion!=='stemist-native-task-pack-v2'||!pack.tasks||!Object.prototype.hasOwnProperty.call(pack.tasks,id))return null
 const memo=new Map(),active=new Set()
 function decode(value,depth=0){
  if(depth>80)throw new Error('题库数据层级无效。')
  if(!Array.isArray(value)){if(value&&typeof value==='object')throw new Error('题库编码无效。');return value}
  if(value[0]==='r'){
   const index=value[1]
   if(!Number.isInteger(index)||index<0||index>=pack.values.length||active.has(index))throw new Error('题库引用无效。')
   if(memo.has(index))return memo.get(index)
   active.add(index);const result=decode(pack.values[index],depth+1);active.delete(index);memo.set(index,result);return result
  }
  if(value[0]==='a')return value.slice(1).map(item=>decode(item,depth+1))
  if(value[0]!=='o'||value.length%2!==1)throw new Error('题库对象无效。')
  const entries=[]
  for(let i=1;i<value.length;i+=2){const key=pack.names[value[i]];if(typeof key!=='string'||['__proto__','constructor','prototype','$r'].includes(key))throw new Error('题库字段无效。');entries.push([key,decode(value[i+1],depth+1)])}
  return Object.fromEntries(entries)
 }
 return decode(pack.tasks[id])
}
module.exports={unpackTask}
