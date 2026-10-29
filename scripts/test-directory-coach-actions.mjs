import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const boards=[{id:'ap',label:'AP',organization:'College Board',url:'https://apstudents.collegeboard.org/'},{id:'ib',label:'IB',organization:'International Baccalaureate',url:'https://www.ibo.org/'},{id:'alevel',label:'A-Level',organization:'Cambridge International',url:'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/'}]
const rankings=[['qs-world','world','QS Synthetic Ranking','www.topuniversities.com'],['usnews-national','us-national','U.S. News Synthetic Ranking','www.usnews.com']].map(([id,scope,label,host])=>({id,scope,label,editionYear:2027,verifiedAt:'2026-10-30',sourceUrl:'https://'+host+'/rankings',methodologyUrl:'https://'+host+'/methodology',requestedRankLimit:100,complete:true,items:Array.from({length:100},(_,i)=>({id:id+'-'+(i+1),rank:i+1,rankLabel:String(i+1),nameZh:'合成大学'+(i+1),nameEn:id+' Synthetic University '+(i+1),country:'Synthetic Country',website:'https://campus-'+(i+1)+'.synthetic.edu/'}))}))
const data={schemaVersion:'stemist-university-directory-v1',updatedAt:'2026-10-30',examBoards:boards,rankings}
const copies=[],runtime=miniRuntime({wx:{setClipboardData:o=>copies.push(o.data)},modules:{'utils/api':{getJson:async()=>data},'bundles/curricula/universityProfiles':{fetchProfileIndex:async()=>{throw Error('profile unavailable')},profileAssetUrl:()=>'',fetchProfile:async()=>{throw Error('profile unavailable')}}}})
const page=runtime.page('bundles/curricula/universities'),receiver=runtime.load('bundles/coach/directoryCoachEntry');await page.onLoad({})
let checked=0
for(const ranking of rankings){
 page.chooseRanking({currentTarget:{dataset:{ranking:ranking.id}}})
 for(let number=1;number<=5;number++){
  page.updateRankingList(number)
  for(const item of page.data.visibleItems){
   page.openUniversityCoach({currentTarget:{dataset:{id:item.id}}})
   const nonce=runtime.calls.at(-1).url.split('directoryEntry=')[1],entry=receiver.consumeDirectoryEntry(nonce)
   assert.equal(entry.kind,'university');assert.equal(entry.id,item.id);assert.ok(entry.prompt.includes(item.nameEn));assert.ok(entry.prompt.includes(ranking.label));assert.ok(entry.prompt.includes(item.website));assert.equal(page.data.coachOpening,'');checked++
  }
 }
}
for(const board of boards){page.openCourseCoach({currentTarget:{dataset:{board:board.id}}});const nonce=runtime.calls.at(-1).url.split('directoryEntry=')[1],entry=receiver.consumeDirectoryEntry(nonce);assert.equal(entry.title,board.label);assert.ok(entry.prompt.includes(board.organization));page.copyOfficial({currentTarget:{dataset:{board:board.id}}});assert.equal(copies.at(-1),board.url)}
const count=runtime.calls.length;page.openUniversityCoach({currentTarget:{dataset:{id:'unknown'}}});page.openCourseCoach({currentTarget:{dataset:{board:'unknown'}}});assert.equal(runtime.calls.length,count)
runtime.wx.navigateTo=o=>{o.fail?.({});o.complete?.({})};page.openCourseCoach({currentTarget:{dataset:{board:'ap'}}});assert.ok(page.data.coachEntryError);assert.equal(page.data.coachOpening,'')
const wxml=fs.readFileSync(new URL('../bundles/curricula/universities.wxml',import.meta.url),'utf8')
assert.match(wxml,/class="university-coach"[^>]*data-id="{{item.id}}"[^>]*bindtap="openUniversityCoach"/)
assert.match(wxml,/wx:for="{{examBoards}}"/);assert.match(wxml,/class="course-coach"[^>]*data-board="{{item.id}}"/)
assert.doesNotMatch(wxml,/<picker\b/)
page.onUnload();console.log(`PASS all ${checked} synthetic ranked entries + 3 courses: matched prompts, profile-independent entry, links, failure recovery`)
