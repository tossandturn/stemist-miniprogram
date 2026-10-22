import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
assert.ok(fs.existsSync(new URL('../bundles/curricula/universityProfiles.js',import.meta.url)),'Logo/admissions metadata must be server-backed and independent of rankings')
const digest='a'.repeat(64),prefix='/data/university-profiles/v1/'
const fixture=()=>({schemaVersion:'stemist-university-profile-index-v1',updatedAt:'2026-10-22T12:00:00Z',revision:'fixture-v1',items:[{id:'fixture-school',aliases:['fixture-school','fixture-alias'],profilePath:prefix+'profiles/fixture-school-'+digest.slice(0,16)+'.json',profileSha256:digest,kind:'verified-overview',summary:'Official overview',logo:{path:prefix+'logos/fixture-school-'+digest.slice(0,16)+'.png',sha256:digest,bytes:128}}]})
const profile=()=>({schemaVersion:'stemist-university-profile-v1',id:'fixture-school',kind:'verified-overview',updatedOn:'2026-10-22',scope:'International undergraduate',summary:'Official overview',sections:[{label:'Academic',text:'Read the selected course requirements.',sourceIds:['entry']}],sources:[{id:'entry',title:'Official requirements',url:'https://fixture.edu/admissions/'}],notice:'Minimum conditions are not a guaranteed offer.'})
const rt=miniRuntime(),service=rt.load('bundles/curricula/universityProfiles'),index=service.normalizeProfileIndex(fixture());assert.equal(index.items[0].aliases[1],'fixture-alias')
assert.equal(service.normalizeProfile(profile(),index.items[0]).id,'fixture-school')
for(const mutate of[x=>x.items[0].logo.path='https://outside.edu/p.png',x=>x.items[0].profilePath='/private.json',x=>x.items.push(x.items[0]),x=>x.items[0].aliases.push('__proto__'),x=>x.items[0].profileSha256='bad']){const v=fixture();mutate(v);assert.throws(()=>service.normalizeProfileIndex(v))}
for(const mutate of[x=>x.id='other-school',x=>x.kind='guaranteed-offer',x=>x.updatedOn='2026-02-30',x=>x.sections[0].sourceIds=[],x=>x.sections[0].sourceIds=['missing'],x=>x.sources[0].url='https://localhost/']){const v=profile();mutate(v);assert.throws(()=>service.normalizeProfile(v,index.items[0]))}
const calls=[],gate=deferred(),net=miniRuntime({modules:{'utils/api':{getJson:async(url,options)=>{calls.push({url,options});return url.endsWith('index.json')?gate.promise:profile()}}}}),s=net.load('bundles/curricula/universityProfiles');
const one=s.fetchProfileIndex(),two=s.fetchProfileIndex();gate.resolve(fixture());await Promise.all([one,two]);assert.equal(calls.length,1);assert.equal(calls[0].options.stemAuth,false)
await s.fetchProfile(index.items[0]);assert.equal(calls.length,2);await s.fetchProfile(index.items[0]);assert.equal(calls.length,2,'immutable profile data is reused by content identity')
const off=miniRuntime({modules:{'utils/api':{getJson:async()=>{throw Error('offline')}}}});for(const[k,v]of net.storage)off.storage.set(k,v)
assert.equal((await off.load('bundles/curricula/universityProfiles').fetchProfileIndex({force:true})).source,'cache')
{
 const now=Date.now(),cacheKey='stemistUniversityProfileDetails:v1',r=miniRuntime({modules:{'utils/api':{getJson:async()=>{throw Error('offline')}}}}),base=net.storage.get(cacheKey).base
 r.storage.set(cacheKey,{base,at:now,rows:[{sha:digest,at:now-7*86400000-1,payload:profile()}]})
 await assert.rejects(()=>r.load('bundles/curricula/universityProfiles').fetchProfile(index.items[0],{now}),'a new cache-container timestamp must not extend an old profile beyond seven days')
 r.storage.set(cacheKey,{base,at:now,rows:[{sha:digest,at:now-1000,payload:profile()}]})
 assert.equal((await r.load('bundles/curricula/universityProfiles').fetchProfile(index.items[0],{now})).source,'cache')
}
const template=fs.readFileSync(new URL('../bundles/curricula/universities.wxml',import.meta.url),'utf8');assert.match(template,/university-logo/);assert.match(template,/showRequirements/);assert.match(template,/requirements-panel/);assert.match(template,/copyAdmissionSource/)
{
 let requests=0;const directory={rankings:[{id:'qs-world',label:'Synthetic',scope:'world',editionYear:2027,verifiedAt:'2026-10-22',items:[]}],examBoards:[{id:'ap'}]},r=miniRuntime({modules:{'bundles/curricula/universityService':{fetchUniversityDirectory:async()=>({directory,source:'network'})},'bundles/curricula/universityProfiles':{fetchProfileIndex:async()=>{requests++;return{index}},fetchProfile:async()=>({profile:profile()}),profileAssetUrl:p=>p}}}),p=r.page('bundles/curricula/universities');await p.onLoad({tab:'official'});await settle();assert.equal(requests,0,'AP/IB/A-Level official-links entry must not fetch unrelated university logos or profiles');p.chooseTab({currentTarget:{dataset:{tab:'rankings'}}});await p.loadProfileIndex();assert.equal(requests,1);p.onUnload()
}
{
 const detail=deferred(),copied=[],entry=index.items[0],directory={rankings:[{id:'qs-world',scope:'world',label:'Synthetic ranking',editionYear:2027,verifiedAt:'2026-10-22',items:[{id:'fixture-alias',nameZh:'测试大学',nameEn:'Fixture University',website:'https://fixture.edu/',rankLabel:'1'}]}],examBoards:[{id:'ap',url:'https://apstudents.collegeboard.org/'}]}
 const r=miniRuntime({wx:{setClipboardData:o=>copied.push(o.data)},modules:{'bundles/curricula/universityService':{fetchUniversityDirectory:async()=>({directory,source:'network'})},'bundles/curricula/universityProfiles':{fetchProfileIndex:async()=>({index}),fetchProfile:async()=>detail.promise,profileAssetUrl:p=>'https://stem.ieltsist.com'+p}}}),p=r.page('bundles/curricula/universities');await p.onLoad();await p.loadProfileIndex();assert.match(p.data.visibleItems[0].logoSrc,/fixture-school/)
 p.onUniversityLogoError({currentTarget:{dataset:{id:'fixture-alias',logoPath:entry.logo.path}}});assert.equal(p.data.visibleItems[0].logoSrc,'');assert.equal(p.data.visibleItems[0].nameZh,'测试大学','image failure must not hide the institution')
 const opening=p.showRequirements({currentTarget:{dataset:{id:'fixture-alias'}}});assert.equal(p.data.profileLoading,true);p.chooseTab({currentTarget:{dataset:{tab:'official'}}});detail.resolve({profile:profile(),source:'network'});await opening;assert.equal(p.data.activeProfile,null,'late profile response cannot reopen details after changing the tab')
 p.chooseTab({currentTarget:{dataset:{tab:'rankings'}}});await p.showRequirements({currentTarget:{dataset:{id:'fixture-alias'}}});assert.equal(p.data.activeProfile.id,'fixture-school','ranking alias uses the matching canonical profile');p.copyAdmissionSource({currentTarget:{dataset:{source:'entry'}}});assert.equal(copied[0],'https://fixture.edu/admissions/');p.updateRankingList(1);assert.equal(p.data.expandedId,'');p.onUnload();assert.equal(await p.showRequirements({currentTarget:{dataset:{id:'fixture-alias'}}}),false)
}
console.log('University profile client: safe identities/URLs, sourced requirements, coalescing and bounded cache PASS')
