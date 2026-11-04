const {deviceState,syncDevice}=require('../../utils/page')
const api=require('./scriptRoomApi')
const {imageRequestIntent}=require('./tavernImageIntent')
const {createRoomImageCache}=require('./scriptRoomImages')
const phaseName={lobby:'选角准备',play:'故事进行中',vote:'最终投票',ended:'复盘',closed:'已关闭'}
function presentation(room,channel,images){
 const names={dm:'主持人',...Object.fromEntries(room.seats.map(s=>[s.id,s.name]))}
 const options=[{id:'public',name:'公共聊天'},{id:'dm',name:'私聊主持人'},...room.seats.filter(s=>!s.isMe).map(s=>({id:s.id,name:`私聊 ${s.name}${s.control==='ai'?' · AI':''}`}))]
 const active=options.find(s=>s.id===channel)?.id||'public'
 const visible=m=>active==='public'?m.target==='public':(m.actor===room.myRoleId&&m.target===active)||(m.actor===active&&m.target===room.myRoleId)
 const currentMission=(room.myMissions||[]).find(m=>m.stage===room.stage)||null
 const nextStep=room.phase==='play'?(room.searchOptions?.some(c=>!c.found)?'先查看自己的搜证位置':room.myClues?.some(c=>c.stage===room.stage&&!c.shared)?'公开本幕线索，与同伴核对':room.evidenceRequests?.length?'询问 AI 同伴的发现':room.act?.shared<room.act?.total?'等待好友分享本幕线索':room.act?.puzzle&&!room.act.puzzle.solved?'核对线索，提交团队结论':currentMission&&!currentMission.choiceId?'到“我的身份”作出本幕决定':'本幕目标已完成，可以确认继续'):''
 return {room:{...room,phaseLabel:phaseName[room.phase]||'',act:room.act?{...room.act,image:api.media(room.act.image)}:null},channels:options,channelIndex:Math.max(0,options.findIndex(s=>s.id===active)),channel:active,currentMission,nextStep,canAdvance:room.phase==='play'&&room.act?.shared===room.act?.total&&(!room.act?.puzzle||room.act.puzzle.solved)&&(!currentMission||!!currentMission.choiceId),
  messages:room.messages.filter(visible).map(m=>({...m,image:api.media(m.image),generated:images?.get(m.imageId)||{},label:m.actor===room.myRoleId?'我 · '+names[m.actor]:names[m.actor]||'角色',mine:m.actor===room.myRoleId,ai:m.actor==='dm'||room.seats.some(s=>s.id===m.actor&&s.control==='ai'),parts:(m.parts||[]).map((p,i)=>({...p,id:m.id+'-'+i,label:p.kind==='narration'?'旁白':names[m.actor]||'角色'}))})),
  jobs:room.jobs.filter(j=>j.kind!=='image').filter(j=>active==='public'?j.target==='public':j.actor===active&&j.target===room.myRoleId).filter(j=>['pending','running','failed'].includes(j.status)),
 }
}
Page({
 data:deviceState({room:null,loading:true,busy:false,error:'',draft:'',answer:'',panel:'chat',channel:'public',channelIndex:0,channels:[],messages:[],jobs:[],anchor:'',syncLabel:'连接中',canChat:false,currentMission:null,nextStep:'',imageMode:false}),
 onLoad(options){this.__alive=true;this.__visible=true;this.__owner=api.identity();this.__options=options||{};this.__request=0;this.__pending=null;this.__images=createRoomImageCache({load:api.image,current:()=>this.current(),changed:()=>{if(this.__rawRoom)this.adopt(this.__rawRoom)}});this.open()},
 onShow(){syncDevice(this);if(this.__owner&&this.__owner!==api.identity()){this.__images?.dispose();this.__rawRoom=null;this.__pending=null;this.setData({room:null,messages:[],draft:'',jobs:[],currentMission:null,channels:[]});this.__alive=false;wx.redirectTo({url:'/bundles/coach/scripts'});return}this.__visible=true;if(this.data.room)this.poll()},onResize(){syncDevice(this)},
 onHide(){this.__visible=false;clearTimeout(this.__timer)},onUnload(){this.__alive=false;this.__visible=false;this.__request++;clearTimeout(this.__timer);this.__images?.dispose()},
 current(){return this.__alive&&this.__owner===api.identity()},
 adopt(room){if(!this.current())return;this.__rawRoom=room;const data=presentation(room,this.data.channel,this.__images),old=this.data.messages[this.data.messages.length-1]?.id,newId=data.messages[data.messages.length-1]?.id;this.setData({...data,loading:false,error:'',canChat:['play','vote'].includes(room.phase),syncLabel:'已同步',...(newId!==old?{anchor:'message-'+newId}:{})});for(const m of data.messages)if(m.imageId)this.__images?.request(room.id,m.imageId)},
 async open(){const request=++this.__request;this.setData({loading:true,error:''});try{
  const o=this.__options;let room
  if(o.roomId)room=await api.get(o.roomId)
  else if(o.invite){this.__openingRequest||={inviteCode:o.invite,requestId:api.requestId()};room=await api.join(this.__openingRequest)}
  else if(o.create){this.__openingRequest||={scriptId:o.create,requestId:api.requestId()};room=await api.create(this.__openingRequest)}
  else throw Error('缺少房间信息，请从剧本列表进入。')
  if(!this.current()||request!==this.__request)return;this.__options={roomId:room.id};this.adopt(room);this.schedule()
 }catch(e){if(this.current()&&request===this.__request)this.setData({loading:false,error:e.message,syncLabel:'尚未连接'})}},
 schedule(){clearTimeout(this.__timer);if(this.current()&&this.__visible&&this.data.room&&!['closed'].includes(this.data.room.phase))this.__timer=setTimeout(()=>this.poll(),3000)},
 async poll(){if(!this.current()||!this.__visible||this.__polling)return;this.__polling=true;const id=this.data.room?.id;try{if(id){const room=await api.get(id);if(this.current()&&!this.data.busy)this.adopt(room)}}catch(e){if(this.current())this.setData({syncLabel:e.statusCode===410?'房间已过期':'连接暂断，正在重连',error:e.message});if([401,404,410].includes(e.statusCode)){this.__visible=false}}finally{this.__polling=false;this.schedule()}},
 async perform(type,extra={}){
  if(!this.current()||this.data.busy||!this.data.room)return
  if(this.__pending&&type!==this.__pending.type){this.setData({error:'请先重试原操作，确认结果后再继续。'});return}
  const id=this.data.room.id,p=this.__pending||{type,...extra,revision:this.data.room.revision,requestId:api.requestId()}
  this.__pending=p;this.setData({busy:true,error:''})
  try{const result=await api.act(id,p);if(!this.current())return;this.__pending=null
   if(result.left){wx.redirectTo({url:'/bundles/coach/scripts'});return}
   this.adopt(result);if(p.type==='chat'||p.type==='image')this.setData({draft:'',imageMode:false});if(p.type==='solve')this.setData({answer:''})
  }catch(e){if(!this.current())return
   if(e.statusCode){this.__pending=null;if(e.code==='script_revision_conflict')try{this.adopt(await api.get(id))}catch{}}
   this.setData({error:e.message+(this.__pending?' 输入已保留，点“重试操作”确认原请求结果。':'')})
  }finally{if(this.current())this.setData({busy:false,pending:!!this.__pending});this.schedule()}
 },
 action(e){this.perform(e.currentTarget.dataset.type,e.currentTarget.dataset.role?{roleId:e.currentTarget.dataset.role}:{})},
 clue(e){this.perform(e.currentTarget.dataset.type,{clueId:e.currentTarget.dataset.id})},
 requestEvidence(e){return this.perform('requestEvidence',{roleId:e.currentTarget.dataset.role})},
 chooseMission(e){const missionId=e.currentTarget.dataset.id,optionId=e.currentTarget.dataset.option;wx.showModal({title:'保存这个决定？',content:'仅自己可见，会保留到本局复盘。是否在聊天中说出，仍由你决定。保存后不能修改。',success:r=>{if(r.confirm&&this.current())this.perform('choose',{missionId,optionId})}})},
 vote(e){const choiceId=e.currentTarget.dataset.id;wx.showModal({title:'确认投票',content:'投票提交后不能修改，所有人提交后一起揭晓。',success:r=>{if(r.confirm&&this.current())this.perform('vote',{choiceId})}})},
 typeDraft(e){this.setData({draft:e.detail.value})},typeAnswer(e){this.setData({answer:e.detail.value})},
 send(){if(this.data.draft.trim())return this.perform(this.data.room.scriptVersion>=2&&(this.data.imageMode||imageRequestIntent(this.data.draft))?'image':'chat',{text:this.data.draft.trim(),target:this.data.channel})},solve(){if(this.data.answer.trim())return this.perform('solve',{answer:this.data.answer.trim()})},
 toggleImage(){this.setData({imageMode:!this.data.imageMode})},
 retryImageFetch(e){if(this.current())return this.__images?.retry(this.data.room.id,e.currentTarget.dataset.id)},
 imageFailed(e){if(this.current())this.__images?.failed(e.currentTarget.dataset.id)},
 retryAction(){if(this.__pending)return this.perform(this.__pending.type)},retryAi(e){return this.perform('retry',{jobId:e.currentTarget.dataset.id})},
 panel(e){this.setData({panel:e.currentTarget.dataset.panel})},
 channel(e){const item=this.data.channels[Number(e.detail.value)];if(item){this.setData({channel:item.id});this.adopt(this.__rawRoom)}},
 copyInvite(){if(this.data.room?.inviteCode)wx.setClipboardData({data:this.data.room.inviteCode})},
 preview(e){const url=e.currentTarget.dataset.src;if(url)wx.previewImage({current:url,urls:[url]})},
 exit(){wx.showModal({title:'离开这局故事？',content:'退出房间后，你的角色交给 AI；不能中途重新领取身份。只想暂时离开页面，请点左上角返回，进度会保留。',success:r=>{if(r.confirm&&this.current())this.perform('leave')}})},
 onShareAppMessage(){const room=this.data.room,safe=require('../../utils/share').onShareAppMessage.call(this);return room?.phase==='lobby'?{...safe,title:`邀请你体验《${room.title}》`,path:'/bundles/coach/scriptRoom?invite='+room.inviteCode}:{...safe,title:'AI 剧本杀 · 四个故事',path:'/bundles/coach/scripts'}},
})
