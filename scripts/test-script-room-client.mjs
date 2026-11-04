import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
let owner='ielts:1',seq=0,fail=false,late=null,calls=[]
const room={id:'00000000-0000-0000-0000-000000000001',scriptId:'before-rain',revision:1,title:'雨停之前',phase:'play',stage:0,myRoleId:'a',isHost:true,seats:[{id:'a',name:'知夏',control:'human',isMe:true},{id:'b',name:'泊舟',control:'ai'}],myRole:{id:'a',secret:'我的秘密'},myClues:[],publicClues:[],messages:[{id:'1',actor:'dm',target:'public',kind:'narration',text:'雨落下来。'},{id:'2',actor:'b',target:'a',kind:'dialogue',text:'私聊测试'}],jobs:[],act:{image:'/api/ai/tavern/media/v1/story-horror-opening-53812ce600e8894a.webp'}}
const api={identity:()=>owner,requestId:()=>`request-${++seq}`,media:s=>s?'https://stem.ieltsist.com'+s:'',get:async()=>structuredClone(room),create:async()=>structuredClone(room),join:async()=>structuredClone(room),act:async(id,p)=>{calls.push(p);if(late)return late.promise;if(fail)throw Error('网络中断');return structuredClone({...room,revision:2})}}
const runtime=miniRuntime({modules:{'bundles/coach/scriptRoomApi':api}})
let p=runtime.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle();p.onHide()
assert.equal(p.data.messages.length,1);assert.equal(p.data.messages[0].label,'主持人');assert.equal(p.data.room.myRole.secret,'我的秘密')
p.channel({detail:{value:2}});assert.equal(p.data.messages.length,1);assert.equal(p.data.messages[0].text,'私聊测试')
fail=true;p.setData({draft:'保留输入'});await p.send();assert.equal(p.data.draft,'保留输入');assert.ok(p.__pending)
const nonce=p.__pending.requestId;fail=false;await p.retryAction();assert.equal(calls[1].requestId,nonce);assert.equal(p.data.draft,'')
late=deferred();p.setData({draft:'不要带到新账号'});const sending=p.send();owner='ielts:2';p.onShow();assert.equal(p.data.room,null);late.resolve(room);await sending;assert.equal(p.data.room,null);p.onUnload()
const app={globalData:{}},r=miniRuntime({globals:{getApp:()=>app},wx:{reLaunch:()=>{}}}),gate=r.load('utils/entryAccess')
const page=gate.wrapEntryPage({data:{},onLoad(){throw Error('guest cannot load private room')}})
page.onLoad.call({route:'bundles/coach/scriptRoom',data:{},setData(){}},{invite:'ABCDEF0123456789',secret:'do-not-save'})
assert.match(app.globalData.entryReturn.url,/invite=ABCDEF0123456789/);assert.doesNotMatch(JSON.stringify(app.globalData),/do-not-save/)
const manifest=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'));assert.ok(manifest.subPackages.find(s=>s.root==='bundles/coach').pages.includes('scriptRoom'))
assert.match(fs.readFileSync(new URL('../bundles/coach/tavern.wxml',import.meta.url),'utf8'),/\/bundles\/coach\/scripts/)
console.log('PASS: public/private UI, narrator labels, retry nonce, input preservation, account isolation and invitation login return')
