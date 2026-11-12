import assert from 'node:assert/strict'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
let sequence=0,gets=0,creates=0,mode='',late=null,actions=[],identity='owner-a'
const room={id:'00000000-0000-0000-0000-000000000891',scriptId:'before-rain',scriptVersion:2,revision:1,title:'测试房间',phase:'play',stage:0,myRoleId:'a',seats:[{id:'a',name:'甲',control:'human',isMe:true},{id:'b',name:'乙',control:'ai'}],myRole:{id:'a'},messages:[{id:'m1',actor:'b',target:'public',text:'原消息',kind:'dialogue'}],jobs:[],myClues:[],publicClues:[],searchOptions:[],myMissions:[],act:{title:'第一幕',image:''}}
const error=(statusCode,code='')=>Object.assign(Error('原始内部错误不应输出'),{statusCode,code})
const timers=new Map();let timerId=0
const api={identity:()=>identity,requestId:()=>`recovery-${++sequence}`,media:s=>s,get:async()=>{gets++;if(late)return late.promise;if(mode==='get502')throw error(502);if(mode==='get429')throw error(429);return structuredClone(room)},create:async p=>{creates++;actions.push(structuredClone(p));if(mode==='create502')throw error(502);if(mode==='roomlimit')throw error(429,'script_room_limit');return structuredClone(room)},act:async(id,p)=>{actions.push(structuredClone(p));if(mode==='act502')throw error(502);if(mode==='rate')throw error(429,'script_rate_limit');if(mode==='conflict')throw error(409,'script_revision_conflict');return {...structuredClone(room),revision:3}}}
const runtime=miniRuntime({modules:{'bundles/coach/scriptRoomApi':api},globals:{setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id)}})
let p=runtime.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle();p.onHide();p.setData({draft:'不能丢的草稿',answer:'ABC'})
mode='act502';await p.send();assert.ok(p.__pending,'ambiguous HTTP 502 must retain original nonce')
assert.equal(p.data.draft,'不能丢的草稿');assert.equal(p.data.answer,'ABC');assert.equal(p.data.room.id,room.id)
const nonce=p.__pending.requestId;mode='';await p.retryAction();assert.equal(actions.at(-1).requestId,nonce);assert.equal(p.data.draft,'')
// A stale GET response cannot roll back a successful command's revision.
late=deferred();p.__visible=true;const polling=p.poll();p.setData({draft:'第二条'});await p.send();late.resolve({...structuredClone(room),revision:2});await polling;late=null
assert.equal(p.data.room.revision,3,'late polling must not overwrite a newer action response')
p.setData({draft:'一直留着'});mode='get502';for(let i=0;i<6;i++)await p.poll()
assert.equal(p.data.syncPaused,true,'automatic reconnect is bounded')
assert.equal(timers.has(p.__timer),false);assert.equal(p.data.draft,'一直留着');assert.equal(p.data.messages[0].text,'原消息')
const before=gets;await p.poll();assert.equal(gets,before,'paused polling does not send another request')
mode='';await p.retrySync();assert.equal(p.data.syncPaused,false);assert.equal(p.data.draft,'一直留着');p.onUnload()
mode='create502';actions=[];p=runtime.page('bundles/coach/scriptRoom');p.onLoad({create:'before-rain'});await settle();const original=actions[0].requestId;await p.open();assert.equal(actions.at(-1).requestId,original,'create retry uses the exact original idempotency key')
mode='';await p.open();assert.equal(p.data.room.id,room.id);const created=creates;await p.poll();assert.equal(creates,created,'recovering a room never creates another room');p.onUnload()
mode='roomlimit';p=runtime.page('bundles/coach/scriptRoom');p.onLoad({create:'before-rain'});await settle();assert.match(p.data.error,/3.*继续|3.*结束/);assert.ok(!p.data.error.includes('连接'));assert.equal(p.data.showRoomList,true);p.onUnload()
// A definitive conflict triggers a read, but the read may outlive the page or
// account. No catch/finally UI write may cross that second asynchronous edge.
for(const transition of ['unload','account']){
 mode='';late=null;identity='owner-a';p=runtime.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle();p.onHide();p.setData({draft:'旧账号的输入'})
 mode='conflict';late=deferred();const sending=p.send();await settle()
 let lateWrites=0;const originalSetData=p.setData;p.setData=function(...args){lateWrites++;return originalSetData.apply(this,args)}
 if(transition==='unload')p.onUnload();else identity='owner-b'
 late.resolve(room);await sending;late=null
 if(transition==='unload')assert.equal(lateWrites,0,'unloaded page must not receive a late conflict error')
 else {assert.equal(p.data.room,null,'account change during conflict refresh clears private room data');assert.equal(p.data.accessEnded,true);assert.doesNotMatch(p.data.error,/原始内部错误/);p.onUnload()}
}
identity='owner-a';mode=''
const helper=runtime.load('bundles/coach/scriptRoomRecovery')
assert.doesNotMatch(helper.roomFailure(error(429)).message,/3.*房间|代理|断网/,'unknown 429 does not invent a personal capacity or network cause')
assert.equal(helper.roomFailure(error(429),1).delay,60000)
let catalogFailure=false,listFailure=false,catalogCalls=0,listCalls=0
const listRuntime=miniRuntime({modules:{
 'utils/entryAccess':{canEnter:()=>true},
 'bundles/coach/scriptRoomApi':{
  identity:()=> 'owner-a',media:s=>s,
  catalog:async()=>{catalogCalls++;if(catalogFailure)throw error(502);return {scripts:[{id:'before-rain',title:'测试',roles:[]}]}},
  list:async()=>{listCalls++;if(listFailure)throw error(429);return {rooms:[{id:room.id,title:'原房间',phase:'play'}]}},
 },
}})
const listPage=listRuntime.page('bundles/coach/scripts');listPage.onLoad();listPage.__owner='owner-a';catalogFailure=true;await listPage.refresh();assert.equal(listPage.data.rooms.length,1,'a catalog outage must not block fetching existing rooms')
catalogFailure=false;listFailure=true;await listPage.refresh();assert.equal(listPage.data.rooms[0].id,room.id,'list 429 preserves the last known room');assert.match(listPage.data.error,/暂时受限/)
listPage.create({currentTarget:{dataset:{id:'before-rain'}}});listPage.create({currentTarget:{dataset:{id:'before-rain'}}});assert.equal(listRuntime.calls.filter(c=>c.url?.includes('?create=')).length,1,'double-tap does not open duplicate creation pages');listPage.onUnload()
console.log('PASS room recovery: 502 keeps nonce/draft/room, stale GET guard, bounded backoff, manual resume, idempotent create and accurate 429 capacity guidance')
