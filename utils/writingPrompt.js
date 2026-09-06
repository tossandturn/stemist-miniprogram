function writingPrompt(value,id){
 const source=String(value||'')
 const task=String(id||'').match(/^cam\d+-w-test\d+-task([12])$/)
 if(!task)return source
 const limit=task[1]==='1'?'150':'250'
 const end=new RegExp('Write at least\\s+'+limit+'\\s+words\\.?','i').exec(source)
 const scoped=end?source.slice(0,end.index+end[0].length):source
 return scoped.replace(/^\s*\|\s*$/gm,'').replace(/\n{3,}/g,'\n\n').trim()
}
module.exports={writingPrompt}
