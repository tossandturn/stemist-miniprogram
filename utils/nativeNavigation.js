const {getIeltsFeature}=require('./ieltsCatalog')
function legacyUrlToNative(input){
 let value=String(input||'').trim()
 if(!/^https:\/\//i.test(value)){try{value=decodeURIComponent(value)}catch{return ''}}
 const match=value.match(/^https:\/\/(ieltsist\.com|stem\.ieltsist\.com)(\/[^#]*)?(?:#(.*))?$/i)
 if(!match)return ''
 const host=match[1].toLowerCase(),raw=match[2]||'/',hash=(match[3]||'').split('?')[0],pathname=raw.split('?')[0]
 const params={}
 for(const part of (raw.split('?')[1]||'').split('&')){const at=part.indexOf('=');if(at<0)continue;try{params[decodeURIComponent(part.slice(0,at))]=decodeURIComponent(part.slice(at+1))}catch{}}
 const query=values=>Object.entries(values).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>k+'='+encodeURIComponent(v)).join('&')
 if(/\/api\/auth\//.test(pathname))return '/pages/account/auth'
 if(host==='ieltsist.com'){
  if(!hash&&['listening','reading','writing','speaking'].includes(params.module))return '/pages/ielts/library?module='+params.module
  if(hash==='single'&&['listening','reading'].includes(params.module))return '/pages/ielts/library?module='+params.module
  if(hash==='writing-upload')return '/pages/ielts/writing'
  if(hash==='bank'&&params.module==='speaking')return '/pages/ielts/library?module=speaking'
  const id={home:'dashboard',sequence:'same-test',exam:'random-exam',vocabulary:'vocabulary',mine:'mine',subscription:'subscription'}[hash]||'dashboard'
  const feature=getIeltsFeature(id)
  if(id==='vocabulary'&&(params.termIds||params.routeId))return '/pages/ielts/vocabulary?'+query({bank:'stem',termIds:params.termIds,routeId:params.routeId})
  return feature?.nativePage||''
 }
 const category=params.category==='competition'||params.family==='competition'||params.family==='admissions'?'competition':'alevel'
 if(category==='competition'&&pathname==='/practice')return '/pages/papers/index?'+query({category,subject:params.subject||params.subjectCode})
 if(pathname==='/papers'&&params.paperId&&params.routeId)return '/pages/stem/paper?'+query({paperId:params.paperId,subject:params.course||params.subject||params.subjectCode,routeId:params.routeId,mode:params.paperMode})
 if(pathname==='/papers')return '/pages/papers/index?'+query({category,subject:params.course||params.subject||params.subjectCode})
 if(pathname==='/notebook')return '/pages/notebook/index?'+query({category,routeId:params.routeId})
 if(pathname==='/progress'||pathname==='/today')return '/pages/progress/index'
 if(pathname==='/practice'&&params.routeId&&params.tab!=='exams')return '/pages/stem/topics?'+query({routeId:params.routeId})
 if(pathname==='/practice'&&params.tab==='exams')return '/pages/papers/index?'+query({category,subject:params.subjectCode,mode:'exam-simulation'})
 return '/pages/practice/index?'+query({category,routeId:params.routeId})
}
module.exports={legacyUrlToNative}
