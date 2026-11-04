import assert from 'node:assert/strict'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
let owner='owner:1',requests=0
const room={id:'00000000-0000-0000-0000-000000000001',scriptId:'thirteenth-curtain',scriptVersion:2,revision:1,title:'第十三次落幕',phase:'play',stage:0,myRoleId:'a',seats:[{id:'a',name:'沈照',control:'human',isMe:true}],act:{title:'第一幕',image:'',shared:0,total:4},myRole:{},myClues:[],publicClues:[],messages:[],jobs:[],myMissions:[],searchOptions:[]}
const api={identity:()=>owner,media:s=>s?'https://stem.ieltsist.com'+s:'',get:async()=>structuredClone(room),act:async()=>{requests++;return structuredClone(room)}}
const rt=miniRuntime({modules:{'bundles/coach/scriptRoomApi':api},wx:{createInnerAudioContext(){throw Error('audio was cancelled by user')},setNavigationBarColor(){}}})
let p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle()
try{
 assert.equal(p.data.scene?.theme,'velvet','room must use its own visual theme')
 assert.equal(p.data.introOpen,true,'first play entry shows a dismissible scene introduction')
 p.setData({draft:'我保留这句没发出的话'});p.dismissScene();assert.equal(p.data.introOpen,false);assert.equal(requests,0)
 p.adopt(structuredClone(room));assert.equal(p.data.introOpen,false,'ordinary polling cannot replay an intro')
 p.replayScene();assert.equal(p.data.introOpen,true);p.dismissScene();assert.equal(p.data.draft,'我保留这句没发出的话')
 p.adopt({...room,stage:1,act:{...room.act,title:'第二幕'}});assert.equal(p.data.introOpen,true);assert.equal(p.data.scene.stage,1)
 p.setMotion({detail:{value:false}});assert.equal(p.data.motionEnabled,false)
 p.onHide();assert.equal(p.data.motionPlaying,false)
 p.onUnload();p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle()
 assert.equal(p.data.introOpen,false,'reopening an acknowledged stage stays in the story')
 assert.equal(p.data.motionEnabled,false,'visual preference persists without audio permission')
 p.sceneImageFailed();assert.equal(p.data.sceneImageFailed,true);assert.ok(p.data.scene.intro)
 owner='owner:2';p.onShow();assert.equal(p.data.room,null);assert.equal(p.data.scene,null);assert.equal(p.data.introOpen,false)
 p.onUnload();p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle()
 api.get=async()=>{owner='guest';throw Object.assign(Error('登录已过期'),{statusCode:401})}
 await p.poll();assert.equal(p.data.room,null,'in-flight auth expiry must clear private scenery without waiting for onShow');assert.equal(p.data.introOpen,false);assert.equal(p.data.accessEnded,true)
 owner='owner:1';api.get=async()=>structuredClone(room);p.onUnload();p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle();p.openRoomMenu()
 api.get=async()=>{owner='owner:3';return structuredClone(room)}
 await p.poll();assert.equal(p.data.room,null,'a successful response for the former account must also clear the old UI');assert.equal(p.data.menuOpen,false)
 console.log('PASS visual themes, stage intro/replay, no action side effects, draft preservation, reduced motion and owner fence')
}finally{p.onUnload()}
