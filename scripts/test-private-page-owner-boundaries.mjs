import assert from 'node:assert/strict'
import {deferred,miniRuntime,settle} from './helpers/mini-runtime.mjs'

// Notebook keeps same-owner text, but a switched owner cannot see, edit,
// restore from a late response, or sync the old live-page note.
{
 const cloud=deferred(),writes=[]
 const r=miniRuntime({modules:{'utils/api':{getJson:()=>cloud.promise,requestJson:async(path,body)=>{writes.push({path,body});return{}}}}})
 r.storage.set('stemistUser',{id:'ielts:101'});r.storage.set('stemistSessionToken','owner-a-token');r.storage.set('stemistNotebook:cie-9702-as-physics',{body:'owner A private note',dirty:false})
 const page=r.page('pages/notebook/index');page.onLoad({routeId:'cie-9702-as-physics'});await settle();page.onShow();assert.equal(page.data.note,'owner A private note','same-owner onShow keeps the notebook text')
 r.load('utils/session').clearLocalSession();r.storage.set('stemistUser',{id:'ielts:202'});r.storage.set('stemistSessionToken','owner-b-token');page.onShow()
 assert.equal(page.data.note,'');assert.match(page.data.error,/账号已变化/)
 cloud.resolve({routeId:'cie-9702-as-physics',note:{body:'late owner A cloud note',updatedAt:1}});await settle();assert.equal(page.data.note,'','late owner-A notebook response stays rejected')
 page.onInput({detail:{value:'must not write'}});await page.save();assert.equal(writes.length,0);assert.equal(r.storage.get('stemistNotebook:cie-9702-as-physics'),undefined)
}

// Coach clears every private surface and does not silently bind the old page
// instance to the newly authenticated account.
{
 let photo='/app/native-coach/coach-owner-a.jpg',coachCalls=0
 const r=miniRuntime({modules:{
  'utils/coach':{runCoach:async()=>{coachCalls++;return{}}},
  'utils/coachEntry':{takeCoachEntry:()=>({skill:'stem-photo',title:'Owner A entry',imagePaths:['/app/a-entry.jpg']}),focusPassage:value=>value},
  'utils/nativeCoachPhoto':{readCoachPhoto:()=>photo,clearCoachPhoto(){photo=''}},
  'utils/nativeCaptions':{loadCaptions:async()=>({words:[]})},
  'utils/image':{readAsJpegDataUrl:async()=>''},
 }})
 r.storage.set('stemistUser',{id:'ielts:101'});r.storage.set('stemistDraft:coach',{message:'owner A private question',entryKey:'entry-a'});r.storage.set('stemistCoachTurns:ielts:101:entry-a',[{role:'user',content:'A history'}])
 const page=r.page('pages/coach/index');page.onLoad({entry:'entry-a'});page.setData({answer:'owner A private answer',warning:'private warning',imagePath:photo,imageSource:'已裁剪'});page.onShow();assert.equal(page.data.message,'owner A private question','same-owner onShow keeps Coach input')
 r.load('utils/session').clearLocalSession();r.storage.set('stemistUser',{id:'ielts:202'});r.storage.set('stemistSessionToken','owner-b-token');page.onShow()
 assert.equal(page.data.message,'');assert.equal(page.data.answer,'');assert.equal(page.data.warning,'');assert.equal(page.data.imagePath,'');assert.equal(page.data.entryHasImage,false);assert.equal(JSON.stringify(page.data.routeContext),'{}');assert.equal(page.__entry,null);assert.equal(page.__history.length,0);assert.match(page.data.error,/账号已变化/)
 page.onMessage({detail:{value:'must not write'}});await page.submit();assert.equal(page.data.message,'');assert.equal(coachCalls,0);assert.equal(r.storage.get('stemistDraft:coach'),undefined)
}

// Capture may rebind to the new owner only after dropping the private retake
// scope and invalidating the prior owner's inventory request.
{
 const oldInventory=deferred(),newInventory=deferred(),requests=[oldInventory,newInventory]
 const r=miniRuntime({modules:{'utils/inventory':{fetchRouteInventory:()=>requests.shift().promise}}})
 r.storage.set('stemistUser',{id:'ielts:101'});r.storage.set('stemistRetakeContext',{category:'alevel',family:'exam',routeId:'cie-9701-a2-chemistry',stage:'A2',subjectCode:'9701'})
 const page=r.page('pages/stem/capture');page.onLoad({});await settle();page.onShow();assert.equal(page.data.routeId,'cie-9701-a2-chemistry','same-owner onShow keeps the selected retake route')
 r.load('utils/session').clearLocalSession();r.storage.set('stemistUser',{id:'ielts:202'});page.onShow()
 assert.equal(page.data.routeId,'cie-9702-as-physics');assert.notEqual(page.data.routeId,'cie-9701-a2-chemistry');assert.match(page.data.error,/账号已变化/)
 oldInventory.resolve({topics:[{id:'owner-a-private'}]});await settle();assert.equal(page.data.inventory,null,'old owner inventory cannot populate the rebound page')
 newInventory.resolve({topics:[{id:'owner-b-public'}]});await settle();assert.equal(page.data.inventoryTopics[0].id,'owner-b-public')
 page.takePhoto();assert.equal(r.storage.get('stemistCameraReturn').context.routeId,'cie-9702-as-physics')
}

console.log('Private pages: notebook, Coach and capture owner/epoch boundaries passed.')
