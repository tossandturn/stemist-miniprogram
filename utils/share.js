const {routeById}=require('./stemRoutes')
const IMAGE='/design-system/share-card.png'
module.exports={onShareAppMessage(){
 const route=this.route||'',data=this.data||{},modules=['listening','reading','writing','speaking']
 let path='/pages/index/index',title='STEMist · A-Level 与 IELTS 学习'
 if(route==='pages/calculator/index'){path='/'+route;title='STEMist · 科学计算器'}
 else if(route==='pages/ielts/vocabulary'){path='/'+route;title='IELTS 与学科词汇学习'}
 else if(route.startsWith('pages/ielts/')){
  const module=route==='pages/ielts/library'?data.module:route.split('/').pop()
  path=modules.includes(module)?'/pages/ielts/library?module='+module:'/pages/ielts/home';title='IELTSist · 听说读写练习'
 }else if(['pages/stem/topics','pages/stem/practice'].includes(route)){
  const course=routeById(data.routeId)
  if(course&&['IGCSE','AS','A2'].includes(course.stage)){path='/pages/stem/topics?routeId='+encodeURIComponent(course.routeId);title=course.subjectLabel+' · 章节练习'}
 }else if(['pages/papers/index','pages/stem/paper'].includes(route)){
  path='/pages/papers/index?category='+(data.category==='competition'?'competition':'alevel');title='STEMist · 历年真题'
 }else if(route==='pages/practice/index')path='/pages/practice/index?category='+(['ielts','competition'].includes(data.category)?data.category:'alevel')
 // Never forward page options, private record IDs, user text, or default screenshots.
 return {title,path,imageUrl:IMAGE}
}}
