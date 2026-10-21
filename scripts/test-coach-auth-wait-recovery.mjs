import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
for(const route of ['pages/coach/index','pages/stem/coach'])for(const expired of [false,true]){
 const result=deferred()
 const r=miniRuntime({modules:{'utils/image':{readAsJpegDataUrl:async()=> 'data:image/jpeg;base64,fixture'},'utils/coach':{runCoach:()=>result.promise}}})
 r.storage.set('stemistUser',{id:'fixture-owner'});r.storage.set('stemistSessionToken','fixture-token')
 r.storage.set('stemistCroppedImage','/fixture/photo.jpg');r.storage.set('stemistCroppedImageMeta',{owner:'fixture-owner',epoch:0,path:'/fixture/photo.jpg'})
 const page=r.page(route);page.onLoad({source:'alevel'});page.setData({message:'fixture question',imagePath:'/fixture/photo.jpg'})
 const pending=route==='pages/coach/index'?page.submit():page.ask();await settle();assert.equal(page.data.loading,true)
 if(expired){r.storage.delete('stemistUser');r.storage.delete('stemistSessionToken');result.reject(Object.assign(new Error('登录已过期'),{statusCode:401,code:'auth_required'}))}
 else{r.storage.set('stemistUser',{id:'different-owner'});result.resolve({mode:'ai',providerStatus:'connected',answer:'old private answer'})}
 await pending
 assert.equal(page.data.loading,false,route+' must exit waiting after identity invalidation')
 assert.ok(!page.data.progress?.active,'a detached request cannot leave an active progress state')
 assert.equal(page.data.answer,'','never publish an old-owner answer')
 assert.equal(page.data.imagePath,'','old-owner photo cannot remain visible')
 if(expired)assert.equal(page.data.authRequired,true,'expired auth has a visible recovery action')
 else assert.match(page.data.error,/账号/)
 page.onUnload()
}
console.log('Coach auth wait recovery: 401/session changes stop spinner, hide old-owner data and offer reauthentication')
