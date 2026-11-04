// Presentation only. Never infer evidence, player actions or endings from a scene.
const media=file=>'/api/ai/tavern/media/v1/'+file
const THEMES={
 'before-rain':{theme:'rain',genre:'情感 · 重逢',eyebrow:'雨声里，留一句没有说完的话',accent:'#e7b475',navigation:'#211c18',scenes:[
  ['候车室','雨夜 · 四张旧票','一盏旧灯还亮着。四张车票，把迟到多年的话带回同一张桌子。','scriptroom-before-rain-176db571c881c24a.webp'],
  ['旧广播室','夜深 · 没有寄出的信','雨声隔在窗外。旧录音机旁，那些被略过的停顿终于有了位置。','scriptroom-before-rain-second-f7f5e6be08850534.webp'],
  ['天亮之前','将明 · 给明天一张票','雨快停了。灯下的四只杯子还留着温度，下一段路不必相同。','scriptroom-before-rain-third-0ad1ffe21b79f85f.webp'],
 ]},
 'thirteenth-curtain':{theme:'velvet',genre:'推理 · 幕后',eyebrow:'灯照得到舞台，照不到每一句证词',accent:'#dfa4ac',navigation:'#1b151a',scenes:[
  ['旧剧院后台','停演之夜 · 冻住的钟','幕布垂着，钟声已经散去。谁记住了时间，谁只记住一个影子？','scriptroom-thirteenth-curtain-872a6365d0049950.webp'],
  ['放映间','第二次核对 · 不在场的人','斜光落在玻璃上。同一个位置，从不同人的口中说出来，竟有不同的形状。','scriptroom-thirteenth-curtain-second-8758dd496b6c86fa.webp'],
  ['空舞台','最后一次排练','所有人的位置都还在。接下来，被核对的不只是时间。','scriptroom-thirteenth-curtain-third-49a6b888816ed394.webp'],
 ]},
 'last-midnight':{theme:'fog',genre:'恐怖 · 逃脱',eyebrow:'先听清，再决定要不要回应',accent:'#8cc9be',navigation:'#101d23',scenes:[
  ['末班候车室','午夜 · 广播未停','雨把窗外压成一片暗蓝。广播停顿的那一秒，屋里反而更安静了。','scriptroom-last-midnight-51e38e14201fb1c1.webp'],
  ['信号间门外','夜深 · 还有一个人','玻璃后只剩一团暖光。杂音之间，有一段回应还没有接上。','scriptroom-last-midnight-second-dcaa51dd59c645b2.webp'],
  ['归途之前','雨势渐缓 · 灯不再回头','窗外的雨声慢下来。还有什么要确认，还有谁需要被听见？','scriptroom-last-midnight-third-a356854b8d8cd3ee.webp'],
 ]},
 'inverted-observatory':{theme:'stars',genre:'密室 · 解谜',eyebrow:'一张图不完整，四个人刚好',accent:'#e3c88a',navigation:'#111b30',scenes:[
  ['星幕大厅','闭馆之后 · 镜中的四季','穹顶在头顶缓缓展开。先别急着寻找唯一答案，看看每个人手里的那一页。','scriptroom-inverted-observatory-a448ac9e216e83f1.webp'],
  ['旧资料室','第二道机关 · 被倒放的年代','纸张、刻度与旧灯并排放着。被忽略的小小一项，也可能让顺序重新清楚。','scriptroom-inverted-observatory-second-17d0bdb1e1e5975d.webp'],
  ['星光与地面','最后一扇门','星光仍在头顶。最后的方向，需要从同伴的视角再核对一次。','scriptroom-inverted-observatory-third-5364e2d8a226046b.webp'],
 ]},
}
const fallback={theme:'neutral',genre:'原创故事',eyebrow:'留在这一刻',accent:'#bca7ef',navigation:'#18213d',scenes:[['故事现场','当前场景','故事进度已保留，可继续对话。','']]}
function sceneForRoom(room={}){
 const known=Object.prototype.hasOwnProperty.call(THEMES,room.scriptId),config=known?THEMES[room.scriptId]:fallback
 const stage=Number.isInteger(room.stage)&&room.stage>=0&&room.stage<3?room.stage:0,info=config.scenes[stage]||config.scenes[0]
 const image=room.act?.image|| (info[3]?media(info[3]):'')
 let actual=null
 if(room.phase==='play'){const messages=room.messages||[];for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.actor==='dm'&&m.target==='public'&&m.kind==='narration'&&m.image===image){actual=m;break}}}
 return {theme:config.theme,supported:known,genre:config.genre,eyebrow:config.eyebrow,accent:config.accent,navigation:config.navigation,
  stage,actNumber:stage+1,place:info[0],moment:info[1],intro:typeof actual?.text==='string'?actual.text.slice(0,1000):info[2],image,
  chapter:room.phase==='lobby'?'序幕 · 等待入场':room.phase==='ended'?'终章 · 故事之后':room.act?.title||['第一幕','第二幕','第三幕'][stage],
  intensity:[0.75,1,0.65][stage],live:['lobby','play','vote'].includes(room.phase),solved:room.phase==='play'&&room.act?.puzzle?.solved===true,
 }
}
function createSceneMemory(owner){
 const key='stemistTavern:sceneSeen:v1',scope=String(owner||''),token=r=>r&&/^[a-f0-9-]{36}$/.test(r.id||'')&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<3?r.id+':'+String(r.scriptVersion||1)+':'+r.stage:''
 let value
 try{value=wx.getStorageSync(key)}catch{}
 const seen=new Set(value?.owner===scope&&Array.isArray(value.seen)?value.seen.filter(s=>typeof s==='string'&&/^[a-f0-9-]{36}:\d+:\d$/.test(s)).slice(-48):[])
 return {has:r=>!!token(r)&&seen.has(token(r)),acknowledge(r){const id=token(r);if(!id)return;seen.add(id);while(seen.size>48)seen.delete(seen.values().next().value);try{wx.setStorageSync(key,{owner:scope,seen:[...seen]})}catch{}},token}
}
const PREFS='stemistScriptAtmosphere:v1'
function readPreferences(){let p;try{p=wx.getStorageSync(PREFS)}catch{};return{motion:p?.motion!==false}}
function savePreferences(value){try{wx.setStorageSync(PREFS,{motion:value.motion!==false})}catch{}}
module.exports={THEMES,sceneForRoom,createSceneMemory,readPreferences,savePreferences}
