import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8')
assert.match(appSource,/wrapEntryPage/,'the app must register the entry guard before any page executes')
const app={globalData:{}},calls=[]
const r=miniRuntime({globals:{getApp:()=>app},wx:{reLaunch:o=>{calls.push(o);o.success?.()},exitMiniProgram:o=>{calls.push({exit:true});o.success?.()}}})
const gate=r.load('utils/entryAccess')
function session(){r.storage.set('stemistUser',{id:'ielts:42'});r.storage.set('stemistSessionToken','synthetic');r.storage.set('stemistSessionMeta',{owner:'ielts:42',kind:'wechat',expiresAt:new Date(Date.now()+300000).toISOString()})}
let loads=0,shows=0,unloads=0
function page(){const d=gate.wrapEntryPage({data:{},onLoad(){loads++},onShow(){shows++},onUnload(){unloads++}});return{...d,route:'pages/coach/index',data:{...d.data},setData(p){Object.assign(this.data,p)}}}
const denied=page();denied.onLoad({source:'alevel',message:'private content'});denied.onShow()
assert.equal(loads,0);assert.equal(shows,0);assert.equal(denied.data.__entryGateBlocked,true);assert.match(calls[0].url,/bundles\/account\/auth/)
assert.doesNotMatch(JSON.stringify(app.globalData),/private content/,'only allowlisted public route context may survive the login gate')
denied.onUnload();assert.equal(unloads,0,'uninitialized page cleanup must not run')
session();assert.equal(gate.canEnter(),false,'identity alone is not privacy agreement')
gate.acceptConsent();assert.equal(gate.canEnter(),true)
const allowed=page();allowed.onLoad({});allowed.onShow();assert.equal(loads,1);assert.equal(shows,1);assert.equal(allowed.data.__entryGateBlocked,false)
r.storage.set('stemistSessionMeta',{owner:'ielts:99',expiresAt:new Date(Date.now()+300000).toISOString()});allowed.onShow();assert.equal(shows,1,'owner mismatch blocks a resumed page')
session();r.storage.set('stemistSessionMeta',{owner:'ielts:42',expiresAt:new Date(Date.now()-1).toISOString()});assert.equal(gate.canEnter(),false)
session();const destination=gate.completeEntry();assert.match(destination,/pages\/coach\/index/);assert.doesNotMatch(destination,/message=/)
assert.equal(app.globalData.entryReturn,undefined,'return route is consumed once')
const publicPage=gate.wrapEntryPage({entryPublic:true,data:{},onLoad(){loads++}});publicPage.onLoad.call({data:publicPage.data},{});assert.equal(loads,2)
app.globalData.entryReturn={url:'/pages/coach/index',owner:'ielts:42'}
gate.returnToBrowse(()=>{});assert.equal(calls.at(-1).url,'/pages/index/index');assert.equal(app.globalData.entryReturn,undefined,'cancelling login clears the pending protected deep link')
let privacyCallback;r.wx.getPrivacySetting=o=>{privacyCallback=o};const checking=gate.prepareEntry();gate.acceptConsent();privacyCallback.success({needAuthorization:true});await checking;assert.equal(gate.canEnter(),true,'an old platform query must not erase a later verified consent')
const account=fs.readFileSync(new URL('../bundles/account/auth.wxml',import.meta.url),'utf8')
assert.doesNotMatch(account,/返回浏览/);assert.match(account,/每天.*2/);assert.match(account,/privacy-consent/)
const accountPage=r.page('bundles/account/auth');accountPage.onLoad({required:'1'});const before=calls.length;accountPage.finishEntry();accountPage.finishEntry();assert.equal(calls.length,before+1,'concurrent privacy/login completion must not redirect twice and lose the deep link')
const manifest=JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8'))
for(const route of [...manifest.pages,...manifest.subPackages.flatMap(s=>s.pages.map(p=>s.root+'/'+p))]){
 const publicRoute=['pages/index/index','bundles/account/auth','bundles/ai-entry/index','pages/account/auth','pages/legal/privacy','bundles/coach/scripts'].includes(route),source=fs.readFileSync(new URL('../'+route+'.js',import.meta.url),'utf8')
 assert.equal(/entryPublic\s*:\s*true/.test(source),publicRoute,'home browsing, login and privacy are public: '+route)
 if(!publicRoute)assert.match(fs.readFileSync(new URL('../'+route+'.wxml',import.meta.url),'utf8'),/^<block wx:if="\{\{!__entryGateBlocked\}\}">/,'protect render and child lifetimes: '+route)
}
const publicNavigator=gate.wrapEntryPage(r.load('bundles/ai-entry/index'));assert.equal(publicNavigator.entryPublic,true,'AI handoff navigator stays public while target pages keep their existing gates')
let foregroundApp,rechecks=0,revoked=false
const foreground=miniRuntime({globals:{App:value=>{foregroundApp=value},getCurrentPages:()=>[{__entryInitialized:true,onShow(){rechecks++}}]},wx:{getPrivacySetting:o=>o.success({needAuthorization:revoked})}})
foreground.load('app');foreground.load('utils/entryAccess').acceptConsent();revoked=true;await foregroundApp.onShow()
assert.equal(rechecks,1,'foreground privacy revocation must re-run the current page gate')
assert.equal(foreground.load('utils/entryAccess').consentAccepted(),false)
let homeShows=0
const browse=miniRuntime({globals:{App:value=>{foregroundApp=value},getCurrentPages:()=>[{route:'pages/index/index',onShow(){homeShows++}}]},wx:{getPrivacySetting:o=>o.success({needAuthorization:true})}})
browse.load('app');await foregroundApp.onShow();assert.equal(homeShows,0,'privacy revalidation does not re-open public Home a second time')
console.log('PASS guest Home browsing, explicit protected-page login, unchecked consent, safe return, expiry and owner isolation')
