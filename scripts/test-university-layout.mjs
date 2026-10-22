import assert from 'node:assert/strict'
import fs from 'node:fs'
const root=new URL('../',import.meta.url)
const read=file=>fs.readFileSync(new URL(file,root),'utf8')
export function checkUniversityGeometry(evidence){
 const {width,selectors,rows}=evidence,select=name=>rows[selectors.indexOf(name)]||[]
 const inside=(item,parent)=>item.left>=parent.left-1&&item.right<=parent.right+1
 for(const name of ['.directory-tab','.directory-share','.website-copy','.board-tab','.official-copy'])for(const item of select(name)){
  assert.ok(inside(item,{left:0,right:width}),name+' remains inside viewport')
  assert.ok(item.width>=44&&item.height>=44,name+' has a touch-sized target')
 }
 const tabs=select('.directory-tab'),tabsBox=select('.directory-tabs')[0]
 for(const tab of tabs)assert.ok(inside(tab,tabsBox),'ranking/course tabs cannot exceed their grid cells')
 for(const name of ['.directory-tab','.board-tab']){
  const controls=select(name)
  for(let i=1;i<controls.length;i++)assert.ok(controls[i].left>=controls[i-1].right+7,'adjacent '+name+' controls keep an 8px gap')
 }
 if(tabs.length&&select('.directory-share')[0])assert.ok(select('.directory-share')[0].left>=tabs.at(-1).right+7,'share never overlaps a tab')
 const cards=select('.university-card'),copies=select('.university-copy'),actions=select('.website-copy')
 for(let i=0;i<cards.length;i++){
  assert.ok(inside(copies[i],cards[i]),'long school names stay in their card')
  assert.ok(copies[i].width>=130,'school names retain a readable column')
  assert.ok(inside(actions[i],cards[i]),'website action stays inside its card')
  assert.ok(actions[i].top>=copies[i].bottom+7,'website action follows the school identity')
 }
 return true
}
const evidenceIndex=process.argv.indexOf('--evidence')
if(evidenceIndex>=0){checkUniversityGeometry(JSON.parse(fs.readFileSync(process.argv[evidenceIndex+1],'utf8')));console.log('Native university geometry PASS')}
else{
 const css=read('bundles/curricula/universities.wxss'),wxml=read('bundles/curricula/universities.wxml')
 for(const selector of ['.university-page button.directory-tab','.university-page button.board-tab']){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),style=css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'))?.[1]
  assert.ok(style,'explicit native-button rule: '+selector)
  for(const requirement of [/width:\s*100%/,/max-width:\s*100%/,/min-width:\s*0/,/margin:\s*0/,/min-height:\s*48px/])assert.match(style,requirement)
 }
 assert.match(css,/\.university-page button\.website-copy\s*\{[^}]*width:\s*auto/)
 assert.match(css,/\.university-page \.directory-pagination button\.secondary\s*\{[^}]*width:\s*100%/)
 assert.match(wxml,/compact="{{true}}"/)
 assert.match(wxml,/class="university-main"/);assert.match(wxml,/class="university-footer"/)
 assert.ok(wxml.indexOf('class="university-footer"')<wxml.indexOf('{{item.hostname}}'))
 assert.doesNotMatch(css,/text-overflow:\s*ellipsis|line-clamp/,'full school names remain readable')
 assert.match(css,/\.device-tablet\.landscape \.university-list/)
 const rankStyle=css.match(/\.rank-mark\s*\{([^}]+)\}/)?.[1]||''
 assert.match(rankStyle,/white-space:\s*nowrap/)
 assert.doesNotMatch(rankStyle,/(?:^|;)\s*width:\s*\d+px/,'rank badge grows for tied ranks and larger text')
 assert.match(css,/grid-template-columns:\s*max-content minmax\(0,1fr\)/)
 for(const selector of ['button.directory-share','.search-row button'])assert.ok(css.includes(selector)&&css.slice(css.indexOf(selector),css.indexOf('}',css.indexOf(selector))).includes('white-space:nowrap'),'small text actions do not become vertical labels')
 console.log('University layout: scoped native buttons, name/action separation, compact heading and tablet columns PASS')
}
