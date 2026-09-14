import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const r=miniRuntime(),app=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
for(const route of app.pages){
 const page=r.page(route)
 assert.equal(typeof page.onShareAppMessage,'function',route+' must support native friend sharing')
 page.route=route;page.data={...page.data,sessionId:'private-session',token:'private-token',answer:'private-answer',title:'private-title',taskId:'private-task'}
 const result=page.onShareAppMessage({from:'menu'})
 assert.ok(app.pages.includes(result.path.split('?')[0].slice(1)),route+' must share a registered landing page')
 assert.ok(result.imageUrl.endsWith('.png'),'a fixed cover prevents private screenshot sharing')
 assert.doesNotMatch(JSON.stringify(result),/private-|sessionId|access_token|answer=/)
}
const share=r.load('utils/share').onShareAppMessage
assert.equal(share.call({route:'pages/ielts/speaking',data:{sessionId:'secret'}}).path,'/pages/ielts/library?module=speaking')
assert.equal(share.call({route:'pages/stem/topics',data:{routeId:'cie-9702-as-physics'}}).path,'/pages/stem/topics?routeId=cie-9702-as-physics')
assert.equal(share.call({route:'pages/stem/practice',data:{routeId:'bad&token=secret'}}).path,'/pages/index/index')
assert.equal(share.call({route:'pages/papers/index',data:{category:'competition',query:'private'}}).path,'/pages/papers/index?category=competition')
assert.equal(share.call({route:'pages/ielts/library',data:{module:'../../private'}}).path,'/pages/ielts/home')
assert.match(fs.readFileSync(new URL('../pages/index/index.wxml',import.meta.url),'utf8'),/open-type="share"/)
const png=fs.readFileSync(new URL('../design-system/share-card.png',import.meta.url))
assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16)/png.readUInt32BE(20),5/4)
console.log('Native friend sharing: all page hooks, registered public destinations, fixed cover and private-state exclusion passed.')
const publicRoutes=['pages/index/index','pages/practice/index','pages/papers/index','pages/stem/topics','pages/ielts/home','pages/ielts/library','pages/ielts/vocabulary','pages/calculator/index']
const menus=[],timelineRuntime=miniRuntime({wx:{showShareMenu:options=>menus.push(options)}})
for(const route of app.pages){
 const page=timelineRuntime.page(route);page.route=route
 page.data={...page.data,routeId:'cie-9702-as-physics',activeCategory:'ielts',category:'competition',module:'speaking',sessionId:'private-session',taskId:'private-task',answer:'private-answer',title:'private-title'}
 page.options={sessionId:'private-session',token:'private-token',query:'private-query'}
 timelineRuntime.load('utils/page').syncDevice(page)
 assert.deepEqual(Array.from(menus.at(-1).menus),publicRoutes.includes(route)?['shareAppMessage','shareTimeline']:['shareAppMessage'])
 if(!publicRoutes.includes(route)){assert.equal(page.onShareTimeline,undefined,'private page must not publicly share its current route');continue}
 assert.equal(typeof page.onShareTimeline,'function',route)
 const result=page.onShareTimeline();assert.equal(typeof result.query,'string','empty query must explicitly replace the current private query')
 assert.equal(result.path,undefined,'Moments cannot override current path')
 assert.equal(result.imageUrl,undefined,'Moments uses the configured square app logo, never a page screenshot')
 assert.doesNotMatch(JSON.stringify(result),/private-|sessionId|token|answer=/)
 if(route==='pages/practice/index')assert.equal(result.query,'category=ielts')
 if(route==='pages/ielts/library')assert.equal(result.query,'module=speaking')
 if(route==='pages/stem/topics')assert.equal(result.query,'routeId=cie-9702-as-physics')
}
console.log('Moments: eight public pages, explicit menus, same-page safe queries, app logo and private-page exclusion passed.')
