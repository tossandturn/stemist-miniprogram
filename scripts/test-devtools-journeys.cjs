// Run against an already-open WeChat Developer Tools automation session.
// SDK is a QA-only dependency outside the mini-program upload tree.
const assert = require('node:assert/strict')
const automator = require(process.env.WECHAT_AUTOMATOR_MODULE || 'D:/CodexWork/qa-artifacts/stemist-devtools/node_modules/miniprogram-automator')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const timeout = (operation, ms=15000) => {
  let timer
  return Promise.race([operation, new Promise((_, reject)=>{timer=setTimeout(()=>reject(new Error('operation timed out')),ms)})]).finally(()=>clearTimeout(timer))
}
;(async()=>{
  const app=await timeout(automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}))
  const report=[]
  let calculatorBackup=false
  const exceptions=[]
  app.on('exception',error=>exceptions.push(String(error.message||error).slice(0,250)))
  const step=async(name,action)=>{ const detail=await timeout(action(),20000); report.push({name,status:'pass',detail}); console.log(JSON.stringify(report.at(-1))) }
  async function pageIs(route) {
    for(let i=0;i<25;i++){const page=await app.currentPage();if(page?.path===route)return page;await sleep(100)}
    throw new Error('Expected page '+route)
  }
  try {
    await step('home touch geometry',async()=>{
      const home=await app.reLaunch('/pages/index/index');await home.waitFor('.entry-card')
      const cards=await home.$$('.entry-card');assert.equal(cards.length,4)
      const first=await cards[0].offset(),second=await cards[1].offset(),size=await cards[0].size()
      const gap=second.left-first.left-Number(size.width)
      assert.ok(gap>=8,'native button width must not collapse card spacing')
      assert.ok(Number(size.height)>=44)
      return {cards:cards.length,gapPixels:gap}
    })
    await step('competition entrance and live papers',async()=>{
      const home=await app.currentPage();await(await home.$('.entry-competition')).tap()
      const page=await pageIs('pages/papers/index');await page.waitFor(async()=>!(await page.data('loading')))
      assert.equal(await page.data('category'),'competition');assert.equal(await page.data('showStageFilter'),false)
      assert.equal(await page.data('error'),'');assert.ok(await page.data('totalQuestionPapers')>0)
      return {subject:await page.data('subject'),papers:await page.data('totalQuestionPapers')}
    })
    await step('paper search and clear',async()=>{
      const page=await app.currentPage();const total=await page.data('totalQuestionPapers')
      await(await page.$('.search-box input')).input('2024');await page.waitFor(async()=>await page.data('query')==='2024')
      const count=await page.data('matchCount');assert.ok(count>0&&count<total)
      await(await page.$('.search-clear')).tap();await page.waitFor(async()=>await page.data('query')==='')
      return {searchMatches:count,restoredCount:await page.data('matchCount')}
    })
    await step('competition picker retains real catalog',async()=>{
      const page=await app.currentPage();const subjects=await page.data('subjects');const index=subjects.findIndex(s=>s.code==='esat')
      await(await page.$('picker')).trigger('change',{value:String(index)})
      await page.waitFor(async()=>await page.data('subject')==='esat'&&!(await page.data('loading')))
      assert.ok(await page.data('totalQuestionPapers')>0)
      return {subject:await page.data('subject'),papers:await page.data('totalQuestionPapers')}
    })
    await step('A-Level route resume',async()=>{
      const page=await app.reLaunch('/pages/practice/index?category=alevel&routeId=cie-9709-a2-after-p1-p5-p3-p6')
      await page.waitFor('.feature-card');assert.equal(await page.data('subjectCode'),'9709');assert.equal(await page.data('stage'),'A2')
      assert.equal(await page.data('routeId'),'cie-9709-a2-after-p1-p5-p3-p6')
      return {stage:'A2',subject:'9709'}
    })
    await step('IELTS menu and reading route',async()=>{
      const page=await app.reLaunch('/pages/practice/index?category=ielts');await page.waitFor('.ielts-feature-card')
      const cards=await page.$$('.ielts-feature-card');assert.equal(cards.length,10)
      await(await page.$('[data-feature="reading"]')).tap();await pageIs('pages/ielts/reading')
      return {visibleFeatures:10,readingOpened:true}
    })
    await step('calculator real input and equals',async()=>{
      await app.evaluate(()=>{const keys=['stemistCalculatorHistory','stemistCalculatorState'];const present=wx.getStorageInfoSync().keys;getApp().__qaJourneyCalculator=keys.map(key=>({key,exists:present.includes(key),value:wx.getStorageSync(key)}))})
      calculatorBackup=true
      const page=await app.reLaunch('/pages/calculator/index');await page.waitFor('.expression-input')
      await(await page.$('.expression-input')).input('-2^2');await(await page.$('.calc-equals')).tap()
      await page.waitFor(async()=>await page.data('display')==='-4')
      const keys=await page.$$('.calculator-keypad .calc-key')
      for(const key of keys.slice(0,4)){const size=await key.size();assert.ok(Number(size.width)>=44&&Number(size.height)>=44)}
      return {result:await page.data('display')}
    })
    await step('Coach context and empty-submit handling',async()=>{
      const page=await app.reLaunch('/pages/coach/index?source=ielts&category=ielts');await page.waitFor('.coach-scope-select')
      assert.equal(await page.data('contextId'),'ielts')
      await page.setData({message:''});await page.callMethod('submit')
      assert.ok(await page.data('error'));assert.equal(await page.data('loading'),false)
      return {context:'ielts',emptyInputRejected:true}
    })
    assert.equal(exceptions.length,0,'runtime exceptions: '+exceptions.join(';'))
    await app.reLaunch('/pages/index/index')
    console.log(JSON.stringify({summary:'pass',steps:report.length,runtimeExceptions:exceptions.length,device:'WeChat DevTools iPhone 390x753'}))
  } finally {
    if(calculatorBackup){await app.reLaunch('/pages/index/index');await app.evaluate(()=>{for(const item of getApp().__qaJourneyCalculator||[]){if(item.exists)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key)}delete getApp().__qaJourneyCalculator})}
    app.disconnect()
  }
})().catch(error=>{console.error(error.message);process.exitCode=1})
