const {readSession}=require('../../utils/nativePractice')
const {normalizeSourceRegion}=require('../../utils/sourceRegion')
const {DEFAULT_API_BASE}=require('../../utils/apiOrigin')
const {routeById}=require('../../utils/stemRoutes')

const identity=()=>({owner:String(wx.getStorageSync('stemistUser')?.id||'guest'),epoch:Number(wx.getStorageSync('stemistPrivacyEpoch'))||0})
const lostMarks=result=>result&&Number.isFinite(result.score)&&Number.isFinite(result.maxScore)&&result.score>=0&&result.maxScore>0&&result.score<result.maxScore
const signature=(session,q,answer)=>JSON.stringify([identity(),session.id,session.index,session.routeId,session.stage,session.subjectCode,q,answer])
function questionAsset(value,q,session){
 const fail=()=>{throw Error('本题题图信息不完整，请返回练习重新加载。')}
 const url=String(typeof value==='string'?value:value?.url||'')
 if(url.startsWith('/api/stem/practice-source-image?')){
  let region
  try{region=normalizeSourceRegion({...value,schemaVersion:value.renderedImageSize?'native-source-region-v2':'native-source-region-v1'},session.routeId,q.id)}catch{fail()}
  return {...region,url:DEFAULT_API_BASE+url,kind:'question',cropped:Boolean(region.renderedImageSize)}
 }
 const match=url.match(/^\/question-assets\/([a-zA-Z0-9_-]+)\/qp-([0-9]{1,4})\.(jpg|jpeg|png|webp)$/)
 if(!match||match[1]!==q.paperId||Number(match[2])<1||Number(match[2])>1000)fail()
 const asset={url:DEFAULT_API_BASE+url,kind:'question',page:Number(match[2])}
 if(typeof value==='object'){
  const r=value.region,s=value.imageSize
  if(!Array.isArray(r)||r.length!==4||!r.every(Number.isFinite)||r[0]<0||r[1]<0||r[2]>1||r[3]>1||r[0]>=r[2]||r[1]>=r[3]||!Array.isArray(s)||s.length!==2||!s.every(n=>Number.isInteger(n)&&n>0&&n<=10000)||s[0]*s[1]>24000000||value.page!==asset.page)fail()
  asset.region=r.slice();asset.imageSize=s.slice()
 }
 return asset
}
function captureReview(sessionId,questionId){
 const session=readSession(sessionId),who=identity()
 if(!session||session.id!==sessionId||String(session.owner||'guest')!==who.owner||Number(session.privacyEpoch||0)!==who.epoch)throw Error('练习已失效，请返回重新打开。')
 const index=session.questions.findIndex(q=>q.id===questionId),q=session.questions[index],answer=session.answers?.[questionId]
 if(!q||index!==session.index||!answer)throw Error('题目或作答已变化，请返回当前错题重试。')
 const result=answer.objectiveResult,wrongChoice=result&&result.available!==false&&lostMarks(result)
 const written=Object.values(answer.results||{}).filter(lostMarks)
 if(!wrongChoice&&!written.length)throw Error('本题还没有需要讲解的错题结果，请先提交作答。')
 const options=q.choiceOptions||q.options||[],choice=String(answer.choice||result?.selectedOptionId||result?.selectedOption||'')
 if(wrongChoice&&(!choice||String(result.selectedOption||result.selectedOptionId||choice)!==choice))throw Error('作答与核对结果不一致，请重新提交答案。')
 const optionText=options.find(o=>String(o.label||o.id)===choice)?.text||''
 const prompt=q.original?[q.prompt,...options.map(o=>`${o.label||o.id}. ${o.text}`)].join('\n'):''
 if(prompt.length>8000)throw Error('本题文字过长，请在 AI Coach 中选择需要讲解的分问。')
 const provenance=q.original?'原创基础练习（非官方真题）':String(q.sourceLabel||'本题原卷')
 const reference=q.original?'原创练习参考答案':result?.qualityFlag==='aicheck'?'AI 审核参考答案':'标准答案'
 const correct=result?.correctOption||result?.correctOptionId||''
 const message=[`这是已提交的章节错题：${provenance}，第 ${q.number} 题。`,wrongChoice?`我的作答：${choice}${optionText?' — '+optionText:''}。${reference}：${correct||'待核对'}。`:'附图中的「我的作答」是我的解题过程，不是标准答案。',written.length?'AI 参考反馈（可能有误，请独立核对）：'+written.map(r=>`${r.score}/${r.maxScore} ${String(r.summary||'').slice(0,400)}`).join('；'):'','请先给出「正确答案」，再用「解题步骤」和「错因与检查」分模块解释。请独立核对题意与作答，不要盲从参考反馈；题图不清时明确说明。',prompt?'题目与选项：\n'+prompt:''].filter(Boolean).join('\n')
 const assets=q.original?[]:(q.sourceRegions?.length?q.sourceRegions:q.images||[]).map(a=>questionAsset(a,q,session))
 if(!q.original&&!assets.length)throw Error('本题题图尚未就绪，请返回重新加载。')
 if(assets.length>6)throw Error('本题图片过多，请在 AI Coach 中选择需要讲解的分问。')
 if(answer.photo&&!wrongChoice){
  const prefix=`${wx.env?.USER_DATA_PATH||''}/native-practice/${session.id}-${index}-${answer.revision}-`
  if(!answer.photo.startsWith(prefix)||!/^[a-z0-9]+\.jpg$/.test(answer.photo.slice(prefix.length)))throw Error('作答照片与当前题目不一致，请返回重新拍摄。')
  assets.push({path:answer.photo,kind:'answer'})
 }else if(!wrongChoice)throw Error('作答照片已缺失，请返回重新拍摄。')
 const context={skill:'stem-photo',view:'chapter-practice',routeId:session.routeId,stage:session.stage,subject:{code:session.subjectCode,name:routeById(session.routeId)?.subjectLabel||session.subjectCode},responseStatus:'answered',title:'章节错题讲解',focusedQuestion:{id:q.id,number:q.number},question:{id:q.id,number:q.number,label:`第 ${q.number} 题`,marks:q.marks,...(prompt?{prompt}:{})}}
 // The local chapter scorer does not always retain a verified server attempt ID.
 // Do not manufacture an exam authority from a local session identifier.
 return {identity:who,sessionId,questionId,revision:answer.revision,number:q.number,source:provenance,prompt,assets,message,context,signature:signature(session,q,answer)}
}
function currentReview(review){
 try{const next=captureReview(review.sessionId,review.questionId);return next.signature===review.signature}catch{return false}
}
function planPanels(blocks){
 const width=1200,top=112,bottom=24,max=2048,panels=[]
 let panel={width,height:top,blocks:[]}
 for(const block of blocks){
  if(!Number.isFinite(block.width)||!Number.isFinite(block.height)||block.width<=0||block.height<=0)throw Error('图片尺寸无效，请重试。')
  const scale=Math.min(1,(width-48)/block.width),height=Math.ceil(block.height*scale)
  let offset=0
  while(offset<height){
   const remaining=height-offset
   if(panel.blocks.length&&(panel.height+64+Math.min(remaining,300)+bottom>max||(remaining+top+64+bottom<=max&&panel.height+64+remaining+bottom>max))){panel.height+=bottom;panels.push(panel);panel={width,height:top,blocks:[]}}
   const piece=Math.min(height-offset,max-panel.height-64-bottom)
   panel.blocks.push({...block,x:24,y:panel.height+48,drawWidth:Math.round(block.width*scale),drawHeight:piece,sourceY:offset/scale,sourceHeight:piece/scale,continued:offset>0})
   panel.height+=piece+64;offset+=piece
   if(panels.length>1)throw Error('本题图文过长，请在 AI Coach 中选择需要讲解的分问。')
  }
 }
 if(panel.blocks.length){panel.height+=bottom;panels.push(panel)}
 if(!panels.length||panels.length>2)throw Error('本题图文过长，请在 AI Coach 中选择需要讲解的分问。')
 return panels
}
module.exports={captureReview,currentReview,planPanels}
