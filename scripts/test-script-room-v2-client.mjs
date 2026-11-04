import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
let owner='ielts:3',seq=0,requests=[]
const base={id:'00000000-0000-0000-0000-000000000001',scriptVersion:2,revision:1,title:'测试',phase:'play',stage:0,myRoleId:'a',seats:[{id:'a',name:'知夏',isMe:true,control:'human'},{id:'b',name:'泊舟',control:'ai'}],myRole:{},myClues:[],publicClues:[],searchOptions:[{id:'c1',found:false}],myMissions:[{id:'a-0',stage:0,title:'说一句话',prompt:'如何回应',options:[{id:'open',label:'主动说'},{id:'hold',label:'先不说'}],choiceId:''}],evidenceRequests:[{roleId:'b',name:'泊舟'}],act:{title:'第一幕',shared:0,total:4,puzzle:{solved:false}},messages:[{id:'1',actor:'b',target:'public',kind:'dialogue',text:'合并旧文本',parts:[{kind:'narration',text:'泊舟把火柴盒摆正。'},{kind:'speech',text:'这次我想先说。'}]}],jobs:[]}
const api={identity:()=>owner,requestId:()=>`test-v2-${++seq}`,media:x=>x||'',get:async()=>structuredClone(base),act:async(id,p)=>{requests.push(p);return structuredClone(base)}}
const rt=miniRuntime({modules:{'bundles/coach/scriptRoomApi':api},wx:{showModal:o=>o.success({confirm:true})}})
const p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:base.id});await settle();p.onHide()
try{
 assert.equal(p.data.currentMission?.id,'a-0','current private mission should be visible')
 assert.equal(p.data.messages[0].parts[0].label,'旁白')
 assert.equal(p.data.messages[0].parts[1].label,'泊舟')
 assert.ok(p.data.nextStep.includes('搜证'))
 assert.equal(p.data.canAdvance,false,'next act cannot look ready before objectives are met')
 const template=fs.readFileSync(new URL('../bundles/coach/scriptRoom.wxml',import.meta.url),'utf8')
 assert.ok(template.indexOf('我的搜证位置')<template.indexOf('输入团队结论'),'discovery must be above the answer form')
 p.chooseMission({currentTarget:{dataset:{id:'a-0',option:'hold'}}});await settle();assert.equal(requests.at(-1).type,'choose')
 p.setData({draft:'画一张此刻的站台'});await p.send();assert.equal(requests.at(-1).type,'image')
 p.setData({draft:'不要画图，继续聊'});await p.send();assert.equal(requests.at(-1).type,'chat')
 p.requestEvidence({currentTarget:{dataset:{role:'b'}}});await settle();assert.equal(requests.at(-1).type,'requestEvidence')
 owner='ielts:4';p.onShow();assert.equal(p.data.room,null);assert.equal(p.data.currentMission,null)
 console.log('PASS: private mission controls, separate narration, image intent, evidence request and account reset')
}finally{p.onUnload()}
