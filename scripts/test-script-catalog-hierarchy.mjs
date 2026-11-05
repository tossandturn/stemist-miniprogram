import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle,deferred} from './helpers/mini-runtime.mjs'
const template=fs.readFileSync(new URL('../bundles/coach/scripts.wxml',import.meta.url),'utf8')
assert.ok(template.includes('{{selectedScript.roles.length}} 个角色'),'role count comes from the selected server script')
assert.ok(!fs.readFileSync(new URL('../bundles/coach/tavern.wxml',import.meta.url),'utf8').includes('四本故事'),'server additions do not leave a fixed book-count claim')
assert.ok(!template.includes('class="script-intro"'),'a permanent marketing hero must not push the stories below the fold')
assert.ok(!template.includes('class="script-join card"'),'joining is an explicit secondary action')
let writes=0
const rt=miniRuntime({modules:{'bundles/coach/scriptRoomApi':{identity:()=> 'guest',catalog:async()=>({scripts:[{id:'before-rain',title:'雨停之前',cover:'/a.webp',summary:'公开简介'}]}),media:s=>s,list:async()=>({rooms:[]}),create:async()=>{writes++}},'utils/entryAccess':{canEnter:()=>false}}})
const p=rt.page('bundles/coach/scripts');p.onLoad();p.onShow();await settle()
try{
 assert.equal(p.data.joinOpen,false);assert.equal(p.data.selectedScript,null)
 p.showScript({currentTarget:{dataset:{id:'before-rain'}}});assert.equal(p.data.selectedScript.title,'雨停之前');assert.equal(writes,0)
 p.openInvite();assert.equal(p.data.selectedScript,null);assert.equal(p.data.joinOpen,true)
 p.join();assert.ok(p.data.inviteError);assert.equal(p.data.error,'')
 p.typeInvite({detail:{value:'abcd ef01 2345 6789'}});p.join();assert.equal(p.data.joinOpen,false);assert.match(rt.calls.at(-1).url,/invite=ABCDEF0123456789/)
 p.showScript({currentTarget:{dataset:{id:'unknown'}}});assert.equal(p.data.selectedScript,null)
 p.showScript({currentTarget:{dataset:{id:'before-rain'}}});p.closeOverlays();assert.equal(p.data.selectedScript,null)
 assert.equal(writes,0,'browsing a story must never create a room')
 console.log('PASS poster-first catalog, explicit details/join, no surprise room creation and valid invite return')
}finally{p.onUnload()}
let owner='owner:1';const pending=deferred()
const signed=miniRuntime({modules:{'bundles/coach/scriptRoomApi':{identity:()=>owner,catalog:async()=>({scripts:[]}),media:s=>s,list:()=>pending.promise},'utils/entryAccess':{canEnter:()=>true}}})
const q=signed.page('bundles/coach/scripts');q.onLoad();q.onShow();await settle()
owner='owner:2';pending.resolve({rooms:[{id:'00000000-0000-0000-0000-000000000001',title:'旧账号的局',phase:'play'}]});await settle()
assert.equal(q.data.latestRoom,null);assert.equal(q.data.rooms.length,0);q.onUnload()
