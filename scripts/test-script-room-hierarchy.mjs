import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const template=fs.readFileSync(new URL('../bundles/coach/scriptRoom.wxml',import.meta.url),'utf8')
assert.doesNotMatch(template,/class="room-tabs"|class="seat-strip"|class="channel-picker"/,'primary screen must not be a stack of permanent control strips')
let requests=0
const room={id:'00000000-0000-0000-0000-000000000001',scriptId:'before-rain',scriptVersion:2,revision:1,title:'雨停之前',phase:'play',stage:0,myRoleId:'letter',seats:[{id:'letter',name:'知夏',control:'human',isMe:true,ready:true},{id:'repair',name:'泊舟',control:'ai'}],myRole:{name:'知夏'},myMissions:[{id:'letter-0',stage:0,choiceId:'',options:[]}],myClues:[{id:'c1',stage:0},{id:'old',stage:-1}],publicClues:[],searchOptions:[],messages:[],jobs:[],act:{shared:0,total:4}}
const api={identity:()=> 'owner:1',media:s=>s||'',get:async()=>structuredClone(room),act:async()=>{requests++;return structuredClone(room)}}
const rt=miniRuntime({modules:{'bundles/coach/scriptRoomApi':api},wx:{showActionSheet:o=>o.success({tapIndex:2})}})
const p=rt.page('bundles/coach/scriptRoom');p.onLoad({roomId:room.id});await settle();p.dismissScene()
try{
 assert.equal(p.data.menuOpen,false);assert.equal(p.data.panel,'chat')
 p.setData({draft:'保留草稿'});p.openRoomMenu();assert.equal(p.data.menuOpen,true)
 p.panel({currentTarget:{dataset:{panel:'identity'}}});assert.equal(p.data.menuOpen,false);assert.equal(p.data.panel,'identity');assert.equal(p.data.identitySection,'profile')
 p.toggleIdentity({currentTarget:{dataset:{section:'secret'}}});assert.equal(p.data.identitySection,'secret')
 p.backFromPanel();assert.equal(p.data.panel,'chat')
 p.selectRecipient();assert.equal(p.data.channel,'repair');assert.equal(p.data.recipientLabel,'泊舟');assert.equal(p.data.draft,'保留草稿')
 p.openRoomMenu();p.beginImage();assert.equal(p.data.menuOpen,false);assert.equal(p.data.imageMode,true)
 p.toggleImage();p.panel({currentTarget:{dataset:{panel:'evidence'}}});p.showDecision();assert.equal(p.data.panel,'identity');assert.equal(p.data.identitySection,'mission');p.backFromPanel();assert.equal(p.data.panel,'evidence')
 assert.equal(p.data.currentMyClues.length,1);assert.equal(p.data.previousMyClues.length,1)
 assert.equal(p.data.publicCluesOpen,false);p.togglePublicClues();assert.equal(p.data.publicCluesOpen,true)
 assert.equal(p.data.companionsOpen,false);p.toggleCompanions();assert.equal(p.data.companionsOpen,true)
 p.openRoomMenu();p.adopt(structuredClone(room));assert.equal(p.data.menuOpen,true,'ordinary polling preserves the open menu')
 p.adopt({...structuredClone(room),stage:1});assert.equal(p.data.menuOpen,false);assert.equal(p.data.introOpen,true);assert.equal(p.data.publicCluesOpen,false);assert.equal(p.data.companionsOpen,false)
 assert.equal(p.data.draft,'保留草稿','a new act must not discard a draft')
 p.invalidateRoom();assert.equal(p.data.menuOpen,false);assert.equal(p.data.currentMyClues.length,0);assert.equal(p.data.previousMyClues.length,0);assert.equal(p.data.pastMissions.length,0)
 assert.equal(requests,0,'navigation, disclosures and recipient choice never mutate the game')
 console.log('PASS one primary conversation surface, secondary navigation, exclusive identity sections and preserved drafts')
}finally{p.onUnload()}
