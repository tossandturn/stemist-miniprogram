import assert from 'node:assert/strict'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'

{
 const catalogue=deferred(),creation=deferred(),calls=[]
 const r=miniRuntime({modules:{'utils/nativeExam':{examChoices:()=>catalogue.promise,newExam:async(...args)=>{calls.push(args);return creation.promise},readExam:()=>null}}})
 const page=r.page('pages/ielts/exam');page.onLoad({mode:'random-exam'})
 const premature=page.start();await settle();assert.equal(calls.length,0,'slow catalogue must block premature exam creation');await premature
 catalogue.resolve([{id:'cam15-test1',title:'Cambridge 15 Test 1'}]);await settle()
 assert.equal(page.data.catalogReady,true);assert.equal(page.data.loading,false)
 const first=page.start();await page.start();assert.equal(calls.length,1,'double tap creates one attempt')
 page.onUnload();assert.equal(calls[0][2].cancelled(),true)
 creation.resolve({key:'must-not-attach'});await first;assert.equal(page.data.examKey,'','leaving cannot attach a late exam')
}
{
 let failed=true,calls=0
 const r=miniRuntime({modules:{'utils/nativeExam':{examChoices:async()=>{if(failed)throw Error('题库目录更新失败，请检查网络后重试。');return[{id:'cam15-test1',title:'Ready'}]},newExam:async()=>{calls++;return{key:'retry-exam'}},readExam:()=>({sources:{},modules:{},submitted:false})}}})
 const p=r.page('pages/ielts/exam');p.onLoad({mode:'random-exam'});await settle()
 assert.equal(p.data.catalogReady,false);assert.match(p.data.error,/更新失败/)
 await p.start();assert.equal(calls,0)
 failed=false;await p.load();assert.equal(p.data.catalogReady,true);assert.equal(p.data.error,'')
 await p.start();assert.equal(p.data.examKey,'retry-exam');assert.equal(p.data.cards.length,5)
}
{
 const late=deferred(),r=miniRuntime({modules:{'utils/nativeExam':{examChoices:()=>late.promise}}}),p=r.page('pages/ielts/exam')
 p.onLoad({});p.onUnload();late.resolve([{id:'late',title:'Late'}]);await settle();assert.equal(p.data.choices.length,0)
}
console.log('Native exam setup: catalogue loading/error/retry, explicit one-shot start and leaving-page guards PASS')
{
 const exam={sources:{listening:'cam15-l-test1',reading:'cam16-r-test3',writing:['cam17-w-test2-task1','cam18-w-test4-task2'],speaking:'cam15-s-test1'},modules:{},submitted:false}
 const r=miniRuntime({modules:{'utils/nativeExam':{readExam:()=>exam}}}),p=r.page('pages/ielts/exam');p.onLoad({mode:'random-exam',examKey:'existing'})
 assert.equal(p.data.cards[0].source,'Cambridge 15 · Test 1')
 assert.equal(p.data.cards[1].source,'Cambridge 16 · Test 3')
 assert.equal(p.data.cards[3].source,'Cambridge 18 · Test 4')
}
